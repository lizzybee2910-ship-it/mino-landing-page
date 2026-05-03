/**
 * Minimal PDF generator for completion certificates and handouts.
 * Helvetica + per-script Noto Sans fallback (Type0/Identity-H with
 * ToUnicode CMap), shaped through HarfBuzz for complex scripts.
 * Coordinates: bottom-left origin, points (US Letter = 612x792).
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

import {
  expandComposites,
  parseTtf,
  subsetTtf,
  type TtfFont,
} from "./ttf";

// Typed bindings over the small subset of `harfbuzzjs` we use.
interface ShapedGlyph {
  g: number;
  cl: number;
  ax: number;
  ay: number;
  dx: number;
  dy: number;
  flags?: number;
}

interface HbBlob {
  destroy?(): void;
}

interface HbFace {
  destroy?(): void;
}

interface HbFont {
  setScale(xScale: number, yScale: number): void;
  destroy?(): void;
}

interface HbBuffer {
  addCodePoints(cps: number[]): void;
  guessSegmentProperties(): void;
  json(font: HbFont): ShapedGlyph[];
  destroy(): void;
}

interface HbBindings {
  createBlob(data: Uint8Array): HbBlob;
  createFace(blob: HbBlob, index: number): HbFace;
  createFont(face: HbFace): HbFont;
  createBuffer(): HbBuffer;
  shape(font: HbFont, buffer: HbBuffer): void;
}

// `harfbuzzjs`'s CJS entry is `module.exports = Promise<bindings>`.
// Vitest's ESM interop auto-awaits the namespace if we `import` it,
// crashing with "Method Promise.prototype.then called on incompatible
// receiver". `createRequire` returns the raw Promise we await once.
import { createRequire } from "node:module";
const _hbRequire = createRequire(import.meta.url);
const hb: HbBindings = await (_hbRequire("harfbuzzjs") as Promise<HbBindings>);

export type PdfFontName = "regular" | "bold" | "italic";

export interface PdfTextOptions {
  font?: PdfFontName;
  size?: number;
  align?: "left" | "center" | "right";
  /** RGB in 0..1. Default is black. */
  color?: [number, number, number];
  /** Optional max-width in points. Triggers word wrapping when set. */
  maxWidth?: number;
  /** Multiplier for the leading between wrapped lines. Default 1.25. */
  lineHeight?: number;
}

export interface PdfDocOptions {
  /** Page width in points. Default = US Letter portrait (612). */
  width?: number;
  /** Page height in points. Default = US Letter portrait (792). */
  height?: number;
  /** Background fill, RGB 0..1. Defaults to white. */
  background?: [number, number, number];
}

interface FontMetrics {
  // Advance widths in 1000-unit em, indexed by WinAnsi byte 0..255.
  widths: number[];
  avg: number;
}

// Approximate Helvetica/Bold/Oblique widths from the Adobe Core 14
// AFMs. Missing chars fall back to `avg`. Bold/oblique share widths.
function helveticaMetrics(bold: boolean): FontMetrics {
  const base: Record<string, number> = {
    " ": 278, "!": 278, '"': 355, "#": 556, $: 556, "%": 889, "&": 667,
    "'": 191, "(": 333, ")": 333, "*": 389, "+": 584, ",": 278, "-": 333,
    ".": 278, "/": 278, "0": 556, "1": 556, "2": 556, "3": 556, "4": 556,
    "5": 556, "6": 556, "7": 556, "8": 556, "9": 556, ":": 278, ";": 278,
    "<": 584, "=": 584, ">": 584, "?": 556, "@": 1015,
    A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278,
    J: 500, K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722,
    S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
    "[": 278, "\\": 278, "]": 278, "^": 469, _: 556, "`": 333,
    a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222,
    j: 222, k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333,
    s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
    "{": 334, "|": 260, "}": 334, "~": 584,
  };
  const widths = new Array<number>(256).fill(500);
  for (const [ch, w] of Object.entries(base)) {
    widths[ch.charCodeAt(0)] = bold ? Math.round(w * 1.1) : w;
  }
  const avg = bold ? 600 : 540;
  return { widths, avg };
}

const REGULAR_METRICS = helveticaMetrics(false);
const BOLD_METRICS = helveticaMetrics(true);
// Oblique (italic) shares Helvetica regular widths.
const ITALIC_METRICS = REGULAR_METRICS;

function helveticaMetricsFor(font: PdfFontName): FontMetrics {
  switch (font) {
    case "bold":
      return BOLD_METRICS;
    case "italic":
      return ITALIC_METRICS;
    default:
      return REGULAR_METRICS;
  }
}

function helveticaTag(font: PdfFontName): string {
  switch (font) {
    case "bold":
      return "F2";
    case "italic":
      return "F3";
    default:
      return "F1";
  }
}

