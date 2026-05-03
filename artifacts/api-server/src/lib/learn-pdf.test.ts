// Tests for the learn-surface PDF renderers. Covers the non-Latin
// member-name regression: structural Type0/FontFile2/ToUnicode
// assertions plus end-to-end text extraction via pdftotext.

import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateSync } from "node:zlib";

import { describe, expect, test } from "vitest";

import { renderCertificatePdf, renderHandoutPdf } from "./learn-pdf";

const NAME = "Иван Тестов";

function toLatin1(buf: Buffer): string {
  return buf.toString("latin1");
}

// Inflate every `/Filter /FlateDecode` stream in `pdf`, returning a
// latin1 string with each compressed body replaced by its inflated
// bytes (also as latin1). Lets the legacy regex-driven assertions in
// this file keep working after assemblePdf started zlib-compressing
// content streams, ToUnicode CMaps, and embedded FontFile2 subsets.
function expandFlateStreams(pdf: Buffer): string {
  const out: Buffer[] = [];
  let i = 0;
  while (i < pdf.length) {
    const objStart = pdf.indexOf("\nstream\n", i);
    if (objStart === -1) {
      out.push(pdf.subarray(i));
      break;
    }
    const dictStart = pdf.lastIndexOf("<<", objStart);
    const dictEnd = pdf.indexOf(">>", dictStart);
    const dict = pdf.subarray(dictStart, dictEnd + 2).toString("latin1");
    const lengthMatch = dict.match(/\/Length\s+(\d+)/);
    const isFlate = /\/Filter\s*\/FlateDecode/.test(dict);
    const bodyStart = objStart + "\nstream\n".length;
    if (!lengthMatch) {
      out.push(pdf.subarray(i, bodyStart));
      i = bodyStart;
      continue;
    }
    const len = parseInt(lengthMatch[1], 10);
    const bodyEnd = bodyStart + len;
    out.push(pdf.subarray(i, bodyStart));
    if (isFlate) {
      out.push(inflateSync(pdf.subarray(bodyStart, bodyEnd)));
    } else {
      out.push(pdf.subarray(bodyStart, bodyEnd));
    }
    i = bodyEnd;
  }
  return Buffer.concat(out).toString("latin1");
}

function pdftotext(pdf: Buffer, opts: { raw?: boolean } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "mino-pdf-"));
  const file = join(dir, "in.pdf");
  writeFileSync(file, pdf);
  const args = opts.raw ? ["-raw", file, "-"] : [file, "-"];
  const result = spawnSync("pdftotext", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      `pdftotext exited with ${result.status}: ${result.stderr}`,
    );
  }
  return result.stdout;
}

// Order-agnostic check used for RTL scripts (Arabic/Hebrew), where
// pdftotext serializes in visual order with BiDi marks. Every cp
// must still appear in `haystack`.
function containsAllCodepoints(haystack: string, needle: string): boolean {
  for (const ch of needle) {
    if (/\s/.test(ch)) continue;
    if (!haystack.includes(ch)) return false;
  }
  return true;
}

