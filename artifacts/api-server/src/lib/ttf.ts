/**
 * Minimal TrueType font parser + subsetter used by the PDF generator to
 * embed Unicode-aware fonts (Noto Sans) so certificates render member
 * names that fall outside the 256-character WinAnsi table.
 *
 * Scope is intentionally narrow:
 *   - parse the sfnt table directory
 *   - read cmap subtables (formats 4 and 12) to build a Unicode -> glyph
 *     id map
 *   - read horizontal metrics (hmtx) so the PDF generator can measure
 *     text widths correctly
 *   - subset glyf/loca down to a chosen glyph set, preserving glyph ids
 *     so callers can use an Identity CIDToGIDMap. Composite glyphs
 *     transparently pull in their component glyphs.
 *
 * The output is a valid standalone TTF that PDF readers can consume as
 * the FontFile2 stream of a CIDFontType2 descendant.
 */

export interface TtfFont {
  data: Buffer;
  numGlyphs: number;
  unitsPerEm: number;
  ascent: number;
  descent: number;
  capHeight: number;
  xHeight: number;
  italicAngle: number;
  bbox: [number, number, number, number];
  postScriptName: string;
  /** Unicode codepoint -> glyph id. Glyph 0 (notdef) is omitted. */
  cmap: Map<number, number>;
  /** Per-glyph horizontal metrics, length === numGlyphs. */
  hmtx: { advance: number; lsb: number }[];
  /** Glyph offsets into glyf, length === numGlyphs + 1. */
  loca: number[];
  glyfOffset: number;
  glyfLength: number;
  tables: Map<string, { offset: number; length: number }>;
  indexToLocFormat: number;
}

interface TableRecord {
  tag: string;
  checksum: number;
  offset: number;
  length: number;
}

const readU8 = (b: Buffer, o: number): number => b.readUInt8(o);
const readU16 = (b: Buffer, o: number): number => b.readUInt16BE(o);
const readI16 = (b: Buffer, o: number): number => b.readInt16BE(o);
const readU32 = (b: Buffer, o: number): number => b.readUInt32BE(o);
const readI32 = (b: Buffer, o: number): number => b.readInt32BE(o);

function tag4(b: Buffer, o: number): string {
  return b.subarray(o, o + 4).toString("latin1");
}