// Map a Unicode cp to its WinAnsi byte, or null if not representable.
function helveticaByte(c: number): number | null {
  if (c >= 0x20 && c <= 0x7e) return c;
  if (c >= 0xa0 && c <= 0xff) return c;
  switch (c) {
    case 0x20ac: return 0x80; // €
    case 0x201a: return 0x82; // ‚
    case 0x0192: return 0x83; // ƒ
    case 0x201e: return 0x84; // „
    case 0x2026: return 0x85; // …
    case 0x2020: return 0x86; // †
    case 0x2021: return 0x87; // ‡
    case 0x02c6: return 0x88; // ˆ
    case 0x2030: return 0x89; // ‰
    case 0x0160: return 0x8a; // Š
    case 0x2039: return 0x8b; // ‹
    case 0x0152: return 0x8c; // Œ
    case 0x017d: return 0x8e; // Ž
    case 0x2018: return 0x91; // ‘
    case 0x2019: return 0x92; // ’
    case 0x201c: return 0x93; // “
    case 0x201d: return 0x94; // ”
    case 0x2022: return 0x95; // •
    case 0x2013: return 0x96; // –
    case 0x2014: return 0x97; // —
    case 0x02dc: return 0x98; // ˜
    case 0x2122: return 0x99; // ™
    case 0x0161: return 0x9a; // š
    case 0x203a: return 0x9b; // ›
    case 0x0153: return 0x9c; // œ
    case 0x017e: return 0x9e; // ž
    case 0x0178: return 0x9f; // Ÿ
    default: return null;
  }
}

// Per-script Noto fallback chain, consulted in order. Each script
// declares which faces (regular/bold/italic) are vendored; if a
// requested face isn't available for a script, that script falls
// through to its regular face rather than going un-rendered.
type FallbackFace = "regular" | "bold" | "italic";

interface FallbackDef {
  id: string;
  regularFile: string;
  boldFile: string | null;
  italicFile: string | null;
}

const FALLBACK_DEFS: FallbackDef[] = [
  {
    id: "noto-sans",
    regularFile: "NotoSans-Regular.ttf",
    boldFile: "NotoSans-Bold.ttf",
    italicFile: "NotoSans-Italic.ttf",
  },
  { id: "noto-sans-sc", regularFile: "NotoSansSC-Regular.ttf", boldFile: null, italicFile: null },
  { id: "noto-sans-arabic", regularFile: "NotoSansArabic-Regular.ttf", boldFile: null, italicFile: null },
  { id: "noto-sans-devanagari", regularFile: "NotoSansDevanagari-Regular.ttf", boldFile: null, italicFile: null },
  { id: "noto-sans-hebrew", regularFile: "NotoSansHebrew-Regular.ttf", boldFile: null, italicFile: null },
];

interface LoadedFont {
  ttf: TtfFont;
  face: FallbackFace;
  // HarfBuzz handle, created once per face and reused (HB owns WASM
  // heap memory). Scaled to `upem` so advances match `hmtx`.
  hbFont: HbFont;
}

/** Cache key: `${defId}:${file}` -> loaded font (or null if file missing). */
const _fontCache = new Map<string, LoadedFont | null>();

function locateFontFile(filename: string): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    // src/lib -> ../../assets/fonts (vitest, ts-node)
    join(here, "..", "..", "assets", "fonts", filename),
    // dist -> ../assets/fonts (production bundle)
    join(here, "..", "assets", "fonts", filename),
    // Same dir as the running script (defensive fallback).
    join(here, "assets", "fonts", filename),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

// Pick the on-disk file for the requested face. If the script
// doesn't vendor that face (e.g. Hebrew has no italic), fall through
// to the regular file so the codepoint still renders.
function fileForFace(
  def: FallbackDef,
  font: PdfFontName,
): { file: string; face: FallbackFace } {
  if (font === "bold" && def.boldFile) {
    return { file: def.boldFile, face: "bold" };
  }
  if (font === "italic" && def.italicFile) {
    return { file: def.italicFile, face: "italic" };
  }
  return { file: def.regularFile, face: "regular" };
}

function loadFont(def: FallbackDef, font: PdfFontName): LoadedFont | null {
  const { file, face } = fileForFace(def, font);
  const cacheKey = `${def.id}:${file}`;
  if (_fontCache.has(cacheKey)) return _fontCache.get(cacheKey)!;
  const path = locateFontFile(file);
  if (!path) {
    _fontCache.set(cacheKey, null);
    return null;
  }
  const buf = readFileSync(path);
  const ttf = parseTtf(buf);
  const blob = hb.createBlob(new Uint8Array(buf));
  const hbFace = hb.createFace(blob, 0);
  const hbFont = hb.createFont(hbFace);
  hbFont.setScale(ttf.unitsPerEm, ttf.unitsPerEm);
  const loaded: LoadedFont = { ttf, face, hbFont };
  _fontCache.set(cacheKey, loaded);
  return loaded;
}