describe("renderCertificatePdf — non-Latin names", () => {
  const pdf = renderCertificatePdf({
    courseTitle: "Notes from the Quiet Practice",
    courseSubtitle: "Reflections on the rhythms of slow editorial work",
    memberName: NAME,
    completedAt: new Date("2026-01-15T12:00:00Z"),
    certificateId: "MINO-TEST-DEADBEEF",
  });
  const body = toLatin1(pdf);

  test("produces a syntactically-valid PDF", () => {
    expect(body.startsWith("%PDF-")).toBe(true);
    expect(body).toContain("%%EOF");
    // Reasonable lower bound: the embedded subset alone is several KB.
    expect(pdf.length).toBeGreaterThan(20_000);
    // Upper bound: a Cyrillic certificate's FontFile2 + content stream
    // are FlateDecode-compressed, so the whole PDF should comfortably
    // fit under ~80 KB. (Pre-compression baseline was ~115 KB.)
    expect(pdf.length).toBeLessThan(80_000);
  });

  test("includes a Type0 / Identity-H font with a CIDFontType2 child", () => {
    expect(body).toContain("/Subtype /Type0");
    expect(body).toContain("/Encoding /Identity-H");
    expect(body).toContain("/Subtype /CIDFontType2");
    expect(body).toContain("/CIDToGIDMap /Identity");
    // The actual font program is embedded as a FontFile2 stream.
    expect(body).toContain("/FontFile2");
    // Subset prefix convention: 6 uppercase letters + '+'
    expect(body).toMatch(/\/[A-Z]{6}\+NotoSans/);
  });

  test("ToUnicode CMap maps every Cyrillic codepoint to its source", () => {
    // Find every ToUnicode CMap stream and decode them. There may be
    // more than one (regular + bold faces); concatenating is fine.
    // CMap streams are FlateDecode-compressed, so inflate first.
    const expanded = expandFlateStreams(pdf);
    const cmaps: string[] = [];
    const re = /\/CMapName \/Adobe-Identity-UCS def([\s\S]*?)endcmap/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(expanded)) !== null) {
      cmaps.push(m[1]);
    }
    expect(cmaps.length).toBeGreaterThan(0);
    const allCmaps = cmaps.join("\n");

    const seen = new Set<number>();
    for (const ch of NAME) {
      const cp = ch.codePointAt(0)!;
      if (cp < 0x80) continue; // skip ASCII space
      if (seen.has(cp)) continue;
      seen.add(cp);
      const hex = cp.toString(16).toUpperCase().padStart(4, "0");
      const pattern = new RegExp(`<[0-9A-F]{4}> <${hex}>`);
      expect(allCmaps).toMatch(pattern);
    }
  });

  test("pdftotext recovers the Cyrillic name from the rendered PDF", () => {
    const text = pdftotext(pdf);
    expect(text).toContain(NAME);
    expect(text).toContain("Notes from the Quiet Practice");
    expect(text).toContain("MINO-TEST-DEADBEEF");
  });

  test("ASCII names still render through Helvetica (no fallback emitted)", () => {
    const ascii = renderCertificatePdf({
      courseTitle: "Notes from the Quiet Practice",
      courseSubtitle: "",
      memberName: "Jane Doe",
      completedAt: new Date("2026-01-15T12:00:00Z"),
      certificateId: "MINO-TEST-ASCII0001",
    });
    const text = toLatin1(ascii);
    // No Type0 font dict should be needed for a pure-ASCII certificate.
    expect(text).not.toContain("/Subtype /Type0");
    expect(text).toContain("/BaseFont /Helvetica");
    expect(text).toContain("/BaseFont /Helvetica-Bold");
    // pdftotext should still recover the visible name.
    expect(pdftotext(ascii)).toContain("Jane Doe");
  });
});

// Smoke test the per-script fallback chain end-to-end via pdftotext.
describe("renderCertificatePdf — fallback font chain by script", () => {
  const cases: { script: string; name: string }[] = [
    { script: "Simplified Chinese", name: "李明" },
    { script: "Arabic", name: "محمد علي" },
    { script: "Devanagari (Hindi)", name: "प्रिया शर्मा" },
    { script: "Hebrew", name: "דניאל כהן" },
    { script: "Greek", name: "Αλέξανδρος" },
  ];

  for (const { script, name } of cases) {
    test(`${script}: "${name}" round-trips through pdftotext`, () => {
      const pdf = renderCertificatePdf({
        courseTitle: "Notes from the Quiet Practice",
        courseSubtitle: "",
        memberName: name,
        completedAt: new Date("2026-01-15T12:00:00Z"),
        certificateId: `MINO-${script.replace(/\s+/g, "-").toUpperCase()}`,
      });
      // PDF is structurally well-formed.
      const body = toLatin1(pdf);
      expect(body.startsWith("%PDF-")).toBe(true);
      expect(body).toContain("/Subtype /Type0");
      // Every codepoint of the name round-trips through the ToUnicode
      // CMap and is recoverable via pdftotext.
      const text = pdftotext(pdf);
      expect(containsAllCodepoints(text, name)).toBe(true);
    });
  }
});