export function parseTtf(data: Buffer): TtfFont {
  const sfntVersion = readU32(data, 0);
  // 0x00010000 = TrueType, 0x74727565 = "true" (legacy Apple).
  // OpenType/CFF (0x4F54544F = "OTTO") is intentionally rejected:
  // we only handle TTF outlines.
  if (sfntVersion !== 0x00010000 && sfntVersion !== 0x74727565) {
    throw new Error(
      `Unsupported sfnt version 0x${sfntVersion.toString(16)} ` +
        `(only TrueType fonts are supported)`,
    );
  }

  const numTables = readU16(data, 4);
  const tables = new Map<string, TableRecord>();
  for (let i = 0; i < numTables; i++) {
    const off = 12 + i * 16;
    const rec: TableRecord = {
      tag: tag4(data, off),
      checksum: readU32(data, off + 4),
      offset: readU32(data, off + 8),
      length: readU32(data, off + 12),
    };
    tables.set(rec.tag, rec);
  }

  const tbl = (name: string): TableRecord => {
    const r = tables.get(name);
    if (!r) throw new Error(`Required table '${name}' missing from font`);
    return r;
  };

  // --- head ---
  const headOff = tbl("head").offset;
  const unitsPerEm = readU16(data, headOff + 18);
  const xMin = readI16(data, headOff + 36);
  const yMin = readI16(data, headOff + 38);
  const xMax = readI16(data, headOff + 40);
  const yMax = readI16(data, headOff + 42);
  const indexToLocFormat = readI16(data, headOff + 50);

  // --- hhea / maxp ---
  const hheaOff = tbl("hhea").offset;
  const ascent = readI16(data, hheaOff + 4);
  const descent = readI16(data, hheaOff + 6);
  const numberOfHMetrics = readU16(data, hheaOff + 34);
  const numGlyphs = readU16(data, tbl("maxp").offset + 4);

  // --- hmtx ---
  const hmtxOff = tbl("hmtx").offset;
  const hmtx: { advance: number; lsb: number }[] = new Array(numGlyphs);
  let lastAdvance = 0;
  for (let i = 0; i < numGlyphs; i++) {
    if (i < numberOfHMetrics) {
      lastAdvance = readU16(data, hmtxOff + i * 4);
      const lsb = readI16(data, hmtxOff + i * 4 + 2);
      hmtx[i] = { advance: lastAdvance, lsb };
    } else {
      const lsb = readI16(
        data,
        hmtxOff + numberOfHMetrics * 4 + (i - numberOfHMetrics) * 2,
      );
      hmtx[i] = { advance: lastAdvance, lsb };
    }
  }

  // --- loca (short = format 0, long = format 1) ---
  const locaOff = tbl("loca").offset;
  const loca = new Array<number>(numGlyphs + 1);
  if (indexToLocFormat === 1) {
    for (let i = 0; i <= numGlyphs; i++) {
      loca[i] = readU32(data, locaOff + i * 4);
    }
  } else {
    for (let i = 0; i <= numGlyphs; i++) {
      // Short loca stores half-offsets (multiply by 2).
      loca[i] = readU16(data, locaOff + i * 2) * 2;
    }
  }

  // --- glyf ---
  const glyf = tbl("glyf");

  // --- OS/2 (optional) for cap/x height ---
  let capHeight = ascent;
  let xHeight = Math.round(ascent * 0.5);
  if (tables.has("OS/2")) {
    const o = tbl("OS/2").offset;
    const version = readU16(data, o);
    if (version >= 2) {
      xHeight = readI16(data, o + 86);
      capHeight = readI16(data, o + 88);
    }
  }

  // --- post (italic angle, fixed 16.16) ---
  let italicAngle = 0;
  if (tables.has("post")) {
    const p = tbl("post").offset;
    italicAngle = readI32(data, p + 4) / 65536;
  }

  // --- name -> PostScript name (id 6) ---
  let postScriptName = "Subset";
  if (tables.has("name")) {
    const n = tbl("name").offset;
    const count = readU16(data, n + 2);
    const stringOffset = readU16(data, n + 4);
    for (let i = 0; i < count; i++) {
      const recOff = n + 6 + i * 12;
      const platformID = readU16(data, recOff);
      const encodingID = readU16(data, recOff + 2);
      const nameID = readU16(data, recOff + 6);
      const length = readU16(data, recOff + 8);
      const offset = readU16(data, recOff + 10);
      if (nameID !== 6) continue;
      const start = n + stringOffset + offset;
      const slice = data.subarray(start, start + length);
      if (platformID === 1 && encodingID === 0) {
        postScriptName = slice.toString("latin1");
        break;
      }
      if (platformID === 3 && encodingID === 1) {
        // UTF-16BE
        const swapped = Buffer.alloc(slice.length);
        for (let j = 0; j + 1 < slice.length; j += 2) {
          swapped[j] = slice[j + 1];
          swapped[j + 1] = slice[j];
        }
        postScriptName = swapped.toString("utf16le");
        break;
      }
    }
  }
  postScriptName = postScriptName.replace(/[^A-Za-z0-9-]/g, "");
  if (!postScriptName) postScriptName = "Subset";

  // --- cmap ---
  const cmap = parseCmap(data, tbl("cmap").offset);

  return {
    data,
    numGlyphs,
    unitsPerEm,
    ascent,
    descent,
    capHeight,
    xHeight,
    italicAngle,
    bbox: [xMin, yMin, xMax, yMax],
    postScriptName,
    cmap,
    hmtx,
    loca,
    glyfOffset: glyf.offset,
    glyfLength: glyf.length,
    tables: new Map(
      Array.from(tables.entries()).map(([k, v]) => [
        k,
        { offset: v.offset, length: v.length },
      ]),
    ),
    indexToLocFormat,
  };
}

function parseCmap(data: Buffer, off: number): Map<number, number> {
  const numSubtables = readU16(data, off + 2);
  const subtables: { platformID: number; encodingID: number; offset: number }[] =
    [];
  for (let i = 0; i < numSubtables; i++) {
    const e = off + 4 + i * 8;
    subtables.push({
      platformID: readU16(data, e),
      encodingID: readU16(data, e + 2),
      offset: off + readU32(data, e + 4),
    });
  }
  // Prefer Unicode-full-coverage subtables. (3,10) is Windows UCS-4,
  // (0,4) is Unicode 2.0+ non-BMP, then BMP variants.
  const score = (p: number, e: number): number => {
    if (p === 3 && e === 10) return 5;
    if (p === 0 && e === 4) return 4;
    if (p === 3 && e === 1) return 3;
    if (p === 0 && e === 3) return 2;
    if (p === 0) return 1;
    return 0;
  };
  subtables.sort(
    (a, b) =>
      score(b.platformID, b.encodingID) - score(a.platformID, a.encodingID),
  );

  const map = new Map<number, number>();
  for (const st of subtables) {
    const fmt = readU16(data, st.offset);
    if (fmt === 4) parseCmapFormat4(data, st.offset, map);
    else if (fmt === 12) parseCmapFormat12(data, st.offset, map);
    else continue;
    if (map.size > 0) return map;
  }
  return map;
}