function shapeRun(loaded: LoadedFont, codepoints: number[]): ShapedGlyph[] {
  const buffer = hb.createBuffer();
  try {
    buffer.addCodePoints(codepoints);
    buffer.guessSegmentProperties();
    hb.shape(loaded.hbFont, buffer);
    return buffer.json(loaded.hbFont) as ShapedGlyph[];
  } finally {
    buffer.destroy();
  }
}

interface FallbackHit {
  id: string;
  ttf: TtfFont;
  face: FallbackFace;
  loaded: LoadedFont;
}

function pickFallback(cp: number, font: PdfFontName): FallbackHit | null {
  for (const def of FALLBACK_DEFS) {
    const loaded = loadFont(def, font);
    if (!loaded) continue;
    const gid = loaded.ttf.cmap.get(cp);
    if (gid !== undefined && gid !== 0) {
      return {
        id: `${def.id}:${loaded.face}`,
        ttf: loaded.ttf,
        face: loaded.face,
        loaded,
      };
    }
  }
  return null;
}

// --------------------------------------------------------------------
// Run splitting + measurement + escaping.
// --------------------------------------------------------------------

interface HelveticaRun {
  kind: "helvetica";
  bytes: string;
  width: number;
  fontTag: string;
}

interface FallbackRun {
  kind: "fallback";
  // HarfBuzz output in visual order; full records preserved so the
  // emitter can apply GPOS positioning.
  shaped: ShapedGlyph[];
  // Convenience gid projection (length matches `shaped`).
  gids: number[];
  // Source codepoints in logical order.
  codepoints: number[];
  // Per-glyph source-cp indices, used to build the ToUnicode CMap.
  glyphSourceIndices: number[][];
  width: number;
  fontTag: string;
  fallbackId: string;
  fallbackFont: TtfFont;
}

type Run = HelveticaRun | FallbackRun;

function helveticaCharWidth(byte: number, font: PdfFontName): number {
  const m = helveticaMetricsFor(font);
  return m.widths[byte] ?? m.avg;
}

// Distribute each cluster's source-cp indices across its shaped
// glyphs, returning a parallel array. Pass 1: direct cmap-inverse
// match (so reused mark gids get a stable Unicode identity per
// occurrence). Pass 2: any unclaimed cps fall to the cluster's first
// unmatched glyph (handles ligatures and Arabic positional forms
// whose gid has no direct cmap entry).
function buildGlyphSourceIndices(
  glyphs: ShapedGlyph[],
  cps: number[],
  cmap: Map<number, number>,
): number[][] {
  const cpCount = cps.length;
  const uniqueClusters = Array.from(new Set(glyphs.map((g) => g.cl))).sort(
    (a, b) => a - b,
  );
  const clusterRange = new Map<number, [number, number]>();
  for (let i = 0; i < uniqueClusters.length; i++) {
    const start = uniqueClusters[i];
    const end =
      i + 1 < uniqueClusters.length ? uniqueClusters[i + 1] : cpCount;
    clusterRange.set(start, [start, end]);
  }

  // Build a reverse cmap once per call. Most fonts have a 1-to-many
  // forward cmap (multiple Unicode cps may share a gid), so reverse
  // entries are arrays.
  const invCmap = new Map<number, number[]>();
  for (const [cp, gid] of cmap.entries()) {
    if (!invCmap.has(gid)) invCmap.set(gid, []);
    invCmap.get(gid)!.push(cp);
  }

  // Group glyph indices by cluster, preserving HB's visual order.
  const grouped = new Map<number, number[]>();
  for (let i = 0; i < glyphs.length; i++) {
    const cl = glyphs[i].cl;
    if (!grouped.has(cl)) grouped.set(cl, []);
    grouped.get(cl)!.push(i);
  }

  const out: number[][] = glyphs.map(() => []);
  for (const [cl, glyphIdxs] of grouped) {
    const range = clusterRange.get(cl);
    if (!range) continue;
    const remaining = new Set<number>();
    for (let k = range[0]; k < range[1]; k++) remaining.add(k);

    // Pass 1 — direct cmap match.
    for (const gi of glyphIdxs) {
      const candidates = invCmap.get(glyphs[gi].g);
      if (!candidates) continue;
      let matched: number | undefined;
      for (const cp of candidates) {
        for (const k of remaining) {
          if (cps[k] === cp) {
            matched = k;
            break;
          }
        }
        if (matched !== undefined) break;
      }
      if (matched !== undefined) {
        out[gi] = [matched];
        remaining.delete(matched);
      }
    }

    // Pass 2 — leftover bucket.
    if (remaining.size > 0) {
      const leftover = Array.from(remaining).sort((a, b) => a - b);
      const target =
        glyphIdxs.find((gi) => out[gi].length === 0) ?? glyphIdxs[0];
      // If the chosen target already had a match (all glyphs matched
      // but some cps remain), prepend to keep source order.
      out[target] = [...leftover, ...out[target]].sort((a, b) => a - b);
    }
  }
  return out;
}

