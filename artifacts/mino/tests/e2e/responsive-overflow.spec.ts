import { expect, test, type Page } from "@playwright/test";

/**
 * Catches horizontal-overflow regressions on every top-level landing page
 * route.
 *
 * The mino app's editorial spreads use a lot of full-bleed, absolutely
 * positioned tags and oversized headlines. A future spread or copy edit on
 * any of the registered routes could easily reintroduce horizontal overflow
 * on small viewports — this test loads each route at common widths, scrolls
 * top-to-bottom, and asserts that the document never grows wider than the
 * viewport.
 *
 * Routes are kept in sync with `src/App.tsx`. When a new route is added
 * there, add it here too. The 404 fallback is also covered by hitting an
 * unregistered path so layout regressions on it don't slip through.
 */

const VIEWPORTS = [
  { name: "mobile-375", width: 375, height: 800 },
  { name: "mobile-400", width: 400, height: 800 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 800 },
] as const;

// Each route declares the testid Playwright should wait on before measuring,
// so the page is guaranteed to have rendered its main content.
const ROUTES = [
  { name: "home", path: "/", readySelector: '[data-testid="home-main"]' },
  {
    name: "catalog",
    path: "/catalog",
    readySelector: '[data-testid="catalog-masthead"]',
  },
  {
    name: "not-found",
    path: "/__definitely_not_a_real_route__",
    readySelector: '[data-testid="not-found-root"]',
  },
] as const;

// Sub-pixel tolerance: layout measurements can round to the nearest pixel
// in different ways across browsers and zoom levels. 1px is plenty safe
// without masking real overflow regressions.
const OVERFLOW_TOLERANCE_PX = 1;

async function getOverflowReport(page: Page) {
  return page.evaluate(() => {
    const docEl = document.documentElement;
    const body = document.body;
    const viewport = window.innerWidth;
    const docWidth = Math.max(
      docEl.scrollWidth,
      body ? body.scrollWidth : 0,
      docEl.offsetWidth,
      body ? body.offsetWidth : 0,
    );

    // Identify the worst offenders so test failures are actionable.
    const offenders: { selector: string; right: number; width: number }[] = [];
    const all = document.querySelectorAll<HTMLElement>("body *");
    for (const el of Array.from(all)) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.right > viewport + 1) {
        const id = el.id ? `#${el.id}` : "";
        const cls = el.className && typeof el.className === "string"
          ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}`
          : "";
        const testId = el.getAttribute("data-testid");
        const tag = el.tagName.toLowerCase();
        const selector = testId
          ? `${tag}[data-testid="${testId}"]`
          : `${tag}${id}${cls}`;
        offenders.push({
          selector,
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        });
        if (offenders.length >= 5) break;
      }
    }

    return { docWidth, viewport, offenders };
  });
}

async function assertNoHorizontalOverflow(page: Page, label: string) {
  const report = await getOverflowReport(page);
  const message =
    `[${label}] horizontal overflow detected: documentWidth=${report.docWidth}px, ` +
    `viewportWidth=${report.viewport}px. ` +
    (report.offenders.length > 0
      ? `Top offenders: ${JSON.stringify(report.offenders)}`
      : "No specific offenders found, check for body/root level overflow.");

  expect(report.docWidth, message).toBeLessThanOrEqual(
    report.viewport + OVERFLOW_TOLERANCE_PX,
  );
}

async function scrollAndCheck(page: Page, viewportLabel: string) {
  // Scroll the page top-to-bottom in viewport-sized steps, asserting no
  // horizontal overflow at each stop. A single check at the top is not
  // enough because some spreads only render their full-bleed elements
  // once they enter the viewport (lazy images, FadeIn animations, etc).
  const totalHeight: number = await page.evaluate(
    () => document.documentElement.scrollHeight,
  );
  const viewportHeight: number = await page.evaluate(() => window.innerHeight);
  const step = Math.max(200, Math.floor(viewportHeight * 0.75));

  // Initial check at the top of the page.
  await assertNoHorizontalOverflow(page, `${viewportLabel} @ y=0`);

  for (let y = step; y < totalHeight; y += step) {
    await page.evaluate((targetY) => window.scrollTo(0, targetY), y);
    // Give layout / transitions a moment to settle.
    await page.waitForTimeout(150);
    await assertNoHorizontalOverflow(page, `${viewportLabel} @ y=${y}`);
  }

  // Final check at the very bottom.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(150);
  await assertNoHorizontalOverflow(page, `${viewportLabel} @ bottom`);
}

for (const route of ROUTES) {
  for (const vp of VIEWPORTS) {
    test(`${route.name} (${route.path}) has no horizontal overflow at ${vp.name} (${vp.width}x${vp.height})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(route.path, { waitUntil: "networkidle" });

      // Wait for the route's main content to be in the DOM so we know the
      // page is actually rendered before measuring.
      await page.waitForSelector(route.readySelector, { timeout: 15_000 });

      await scrollAndCheck(page, `${route.name} ${vp.name}`);
    });
  }
}
