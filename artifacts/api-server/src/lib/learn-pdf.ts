/**
 * High-level PDF renderers for the learn surface: completion certificates
 * and per-course handouts. Both share the (mino) editorial styling
 * (forest green + sage accents on a cream background, serif-feeling
 * Helvetica typography) so downloads look like part of the magazine.
 */

import { PdfBuilder, measureText, wrapText } from "./pdf";

const COLOR_FOREST: [number, number, number] = [0.105, 0.196, 0.149];
const COLOR_INK: [number, number, number] = [0.063, 0.118, 0.094];
const COLOR_FOREST_70: [number, number, number] = [0.373, 0.435, 0.404];
const COLOR_SAGE_DEEP: [number, number, number] = [0.388, 0.498, 0.345];
const COLOR_CREAM: [number, number, number] = [0.973, 0.957, 0.918];
const COLOR_BONE: [number, number, number] = [0.929, 0.91, 0.855];

export interface CertificateInput {
  courseTitle: string;
  courseSubtitle: string;
  memberName: string;
  completedAt: Date;
  /** Stable identifier rendered in the footer for verification. */
  certificateId: string;
  /**
   * Public, unauthenticated URL where a third party can confirm the
   * certificate is genuine. Rendered in the footer below the brand line
   * so anyone holding a printed copy can type it in.
   */
  verifyUrl?: string;
}

/**
 * Render the completion certificate as a landscape Letter PDF.
 */
export function renderCertificatePdf(input: CertificateInput): Buffer {
  const width = 792;
  const height = 612;
  const doc = new PdfBuilder({
    width,
    height,
    background: COLOR_CREAM,
  });

  // Decorative inner border (double rule).
  const innerMargin = 36;
  doc.fillRect(innerMargin, innerMargin, width - innerMargin * 2, 1.4, COLOR_FOREST);
  doc.fillRect(innerMargin, height - innerMargin - 1.4, width - innerMargin * 2, 1.4, COLOR_FOREST);
  doc.fillRect(innerMargin, innerMargin, 1.4, height - innerMargin * 2, COLOR_FOREST);
  doc.fillRect(width - innerMargin - 1.4, innerMargin, 1.4, height - innerMargin * 2, COLOR_FOREST);

  // Top eyebrow band.
  const eyebrowY = height - 100;
  doc.fillRect(innerMargin + 30, eyebrowY + 6, 28, 1, COLOR_SAGE_DEEP);
  doc.drawText("VOL. II  ·  CERTIFICATE OF COMPLETION", innerMargin + 70, eyebrowY, {
    font: "bold",
    size: 10,
    color: COLOR_SAGE_DEEP,
  });

  // Brand mark in the top-right.
  doc.drawText("(mino)", width - innerMargin - 30, eyebrowY, {
    font: "bold",
    size: 16,
    color: COLOR_FOREST,
    align: "right",
  });

  // Headline.
  doc.drawText("This certifies that", width / 2, height - 170, {
    font: "italic",
    size: 14,
    color: COLOR_FOREST_70,
    align: "center",
  });

  // Member name (large, centered, with bottom rule).
  const namePlate = sanitizeName(input.memberName);
  const nameSize = pickNameSize(namePlate, width - innerMargin * 2 - 60);
  doc.drawText(namePlate, width / 2, height - 230, {
    font: "bold",
    size: nameSize,
    color: COLOR_INK,
    align: "center",
  });
  // Underline beneath the name.
  const nameWidth = measureText(namePlate, "bold", nameSize);
  const underlineWidth = Math.min(width - innerMargin * 2 - 80, Math.max(220, nameWidth + 60));
  doc.fillRect(
    (width - underlineWidth) / 2,
    height - 245,
    underlineWidth,
    0.7,
    COLOR_FOREST_70,
  );

  // Recital.
  doc.drawText("has completed every lesson in", width / 2, height - 285, {
    font: "regular",
    size: 13,
    color: COLOR_FOREST_70,
    align: "center",
  });

  // Course title (wrapped if long).
  const titleMaxWidth = width - innerMargin * 2 - 80;
  const titleSize = 26;
  const titleLines = wrapText(input.courseTitle, "bold", titleSize, titleMaxWidth);
  let titleY = height - 330;
  for (const line of titleLines) {
    doc.drawText(line, width / 2, titleY, {
      font: "bold",
      size: titleSize,
      color: COLOR_FOREST,
      align: "center",
    });
    titleY -= titleSize * 1.15;
  }

  // Course subtitle.
  if (input.courseSubtitle) {
    doc.drawText(input.courseSubtitle, width / 2, titleY - 4, {
      font: "italic",
      size: 12,
      color: COLOR_FOREST_70,
      align: "center",
      maxWidth: titleMaxWidth,
    });
  }

  // Completion date in a small framed badge.
  const dateLabel = formatDate(input.completedAt);
  const badgeWidth = 260;
  const badgeHeight = 56;
  const badgeX = (width - badgeWidth) / 2;
  const badgeY = innerMargin + 90;
  doc.fillRect(badgeX, badgeY, badgeWidth, badgeHeight, COLOR_BONE);
  doc.drawText("AWARDED", width / 2, badgeY + badgeHeight - 18, {
    font: "bold",
    size: 9,
    color: COLOR_SAGE_DEEP,
    align: "center",
  });
  doc.drawText(dateLabel, width / 2, badgeY + 18, {
    font: "bold",
    size: 16,
    color: COLOR_FOREST,
    align: "center",
  });

  // Footer with certificate id, brand mark, and (when provided) the
  // public verification URL so a third party with a printed copy can
  // confirm authenticity.
  const hasVerify = Boolean(input.verifyUrl);
  const idY = hasVerify ? innerMargin + 36 : innerMargin + 24;
  const brandY = hasVerify ? innerMargin + 24 : innerMargin + 12;
  doc.drawText(
    `Certificate ID: ${input.certificateId}`,
    width / 2,
    idY,
    {
      font: "regular",
      size: 9,
      color: COLOR_FOREST_70,
      align: "center",
    },
  );
  doc.drawText(
    "(mino) — the magazine, the library, the practice.",
    width / 2,
    brandY,
    {
      font: "italic",
      size: 9,
      color: COLOR_FOREST_70,
      align: "center",
    },
  );
  if (input.verifyUrl) {
    doc.drawText(
      `Verify at ${input.verifyUrl}`,
      width / 2,
      innerMargin + 12,
      {
        font: "regular",
        size: 9,
        color: COLOR_SAGE_DEEP,
        align: "center",
      },
    );
  }

  return doc.toBuffer();
}