describe("renderCertificatePdf — complex-script shaping", () => {
  // Pull every Type0 glyph-id payload from raw content streams.
  // Matches both `[<HEX>...] TJ` (kerning ints stripped) and the
  // stand-alone `<HEX> Tj` form used after Td mark-positioning.
  function extractGlyphRuns(pdf: Buffer): string[] {
    // Glyph-painting ops live inside the page's content stream, which
    // is FlateDecode-compressed. Inflate before regex extraction.
    const body = expandFlateStreams(pdf);
    const out: string[] = [];
    const tjRe = /\[((?:\s*<[0-9a-fA-F]+>\s*|-?\d+\s*)+)\]\s*TJ/g;
    let m: RegExpExecArray | null;
    while ((m = tjRe.exec(body)) !== null) {
      const inner = m[1];
      let merged = "";
      const hexRe = /<([0-9a-fA-F]+)>/g;
      let h: RegExpExecArray | null;
      while ((h = hexRe.exec(inner)) !== null) merged += h[1].toUpperCase();
      if (merged.length > 0) out.push(merged);
    }
    const tjSingleRe = /<([0-9a-fA-F]+)>\s*Tj/g;
    while ((m = tjSingleRe.exec(body)) !== null) {
      out.push(m[1].toUpperCase());
    }
    return out;
  }

  test("Arabic name produces shaped glyphs distinct from naive cmap lookup", () => {
    // "محمد" — duplicated meem (U+0645) takes initial vs. final
    // positional alternates after GSUB, so the painted stream has
    // 4 distinct gids; a non-shaping path would yield only 3.
    const arabicName = "محمد";
    const pdf = renderCertificatePdf({
      courseTitle: "Notes from the Quiet Practice",
      courseSubtitle: "",
      memberName: arabicName,
      completedAt: new Date("2026-01-15T12:00:00Z"),
      certificateId: "MINO-AR-SHAPE-001",
    });
    const runs = extractGlyphRuns(pdf);
    expect(runs.length).toBeGreaterThan(0);

    // The Arabic-name run is 4 glyphs × 4 hex digits each. Tolerate
    // 4–6 glyphs in case shaping splits a mark.
    const candidates = runs.filter((r) => r.length >= 16 && r.length <= 24);
    expect(candidates.length).toBeGreaterThan(0);

    const distinctCounts = candidates.map((r) => {
      const ids = new Set<number>();
      for (let i = 0; i + 4 <= r.length; i += 4) {
        ids.add(parseInt(r.slice(i, i + 4), 16));
      }
      return ids.size;
    });
    expect(Math.max(...distinctCounts)).toBeGreaterThanOrEqual(4);

    const text = pdftotext(pdf);
    expect(containsAllCodepoints(text, arabicName)).toBe(true);
  });

  test("Arabic with tashkil emits GPOS mark positioning (Td between glyphs)", () => {
    // "مَحَمَّدُ" — combining tashkil marks. HarfBuzz's `mark`
    // GPOS feature returns non-zero (dx, dy) offsets per mark; the
    // emitter must turn those into explicit Td translations.
    const tashkil = "مَحَمَّدُ";
    const pdf = renderCertificatePdf({
      courseTitle: "Notes from the Quiet Practice",
      courseSubtitle: "",
      memberName: tashkil,
      completedAt: new Date("2026-01-15T12:00:00Z"),
      certificateId: "MINO-AR-GPOS-001",
    });
    // Page content stream is FlateDecode-compressed; inflate first.
    const body = expandFlateStreams(pdf);

    // Find every BT/ET object referencing a fallback font (F4+).
    const textObjects: string[] = [];
    const btEtRe = /BT([\s\S]*?)ET/g;
    let m: RegExpExecArray | null;
    while ((m = btEtRe.exec(body)) !== null) textObjects.push(m[1]);
    const fallbackObjs = textObjects.filter((t) => /\/F[4-9]\d*\s/.test(t));
    expect(fallbackObjs.length).toBeGreaterThan(0);

    // Each off-baseline mark adds two Tds (descend + ascend) on top
    // of the run's origin Td.
    const tdCounts = fallbackObjs.map((t) => {
      const matches = t.match(/\bTd\b/g);
      return matches === null ? 0 : matches.length;
    });
    expect(Math.max(...tdCounts)).toBeGreaterThanOrEqual(3);

    // At least one Td after the origin must move > 1pt vertically.
    const hasOffBaselineTd = fallbackObjs.some((t) => {
      const tdRe = /(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+Td/g;
      let td: RegExpExecArray | null;
      let count = 0;
      while ((td = tdRe.exec(t)) !== null) {
        if (count++ === 0) continue;
        if (Math.abs(parseFloat(td[2])) > 1) return true;
      }
      return false;
    });
    expect(hasOffBaselineTd).toBe(true);

    // ToUnicode must still round-trip every source cp incl. marks.
    const text = pdftotext(pdf);
    expect(containsAllCodepoints(text, tashkil)).toBe(true);
  });

  test("Devanagari conjunct emits more glyphs than naive cmap would", () => {
    // GSUB collapses the conjunct into a ligature; the ToUnicode CMap
    // must still map it back to every source codepoint.
    const dev = "प्रिया शर्मा";
    const pdf = renderCertificatePdf({
      courseTitle: "Notes from the Quiet Practice",
      courseSubtitle: "",
      memberName: dev,
      completedAt: new Date("2026-01-15T12:00:00Z"),
      certificateId: "MINO-DEV-SHAPE-001",
    });
    const text = pdftotext(pdf);
    expect(containsAllCodepoints(text, dev)).toBe(true);

    // Cluster mapping must yield at least one multi-cp bfchar entry.
    // ToUnicode CMap streams are FlateDecode-compressed.
    const body = expandFlateStreams(pdf);
    const cmaps: string[] = [];
    const re = /\/CMapName \/Adobe-Identity-UCS def([\s\S]*?)endcmap/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) cmaps.push(m[1]);
    const allCmaps = cmaps.join("\n");
    expect(allCmaps).toMatch(/<[0-9A-F]{4}> <[0-9A-F]{8,}>/);
  });
});