// Allocates `/Fn` resource tags. Helvetica owns F1/F2/F3; fallbacks
// start at F4 in first-use order.
class TagAllocator {
  private map = new Map<string, string>();
  private next = 4;
  tagFor(id: string): string {
    let t = this.map.get(id);
    if (!t) {
      t = `F${this.next++}`;
      this.map.set(id, t);
    }
    return t;
  }
}

// Split into Helvetica/fallback runs in source order. Fallback runs
// are shaped through HarfBuzz so the assembler can paint joined /
// ligated forms and build a ToUnicode CMap.
function splitRuns(
  text: string,
  font: PdfFontName,
  size: number,
  tags: TagAllocator,
): Run[] {
  const runs: Run[] = [];
  const helveticaTagStr = helveticaTag(font);

  let helvBytes = "";
  let helvWidth = 0;

  // Pending fallback run — collected codepoints share the same face.
  let fbId: string | null = null;
  let fbFontTtf: TtfFont | null = null;
  let fbLoaded: LoadedFont | null = null;
  let fbCps: number[] = [];
  let fbTag = "";

  const flushHelv = (): void => {
    if (helvBytes.length === 0) return;
    runs.push({
      kind: "helvetica",
      bytes: helvBytes,
      width: (helvWidth * size) / 1000,
      fontTag: helveticaTagStr,
    });
    helvBytes = "";
    helvWidth = 0;
  };

  const flushFb = (): void => {
    if (fbCps.length === 0 || !fbId || !fbFontTtf || !fbLoaded) return;
    const shaped = shapeRun(fbLoaded, fbCps);
    const gids = shaped.map((s) => s.g);
    const glyphSourceIndices = buildGlyphSourceIndices(
      shaped,
      fbCps,
      fbFontTtf.cmap,
    );
    // Sum HB advances (font units) and convert to PDF points. Using
    // HB's xAdvance (rather than raw hmtx) lets us account for
    // GPOS-driven kerning / mark positioning when measuring widths.
    const advanceUnits = shaped.reduce((acc, g) => acc + g.ax, 0);
    const widthPts = (advanceUnits * size) / fbFontTtf.unitsPerEm;
    runs.push({
      kind: "fallback",
      shaped,
      gids,
      codepoints: fbCps,
      glyphSourceIndices,
      width: widthPts,
      fontTag: fbTag,
      fallbackId: fbId,
      fallbackFont: fbFontTtf,
    });
    fbCps = [];
    fbId = null;
    fbFontTtf = null;
    fbLoaded = null;
    fbTag = "";
  };

  // Iterate by codepoints (handles surrogate pairs correctly).
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    const wbyte = helveticaByte(cp);
    if (wbyte !== null) {
      flushFb();
      helvBytes += String.fromCharCode(wbyte);
      helvWidth += helveticaCharWidth(wbyte, font);
      continue;
    }
    const hit = pickFallback(cp, font);
    if (!hit) {
      // No font in the chain covers this codepoint. Drop the
      // character with `?` rather than crashing the render so the
      // rest of the certificate still produces.
      flushFb();
      const q = "?".charCodeAt(0);
      helvBytes += "?";
      helvWidth += helveticaCharWidth(q, font);
      continue;
    }
    if (fbId !== hit.id) {
      // Switching to a different fallback font — close the open
      // fallback run and the open Helvetica run before starting a
      // new fallback run with this font's tag.
      flushFb();
      flushHelv();
      fbId = hit.id;
      fbFontTtf = hit.ttf;
      fbLoaded = hit.loaded;
      fbTag = tags.tagFor(hit.id);
    } else {
      // Same fallback font as the previous codepoint — keep the run
      // open. We still need to flush any Helvetica content from
      // before the first fallback codepoint of this run.
      flushHelv();
    }
    fbCps.push(cp);
  }
  flushHelv();
  flushFb();
  return runs;
}

/** Approximate text width in points for the given font and size. */
export function measureText(
  text: string,
  font: PdfFontName,
  size: number,
): number {
  const runs = splitRuns(text, font, size, new TagAllocator());
  let total = 0;
  for (const r of runs) total += r.width;
  return total;
}