function pickNameSize(name: string, maxWidth: number): number {
  for (const size of [44, 38, 32, 26, 22]) {
    if (measureText(name, "bold", size) <= maxWidth) return size;
  }
  return 20;
}

function sanitizeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "Member";
  return trimmed;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export interface HandoutInput {
  courseTitle: string;
  handoutTitle: string;
  handoutDescription: string;
  body: string;
}

/**
 * Render a per-course handout as a portrait Letter PDF. The body is
 * plain text where a leading "- " marks a bullet list item and blank
 * lines separate paragraphs.
 */
export function renderHandoutPdf(input: HandoutInput): Buffer {
  const width = 612;
  const height = 792;
  const doc = new PdfBuilder({
    width,
    height,
    background: COLOR_CREAM,
  });

  const margin = 60;
  const contentWidth = width - margin * 2;

  // Eyebrow.
  doc.fillRect(margin, height - margin - 14, 24, 1, COLOR_SAGE_DEEP);
  doc.drawText(
    `(MINO) HANDOUT  ·  ${input.courseTitle.toUpperCase()}`,
    margin + 32,
    height - margin - 18,
    { font: "bold", size: 9, color: COLOR_SAGE_DEEP },
  );

  // Title.
  let cursor = doc.drawTextBlock(input.handoutTitle, margin, height - margin - 50, {
    font: "bold",
    size: 28,
    color: COLOR_FOREST,
    maxWidth: contentWidth,
    lineHeight: 1.1,
  });

  // Description (if any).
  if (input.handoutDescription) {
    cursor -= 8;
    cursor = doc.drawTextBlock(
      input.handoutDescription,
      margin,
      cursor,
      {
        font: "italic",
        size: 13,
        color: COLOR_FOREST_70,
        maxWidth: contentWidth,
        lineHeight: 1.35,
      },
    );
  }

  // Section rule.
  cursor -= 14;
  doc.hRule(margin, cursor, contentWidth, COLOR_FOREST, 0.6);
  cursor -= 22;

  // Body paragraphs (and bullets).
  const paragraphs = input.body.split(/\n{2,}/);
  for (const raw of paragraphs) {
    const para = raw.trim();
    if (!para) continue;

    // Page-break safety: if we're getting close to the bottom margin,
    // stop rendering further content. (Single-page handouts only.)
    if (cursor < margin + 60) break;

    if (para.startsWith("- ")) {
      // Bullet list block.
      const items = para
        .split(/\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith("- "))
        .map((line) => line.slice(2).trim());
      for (const item of items) {
        if (cursor < margin + 60) break;
        doc.drawText("•", margin, cursor, {
          font: "bold",
          size: 12,
          color: COLOR_SAGE_DEEP,
        });
        cursor = doc.drawTextBlock(item, margin + 16, cursor, {
          font: "regular",
          size: 12,
          color: COLOR_INK,
          maxWidth: contentWidth - 16,
          lineHeight: 1.4,
        });
        cursor -= 4;
      }
      cursor -= 4;
    } else {
      cursor = doc.drawTextBlock(para, margin, cursor, {
        font: "regular",
        size: 12,
        color: COLOR_INK,
        maxWidth: contentWidth,
        lineHeight: 1.45,
      });
      cursor -= 8;
    }
  }

  // Footer rule + caption.
  doc.hRule(margin, margin + 26, contentWidth, COLOR_FOREST_70, 0.4);
  doc.drawText("(mino) — the library", margin, margin + 12, {
    font: "italic",
    size: 9,
    color: COLOR_FOREST_70,
  });
  doc.drawText(
    `Generated ${formatDate(new Date())}`,
    width - margin,
    margin + 12,
    {
      font: "regular",
      size: 9,
      color: COLOR_FOREST_70,
      align: "right",
    },
  );

  return doc.toBuffer();
}