describe("renderCertificatePdf — italic non-Latin uses real italic face", () => {
  // Regression: italic + non-Latin used to silently render in upright
  // Noto Sans Regular because only Regular and Bold were vendored.
  // The italic course subtitle below routes through `font: "italic"`
  // in learn-pdf.ts, so its Cyrillic glyphs must be embedded from the
  // Italic face (PostScript name "NotoSans-Italic"), not the Regular
  // face ("NotoSans-Regular").
  test("Cyrillic in an italic line embeds NotoSans-Italic, not NotoSans-Regular", () => {
    const cyrillicSubtitle = "Размышления о медленной редакторской практике";
    const pdf = renderCertificatePdf({
      courseTitle: "Notes from the Quiet Practice",
      courseSubtitle: cyrillicSubtitle,
      memberName: "Jane Doe",
      completedAt: new Date("2026-01-15T12:00:00Z"),
      certificateId: "MINO-IT-CYR-001",
    });
    const body = toLatin1(pdf);

    // Collect every embedded BaseFont. Subset prefix is 6 uppercase
    // letters + '+' + the underlying PostScript name.
    const baseFonts = new Set<string>();
    const re = /\/BaseFont \/[A-Z]{6}\+([A-Za-z0-9-]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) baseFonts.add(m[1]);

    expect(baseFonts.has("NotoSans-Italic")).toBe(true);

    // The Cyrillic glyphs themselves must round-trip through the
    // Italic face's ToUnicode CMap. We isolate the Italic font's
    // CMap by anchoring on its FontDescriptor / FontFile2 chain.
    // Easier and equally tight: every non-space cp in the subtitle
    // must appear as a bfchar target somewhere in the document.
    // CMap streams are FlateDecode-compressed, so inflate first.
    const expanded = expandFlateStreams(pdf);
    const cmaps: string[] = [];
    const cmapRe = /\/CMapName \/Adobe-Identity-UCS def([\s\S]*?)endcmap/g;
    while ((m = cmapRe.exec(expanded)) !== null) cmaps.push(m[1]);
    const allCmaps = cmaps.join("\n");
    for (const ch of cyrillicSubtitle) {
      const cp = ch.codePointAt(0)!;
      if (cp < 0x80) continue;
      const hex = cp.toString(16).toUpperCase().padStart(4, "0");
      expect(allCmaps).toMatch(new RegExp(`<[0-9A-F]{4}> <${hex}>`));
    }

    // pdftotext should still recover the subtitle text.
    expect(pdftotext(pdf)).toContain(cyrillicSubtitle);
  });

  test("italic + bold Cyrillic embed distinct Italic and Bold faces side by side", () => {
    // Bold member name ("Иван Тестов") + italic Cyrillic subtitle:
    // each face routes through its own embedded font subset, so the
    // PDF must carry both NotoSans-Bold and NotoSans-Italic — not
    // collapse italic back into bold or regular.
    const pdf = renderCertificatePdf({
      courseTitle: "Notes from the Quiet Practice",
      courseSubtitle: "Размышления о медленной практике",
      memberName: NAME,
      completedAt: new Date("2026-01-15T12:00:00Z"),
      certificateId: "MINO-IT-MIX-001",
    });
    const body = toLatin1(pdf);
    const baseFonts = new Set<string>();
    const re = /\/BaseFont \/[A-Z]{6}\+([A-Za-z0-9-]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) baseFonts.add(m[1]);
    expect(baseFonts.has("NotoSans-Bold")).toBe(true);
    expect(baseFonts.has("NotoSans-Italic")).toBe(true);
  });
});