/** Greedy word-wrap by approximate width. */
export function wrapText(
  text: string,
  font: PdfFontName,
  size: number,
  maxWidth: number,
): string[] {
  const out: string[] = [];
  const paragraphs = text.split(/\r?\n/);
  for (const para of paragraphs) {
    if (para.length === 0) {
      out.push("");
      continue;
    }
    const words = para.split(/\s+/);
    let line = "";
    for (const word of words) {
      const candidate = line.length === 0 ? word : `${line} ${word}`;
      if (measureText(candidate, font, size) <= maxWidth) {
        line = candidate;
      } else if (line.length === 0) {
        out.push(word);
      } else {
        out.push(line);
        line = word;
      }
    }
    if (line.length > 0) out.push(line);
  }
  return out;
}

/** Escape a Latin-1 byte string for a PDF `(...)` literal. */
function escapeLatin1Literal(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\") out += "\\\\";
    else if (ch === "(") out += "\\(";
    else if (ch === ")") out += "\\)";
    else out += ch;
  }
  return out;
}

function gidsToHex(gids: number[]): string {
  let out = "";
  for (const g of gids) {
    out += g.toString(16).padStart(4, "0").toUpperCase();
  }
  return out;
}

function gidToHex4(g: number): string {
  return g.toString(16).padStart(4, "0").toUpperCase();
}

/**
 * Emit text operators honouring HB's GPOS output. X-advances become
 * TJ kerning deltas; non-zero Y offsets (combining marks) emit an
 * explicit Td to descend onto the mark anchor, and the next iteration
 * emits its own Td to return to the baseline. Total run width still
 * equals `sum(ax) * size / upem` so following runs align in drawText.
 */
function emitShapedRunOps(run: FallbackRun, size: number): string[] {
  const ops: string[] = [];
  const upem = run.fallbackFont.unitsPerEm;
  const toEm1000 = (fu: number): number => (fu * 1000) / upem;
  const toPts = (em1000: number): number => (em1000 * size) / 1000;

  // Where HB says the next glyph should paint vs. where the PDF text
  // cursor actually is. `lineX/lineY` track the line matrix (Td-only).
  let desiredX = 0;
  let desiredY = 0;
  let textX = 0;
  let lineY = 0;
  let lineX = 0;

  let tjItems: string[] = [];
  const flushTj = (): void => {
    if (tjItems.length === 0) return;
    ops.push(`[${tjItems.join(" ")}] TJ`);
    tjItems = [];
  };

  for (const sg of run.shaped) {
    const dxEm = toEm1000(sg.dx);
    const dyEm = toEm1000(sg.dy);
    const axEm = toEm1000(sg.ax);
    const ayEm = toEm1000(sg.ay);
    const nativeW = toEm1000(run.fallbackFont.hmtx[sg.g]?.advance ?? 0);

    const paintX = desiredX + dxEm;
    const paintY = desiredY + dyEm;
    const dX = paintX - textX;
    const dY = paintY - lineY;

    const needTd = Math.abs(dY) >= 0.5;
    if (needTd) {
      flushTj();
      const tdX = paintX - lineX;
      const tdY = paintY - lineY;
      ops.push(`${num(toPts(tdX))} ${num(toPts(tdY))} Td`);
      lineX = paintX;
      lineY = paintY;
      textX = paintX;
      ops.push(`<${gidToHex4(sg.g)}> Tj`);
      textX += nativeW;
    } else {
      // Negative TJ value advances the cursor right.
      const kernEm = dX;
      if (Math.abs(kernEm) >= 0.5) {
        tjItems.push(`${Math.round(-kernEm)}`);
      }
      tjItems.push(`<${gidToHex4(sg.g)}>`);
      textX = paintX + nativeW;
    }

    desiredX += axEm;
    desiredY += ayEm;
  }
  flushTj();
  return ops;
}

// --------------------------------------------------------------------
// PDF builder.
// --------------------------------------------------------------------

interface FallbackUseEntry {
  id: string;
  tag: string;
  font: TtfFont;
  // gid -> source codepoints (length 2+ for ligatures).
  gidToUnicode: Map<number, number[]>;
}

export class PdfBuilder {
  private readonly width: number;
  private readonly height: number;
  private readonly bg: [number, number, number];
  private commands: string[] = [];
  private tags = new TagAllocator();
  /** Per-fallback-face usage tracking, keyed by `${defId}:${face}`. */
  private usedFallback = new Map<string, FallbackUseEntry>();

  constructor(opts: PdfDocOptions = {}) {
    this.width = opts.width ?? 612;
    this.height = opts.height ?? 792;
    this.bg = opts.background ?? [1, 1, 1];

    this.commands.push(
      `${this.bg[0].toFixed(3)} ${this.bg[1].toFixed(3)} ${this.bg[2]
        .toFixed(3)} rg`,
      `0 0 ${this.width} ${this.height} re`,
      "f",
    );
  }