function parseCmapFormat4(
  data: Buffer,
  off: number,
  out: Map<number, number>,
): void {
  const segCountX2 = readU16(data, off + 6);
  const segCount = segCountX2 / 2;
  const endCodeOff = off + 14;
  // skip reservedPad (2 bytes) between endCount and startCount arrays.
  const startCodeOff = endCodeOff + segCountX2 + 2;
  const idDeltaOff = startCodeOff + segCountX2;
  const idRangeOffsetOff = idDeltaOff + segCountX2;

  for (let i = 0; i < segCount; i++) {
    const endCode = readU16(data, endCodeOff + i * 2);
    const startCode = readU16(data, startCodeOff + i * 2);
    const idDelta = readI16(data, idDeltaOff + i * 2);
    const idRangeOffset = readU16(data, idRangeOffsetOff + i * 2);
    if (startCode === 0xffff && endCode === 0xffff) continue;
    for (let c = startCode; c <= endCode; c++) {
      let gid: number;
      if (idRangeOffset === 0) {
        gid = (c + idDelta) & 0xffff;
      } else {
        const glyphAddr =
          idRangeOffsetOff + i * 2 + idRangeOffset + (c - startCode) * 2;
        gid = readU16(data, glyphAddr);
        if (gid !== 0) gid = (gid + idDelta) & 0xffff;
      }
      if (gid !== 0 && !out.has(c)) out.set(c, gid);
    }
  }
}

function parseCmapFormat12(
  data: Buffer,
  off: number,
  out: Map<number, number>,
): void {
  const numGroups = readU32(data, off + 12);
  for (let i = 0; i < numGroups; i++) {
    const g = off + 16 + i * 12;
    const startCharCode = readU32(data, g);
    const endCharCode = readU32(data, g + 4);
    const startGlyphID = readU32(data, g + 8);
    for (let c = startCharCode; c <= endCharCode; c++) {
      const gid = startGlyphID + (c - startCharCode);
      if (gid !== 0 && !out.has(c)) out.set(c, gid);
    }
  }
}

/**
 * Walk composite glyphs in `seed` and return the closure of all glyph
 * ids that must be present in the subset (the seed plus every component
 * referenced by composite glyphs, transitively). Glyph 0 is always
 * included so PDF readers have a .notdef to fall back on.
 */
export function expandComposites(
  font: TtfFont,
  seed: Iterable<number>,
): Set<number> {
  const result = new Set<number>([0]);
  const stack: number[] = [];
  for (const g of seed) {
    if (!result.has(g)) {
      result.add(g);
      stack.push(g);
    }
  }
  // Glyf flag bits we care about for composite parsing.
  const ARG_1_AND_2_ARE_WORDS = 0x0001;
  const WE_HAVE_A_SCALE = 0x0008;
  const MORE_COMPONENTS = 0x0020;
  const WE_HAVE_AN_X_AND_Y_SCALE = 0x0040;
  const WE_HAVE_A_TWO_BY_TWO = 0x0080;

  while (stack.length > 0) {
    const gid = stack.pop()!;
    if (gid >= font.numGlyphs) continue;
    const start = font.loca[gid];
    const end = font.loca[gid + 1];
    if (end <= start) continue; // empty glyph
    const numContours = readI16(font.data, font.glyfOffset + start);
    if (numContours >= 0) continue; // simple glyph
    // Composite: header is 10 bytes, components follow.
    let p = font.glyfOffset + start + 10;
    let flags = 0;
    do {
      flags = readU16(font.data, p);
      p += 2;
      const compGid = readU16(font.data, p);
      p += 2;
      if (!result.has(compGid)) {
        result.add(compGid);
        stack.push(compGid);
      }
      p += (flags & ARG_1_AND_2_ARE_WORDS) !== 0 ? 4 : 2;
      if ((flags & WE_HAVE_A_SCALE) !== 0) p += 2;
      else if ((flags & WE_HAVE_AN_X_AND_Y_SCALE) !== 0) p += 4;
      else if ((flags & WE_HAVE_A_TWO_BY_TWO) !== 0) p += 8;
    } while ((flags & MORE_COMPONENTS) !== 0);
  }
  return result;
}

const SUBSET_TABLES = [
  "OS/2",
  "cmap",
  "cvt ",
  "fpgm",
  "glyf",
  "head",
  "hhea",
  "hmtx",
  "loca",
  "maxp",
  "name",
  "post",
  "prep",
];

/**
 * Build a standalone TTF whose glyf only contains the bytes for the
 * glyphs in `keep` (others become zero-length entries). Glyph ids are
 * preserved so the embedded font can be used with an Identity
 * CIDToGIDMap. The returned buffer is a fully-formed sfnt: directory,
 * recomputed checksums and head.checkSumAdjustment.
 */