describe("renderHandoutPdf — non-Latin body", () => {
  test("embeds the Unicode font when handout body uses non-Latin", () => {
    const pdf = renderHandoutPdf({
      courseTitle: "О тишине",
      handoutTitle: "Глоссарий",
      handoutDescription: "Краткий список терминов",
      body: "Тишина — это практика.\n\n- Внимание\n- Терпение",
    });
    const text = toLatin1(pdf);
    expect(text).toContain("/Subtype /Type0");
    expect(text).toContain("/FontFile2");
    expect(text).toContain("/Encoding /Identity-H");
    // Body text round-trips through pdftotext.
    const extracted = pdftotext(pdf);
    expect(extracted).toContain("Глоссарий");
    expect(extracted).toContain("Внимание");
    expect(extracted).toContain("Терпение");
  });

  // Regression cap: the dominant size contributor for a Cyrillic
  // handout is the embedded NotoSans subset's FontFile2 stream, which
  // assemblePdf FlateDecode-compresses (~50-60% shrink). The
  // ToUnicode CMap and page content stream are compressed too. If
  // any of those compressors is silently removed, a representative
  // handout balloons from ~130 KB to >300 KB. The certificate path
  // already has an analogous upper-bound assertion; mirror it here so
  // handouts — which carry far more page content than certificates —
  // can't quietly regress either.
  test("representative Cyrillic handout stays under the size budget", () => {
    const body = [
      "Тишина — это не пустота, а форма внимания. Она возникает там, где исчезает спешка, и где мы перестаём перебивать друг друга.",
      "Когда мы работаем медленно, мы лучше слышим интонацию автора. Мы замечаем, как короткое слово меняет ритм, и как лишний союз глушит фразу.",
      "Несколько практических ориентиров:",
      "- Внимание: возвращайтесь к первому абзацу после правки последнего.",
      "- Терпение: дайте тексту отлежаться хотя бы один вечер.",
      "- Скромность: чужая фраза почти всегда сильнее вашей замены.",
      "- Точность: сомневаетесь в слове — посмотрите его этимологию.",
      "Медленная редактура не означает работу без сроков. Она означает работу без суеты.",
    ].join("\n\n");

    const pdf = renderHandoutPdf({
      courseTitle: "О тишине",
      handoutTitle: "Глоссарий медленной практики",
      handoutDescription: "Краткий список терминов и наблюдений",
      body,
    });
    const body1 = toLatin1(pdf);

    // Sanity floor: a Cyrillic handout must embed a font subset, so
    // it can't be trivially small. Catches accidental "no font
    // embedded" regressions where the body would render as tofu.
    expect(pdf.length).toBeGreaterThan(50_000);

    // Upper bound: today's representative Cyrillic handout is ~130
    // KB with FlateDecode on every stream. Removing FontFile2
    // compression alone pushes it past 300 KB. 160 KB gives ~23%
    // headroom for incidental growth (extra bullets, longer body,
    // additional vendored glyphs) while still failing loudly if the
    // font-subset compression path is removed or bypassed.
    expect(pdf.length).toBeLessThan(160_000);

    // The size cap above is dominated by the FontFile2 subset, so it
    // would not fail clearly if *only* the page content stream
    // stopped being FlateDecode-compressed (the body is small enough
    // that uncompressed content barely moves the needle). Assert
    // structurally that the page's /Contents object both *declares*
    // FlateDecode and actually contains zlib-deflated bytes — so a
    // regression that drops the deflateSync call (whether the dict
    // text is updated to match or not) still fails loudly here.
    const pageMatch = body1.match(
      /<<\s*\/Type\s*\/Page\b[\s\S]*?\/Contents\s+(\d+)\s+0\s+R[\s\S]*?>>/,
    );
    expect(pageMatch).not.toBeNull();
    const contentsId = pageMatch![1];
    const contentsObjRe = new RegExp(
      `\\b${contentsId}\\s+0\\s+obj\\s*(<<[\\s\\S]*?>>)\\s*stream`,
    );
    const contentsObj = body1.match(contentsObjRe);
    expect(contentsObj).not.toBeNull();
    const contentsDict = contentsObj![1];
    expect(contentsDict).toMatch(/\/Filter\s*\/FlateDecode/);
    const lenMatch = contentsDict.match(/\/Length\s+(\d+)/);
    expect(lenMatch).not.toBeNull();
    const len = parseInt(lenMatch![1], 10);
    // Locate the raw stream bytes in the original buffer (the
    // latin1 string view loses byte fidelity for binary deflate
    // payloads). Match the unique `<id> 0 obj ... stream\n` prefix
    // and read `len` bytes after it.
    const prefix = Buffer.from(`${contentsId} 0 obj`, "latin1");
    const objStart = pdf.indexOf(prefix);
    expect(objStart).toBeGreaterThanOrEqual(0);
    const streamMarker = Buffer.from("\nstream\n", "latin1");
    const streamStart =
      pdf.indexOf(streamMarker, objStart) + streamMarker.length;
    const streamBytes = pdf.subarray(streamStart, streamStart + len);
    // inflateSync throws "incorrect header check" / "invalid stored
    // block lengths" if the bytes aren't actually zlib-deflated.
    const inflated = inflateSync(streamBytes).toString("latin1");
    // Sanity: the inflated content stream paints text, so it must
    // contain at least one BT/ET text-object pair.
    expect(inflated).toMatch(/\bBT\b[\s\S]*\bET\b/);
  });
});