  pageWidth(): number {
    return this.width;
  }
  pageHeight(): number {
    return this.height;
  }

  /** Fill a rectangle. x/y is bottom-left in PDF coordinates. */
  fillRect(
    x: number,
    y: number,
    w: number,
    h: number,
    color: [number, number, number],
  ): void {
    this.commands.push(
      `${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} rg`,
      `${num(x)} ${num(y)} ${num(w)} ${num(h)} re`,
      "f",
    );
  }

  /** Draw a horizontal rule from (x, y) of length `w` and thickness `h`. */
  hRule(
    x: number,
    y: number,
    w: number,
    color: [number, number, number],
    thickness = 0.6,
  ): void {
    this.fillRect(x, y, w, thickness, color);
  }

  // Draw one line at (x, y); y is the text baseline.
  drawText(
    text: string,
    x: number,
    y: number,
    options: PdfTextOptions = {},
  ): void {
    const font = options.font ?? "regular";
    const size = options.size ?? 12;
    const color = options.color ?? [0, 0, 0];
    const align = options.align ?? "left";

    const runs = splitRuns(text, font, size, this.tags);
    if (runs.length === 0) return;

    const totalWidth = runs.reduce((a, r) => a + r.width, 0);
    let startX = x;
    if (align === "center") startX = x - totalWidth / 2;
    else if (align === "right") startX = x - totalWidth;

    const colorOp = `${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2]
      .toFixed(3)} rg`;

    let cursor = startX;
    for (const run of runs) {
      this.commands.push(
        "BT",
        colorOp,
        `/${run.fontTag} ${num(size)} Tf`,
        `${num(cursor)} ${num(y)} Td`,
      );
      if (run.kind === "helvetica") {
        this.commands.push(`(${escapeLatin1Literal(run.bytes)}) Tj`);
      } else {
        for (const op of emitShapedRunOps(run, size)) {
          this.commands.push(op);
        }
        this.recordFallbackUse(run);
      }
      this.commands.push("ET");
      cursor += run.width;
    }
  }

  // Render wrapped text; returns the y just below the block.
  drawTextBlock(
    text: string,
    x: number,
    y: number,
    options: PdfTextOptions & { maxWidth: number },
  ): number {
    const font = options.font ?? "regular";
    const size = options.size ?? 12;
    const lineHeight = options.lineHeight ?? 1.25;
    const lines = wrapText(text, font, size, options.maxWidth);

    let cursor = y;
    for (const line of lines) {
      if (line.length > 0) {
        this.drawText(line, x, cursor, { ...options });
      }
      cursor -= size * lineHeight;
    }
    return cursor;
  }

  toBuffer(): Buffer {
    return assemblePdf(
      this.width,
      this.height,
      this.commands.join("\n"),
      Array.from(this.usedFallback.values()),
    );
  }

  private recordFallbackUse(run: FallbackRun): void {
    let entry = this.usedFallback.get(run.fallbackId);
    if (!entry) {
      entry = {
        id: run.fallbackId,
        tag: run.fontTag,
        font: run.fallbackFont,
        gidToUnicode: new Map(),
      };
      this.usedFallback.set(run.fallbackId, entry);
    }
    for (let i = 0; i < run.gids.length; i++) {
      const gid = run.gids[i];
      if (gid === 0) continue;
      const sourceIndices = run.glyphSourceIndices[i];
      if (sourceIndices.length === 0) continue;
      // First mapping wins; PDF bfchar is single-valued per gid.
      if (entry.gidToUnicode.has(gid)) continue;
      entry.gidToUnicode.set(
        gid,
        sourceIndices.map((idx) => run.codepoints[idx]),
      );
    }
  }
}

function num(v: number): string {
  if (Math.abs(v) < 1e-6) return "0";
  return Number(v.toFixed(3)).toString();
}

// --------------------------------------------------------------------
// PDF assembly (mixes text-only + binary objects).
// --------------------------------------------------------------------

interface PdfObj {
  /** The dictionary (without `<<` `>>`) and any preceding/inline text. */
  body: Buffer;
  /** Optional binary stream, written between `stream\n` and `\nendstream`. */
  stream?: Buffer;
}

function strBuf(s: string): Buffer {
  return Buffer.from(s, "binary");
}