export function subsetTtf(font: TtfFont, keep: Set<number>): Buffer {
  // Build new glyf bytes + long-format loca offsets in glyph-id order.
  const newLoca = new Array<number>(font.numGlyphs + 1);
  const glyfChunks: Buffer[] = [];
  let cursor = 0;
  for (let gid = 0; gid < font.numGlyphs; gid++) {
    newLoca[gid] = cursor;
    if (!keep.has(gid)) continue;
    const start = font.loca[gid];
    const end = font.loca[gid + 1];
    const len = end - start;
    if (len <= 0) continue;
    let bytes = font.data.subarray(font.glyfOffset + start, font.glyfOffset + end);
    // glyf entries are required to start on an even byte boundary.
    if (len % 2 !== 0) {
      const padded = Buffer.alloc(len + 1);
      bytes.copy(padded);
      bytes = padded;
    }
    glyfChunks.push(bytes);
    cursor += bytes.length;
  }
  newLoca[font.numGlyphs] = cursor;
  const newGlyf = Buffer.concat(glyfChunks, cursor);

  // Long-format loca: u32 per entry.
  const newLocaBuf = Buffer.alloc((font.numGlyphs + 1) * 4);
  for (let i = 0; i <= font.numGlyphs; i++) {
    newLocaBuf.writeUInt32BE(newLoca[i], i * 4);
  }

  const newTables = new Map<string, Buffer>();
  for (const name of SUBSET_TABLES) {
    const src = font.tables.get(name);
    if (!src) continue;
    if (name === "glyf") newTables.set(name, newGlyf);
    else if (name === "loca") newTables.set(name, newLocaBuf);
    else {
      newTables.set(
        name,
        Buffer.from(font.data.subarray(src.offset, src.offset + src.length)),
      );
    }
  }

  // Patch head: indexToLocFormat=1, zero checkSumAdjustment so we can
  // recompute it from the assembled file.
  const head = newTables.get("head");
  if (!head) throw new Error("head table missing");
  const newHead = Buffer.from(head);
  newHead.writeUInt32BE(0, 8); // checkSumAdjustment placeholder
  newHead.writeInt16BE(1, 50); // indexToLocFormat = long
  newTables.set("head", newHead);

  // Sort table directory by tag (sfnt convention).
  const entries = Array.from(newTables.entries()).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  const numTables = entries.length;
  const log2 = Math.floor(Math.log2(numTables));
  const searchRange = (1 << log2) * 16;
  const entrySelector = log2;
  const rangeShift = numTables * 16 - searchRange;

  const headerSize = 12 + numTables * 16;
  let nextOffset = headerSize;
  type Packed = {
    tag: string;
    data: Buffer;
    offset: number;
    length: number;
    checksum: number;
  };
  const packed: Packed[] = [];
  for (const [tg, buf] of entries) {
    const length = buf.length;
    const padLen = (4 - (length % 4)) % 4;
    const data = padLen === 0 ? buf : Buffer.concat([buf, Buffer.alloc(padLen)]);
    packed.push({
      tag: tg,
      data,
      offset: nextOffset,
      length,
      checksum: ttfChecksum(data),
    });
    nextOffset += data.length;
  }

  const out = Buffer.alloc(nextOffset);
  out.writeUInt32BE(0x00010000, 0);
  out.writeUInt16BE(numTables, 4);
  out.writeUInt16BE(searchRange, 6);
  out.writeUInt16BE(entrySelector, 8);
  out.writeUInt16BE(rangeShift, 10);
  for (let i = 0; i < packed.length; i++) {
    const e = packed[i];
    const off = 12 + i * 16;
    out.write(e.tag.padEnd(4, " ").slice(0, 4), off, "latin1");
    out.writeUInt32BE(e.checksum, off + 4);
    out.writeUInt32BE(e.offset, off + 8);
    out.writeUInt32BE(e.length, off + 12);
    e.data.copy(out, e.offset);
  }

  // head.checkSumAdjustment = 0xB1B0AFBA - sum(file)
  const headEntry = packed.find((p) => p.tag === "head");
  if (headEntry) {
    const sum = ttfChecksum(out);
    const adj = (0xb1b0afba - sum) >>> 0;
    out.writeUInt32BE(adj, headEntry.offset + 8);
  }

  // Silence unused-readU8 warning while still keeping the helper around
  // for future format-6 cmap support (single-byte glyph index array).
  void readU8;

  return out;
}

function ttfChecksum(buf: Buffer): number {
  // Sum of u32 big-endian words. Trailing bytes are padded with zero.
  let sum = 0;
  const len = buf.length;
  let i = 0;
  for (; i + 3 < len; i += 4) {
    sum = (sum + buf.readUInt32BE(i)) >>> 0;
  }
  if (i < len) {
    let last = 0;
    for (let j = 0; j < 4; j++) {
      last = ((last << 8) | (i + j < len ? buf[i + j] : 0)) >>> 0;
    }
    sum = (sum + last) >>> 0;
  }
  return sum;
}