function assemblePdf(
  width: number,
  height: number,
  contentStream: string,
  fallbacks: FallbackUseEntry[],
): Buffer {
  const objs: PdfObj[] = [];
  const push = (o: PdfObj): number => {
    objs.push(o);
    return objs.length; // 1-indexed object number
  };

  // Reserve catalog + pages so we can reference them by number.
  const catalogId = 1;
  const pagesId = 2;
  const pageId = 3;
  const contentsId = 4;
  const f1Id = 5;
  const f2Id = 6;
  const f3Id = 7;
  // Pre-fill placeholders for the seven standard objects.
  for (let i = 0; i < 7; i++) objs.push({ body: strBuf("") });

  // Build font resource dictionary.
  const fontEntries = ["/F1 5 0 R", "/F2 6 0 R", "/F3 7 0 R"];

  // For each fallback face actually used, emit Type0 + descendant +
  // descriptor + ToUnicode CMap + FontFile2 (subset TTF).
  for (const fb of fallbacks) {
    const subsetGids = expandComposites(fb.font, fb.gidToUnicode.keys());
    const subsetBytes = subsetTtf(fb.font, subsetGids);

    // FontFile2 stream. FlateDecode (zlib) is universally supported
    // by PDF readers and shrinks embedded TTF subsets by ~50-60%.
    // /Length1 still reports the *uncompressed* font program length
    // per the PDF spec (used by readers to round-trip the TTF).
    const compressedSubset = deflateSync(subsetBytes);
    const fontFileId = push({
      body: strBuf(
        `<< /Length ${compressedSubset.length} /Length1 ${subsetBytes.length} ` +
          `/Filter /FlateDecode >>`,
      ),
      stream: compressedSubset,
    });

    // Build /W width array. Group consecutive CIDs that share an entry
    // into [firstCID lastCID width] runs to keep the table compact.
    const wEntries = buildWidthArray(fb.font, subsetGids);

    // FontDescriptor.
    const psName = fb.font.postScriptName.replace(/[^A-Za-z0-9-]/g, "");
    const subsetPrefix = subsetTagFor(psName, subsetGids.size);
    const baseFont = `${subsetPrefix}+${psName || "Subset"}`;
    const flags = 32; // Nonsymbolic
    const fdId = push({
      body: strBuf(
        `<< /Type /FontDescriptor /FontName /${baseFont} /Flags ${flags} ` +
          `/FontBBox [${fb.font.bbox[0]} ${fb.font.bbox[1]} ${fb.font.bbox[2]} ${fb.font.bbox[3]}] ` +
          `/ItalicAngle ${formatFloat(fb.font.italicAngle)} ` +
          `/Ascent ${fb.font.ascent} /Descent ${fb.font.descent} ` +
          `/CapHeight ${fb.font.capHeight} /StemV 80 ` +
          `/FontFile2 ${fontFileId} 0 R >>`,
      ),
    });

    // ToUnicode CMap.
    const cmap = buildToUnicodeCMap(fb.gidToUnicode);
    const cmapBytes = strBuf(cmap);
    const compressedCmap = deflateSync(cmapBytes);
    const toUniId = push({
      body: strBuf(
        `<< /Length ${compressedCmap.length} /Filter /FlateDecode >>`,
      ),
      stream: compressedCmap,
    });

    // CIDFontType2 descendant.
    const cidFontId = push({
      body: strBuf(
        `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${baseFont} ` +
          `/CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> ` +
          `/FontDescriptor ${fdId} 0 R /CIDToGIDMap /Identity ` +
          `/DW ${Math.round((1000 * (fb.font.hmtx[0]?.advance ?? fb.font.unitsPerEm)) / fb.font.unitsPerEm)} ` +
          `/W [${wEntries}] >>`,
      ),
    });

    // Type0 font (referenced from /Resources via fb.tag).
    const type0Id = push({
      body: strBuf(
        `<< /Type /Font /Subtype /Type0 /BaseFont /${baseFont} ` +
          `/Encoding /Identity-H /DescendantFonts [${cidFontId} 0 R] ` +
          `/ToUnicode ${toUniId} 0 R >>`,
      ),
    });

    fontEntries.push(`/${fb.tag} ${type0Id} 0 R`);
  }

  // Now fill in the seven standard objects.
  objs[catalogId - 1] = {
    body: strBuf(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`),
  };
  objs[pagesId - 1] = {
    body: strBuf(`<< /Type /Pages /Kids [${pageId} 0 R] /Count 1 >>`),
  };
  objs[pageId - 1] = {
    body: strBuf(
      `<< /Type /Page /Parent ${pagesId} 0 R ` +
        `/MediaBox [0 0 ${num(width)} ${num(height)}] ` +
        `/Contents ${contentsId} 0 R ` +
        `/Resources << /Font << ${fontEntries.join(" ")} >> >> >>`,
    ),
  };
  const contentBytes = strBuf(contentStream);
  const compressedContent = deflateSync(contentBytes);
  objs[contentsId - 1] = {
    body: strBuf(
      `<< /Length ${compressedContent.length} /Filter /FlateDecode >>`,
    ),
    stream: compressedContent,
  };
  objs[f1Id - 1] = {
    body: strBuf(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    ),
  };
  objs[f2Id - 1] = {
    body: strBuf(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    ),
  };
  objs[f3Id - 1] = {
    body: strBuf(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>",
    ),
  };

  // Serialize: header + each `N 0 obj ... endobj` + xref + trailer.
  const chunks: Buffer[] = [];
  let offset = 0;
  const append = (b: Buffer): void => {
    chunks.push(b);
    offset += b.length;
  };

  append(strBuf("%PDF-1.4\n%\u00E2\u00E3\u00CF\u00D3\n"));
  const objOffsets: number[] = new Array(objs.length + 1);
  for (let i = 0; i < objs.length; i++) {
    objOffsets[i + 1] = offset;
    const num1 = i + 1;
    append(strBuf(`${num1} 0 obj\n`));
    append(objs[i].body);
    if (objs[i].stream) {
      append(strBuf("\nstream\n"));
      append(objs[i].stream!);
      append(strBuf("\nendstream"));
    }
    append(strBuf("\nendobj\n"));
  }

  const xrefOffset = offset;
  append(strBuf(`xref\n0 ${objs.length + 1}\n`));
  append(strBuf("0000000000 65535 f \n"));
  for (let i = 1; i <= objs.length; i++) {
    append(strBuf(`${objOffsets[i].toString().padStart(10, "0")} 00000 n \n`));
  }
  append(
    strBuf(
      `trailer\n<< /Size ${objs.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
    ),
  );

  return Buffer.concat(chunks, offset);
}

function buildWidthArray(font: TtfFont, gids: Set<number>): string {
  // Emit per-CID widths (CID == GID with Identity-H). We emit one
  // entry per used glyph so spacing is exact: `cid [w]`.
  const sorted = Array.from(gids).filter((g) => g !== 0).sort((a, b) => a - b);
  const out: string[] = [];
  for (const g of sorted) {
    const w = Math.round((1000 * (font.hmtx[g]?.advance ?? 0)) / font.unitsPerEm);
    out.push(`${g} [${w}]`);
  }
  return out.join(" ");
}

function buildToUnicodeCMap(gidToUnicode: Map<number, number[]>): string {
  // Standard PDF ToUnicode CMap header, then chunked bfchar entries.
  // Each entry maps a glyph id (4-hex CID) to one or more UTF-16BE
  // code units. Surrogate pairs are emitted for non-BMP codepoints.
  // Ligature glyphs (e.g. Devanagari `क्ष`, Arabic `لا`) map to
  // multiple Unicode codepoints in a single hex string.
  const entries = Array.from(gidToUnicode.entries()).sort(
    (a, b) => a[0] - b[0],
  );
  const lines: string[] = [];
  lines.push("/CIDInit /ProcSet findresource begin");
  lines.push("12 dict begin");
  lines.push("begincmap");
  lines.push("/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def");
  lines.push("/CMapName /Adobe-Identity-UCS def");
  lines.push("/CMapType 2 def");
  lines.push("1 begincodespacerange");
  lines.push("<0000> <FFFF>");
  lines.push("endcodespacerange");
  // bfchar entries — chunk in groups of 100 per PDF spec.
  for (let i = 0; i < entries.length; i += 100) {
    const chunk = entries.slice(i, i + 100);
    lines.push(`${chunk.length} beginbfchar`);
    for (const [gid, cps] of chunk) {
      const utf16 = cps.map(cpToUtf16Hex).join("");
      lines.push(
        `<${gid.toString(16).padStart(4, "0").toUpperCase()}> <${utf16}>`,
      );
    }
    lines.push("endbfchar");
  }
  lines.push("endcmap");
  lines.push("CMapName currentdict /CMap defineresource pop");
  lines.push("end");
  lines.push("end");
  return lines.join("\n");
}

function cpToUtf16Hex(cp: number): string {
  if (cp <= 0xffff) return cp.toString(16).padStart(4, "0").toUpperCase();
  // Surrogate pair.
  const v = cp - 0x10000;
  const hi = 0xd800 + (v >> 10);
  const lo = 0xdc00 + (v & 0x3ff);
  return (
    hi.toString(16).padStart(4, "0").toUpperCase() +
    lo.toString(16).padStart(4, "0").toUpperCase()
  );
}

function subsetTagFor(psName: string, glyphCount: number): string {
  // PDF spec: subset tag is six uppercase letters followed by `+`.
  // We hash psName + glyphCount so the same input produces the same
  // tag (helps reproducible PDFs).
  let h = 0x811c9dc5; // FNV-1a 32-bit basis
  const s = `${psName}|${glyphCount}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += String.fromCharCode(65 + (h % 26));
    h = Math.floor(h / 26);
    if (h === 0) h = 0xdeadbe;
  }
  return out;
}

function formatFloat(v: number): string {
  if (Math.abs(v) < 1e-6) return "0";
  return Number(v.toFixed(3)).toString();
}
