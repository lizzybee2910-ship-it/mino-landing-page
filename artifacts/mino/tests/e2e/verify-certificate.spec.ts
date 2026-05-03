import { expect, test } from "@playwright/test";

/**
 * Frontend tests for the public certificate verification page.
 *
 * The page must be reachable without signing in, must render the
 * member's display name + course title + issue date when the api
 * confirms the certificate, and must surface a friendly "not found"
 * card when the api returns 404.
 */

test.describe("Public certificate verification", () => {
  test("renders the genuine-certificate card when the API returns valid metadata", async ({
    page,
  }) => {
    // No /api/auth/user mock on purpose — the page must be reachable
    // without an authenticated session.
    await page.route("**/api/learn/verify/MINO-FOO-DEADBEEF", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          valid: true,
          certificateId: "MINO-FOO-DEADBEEF",
          courseSlug: "foo",
          courseTitle: "Foo Course",
          memberName: "Jane Practitioner",
          issuedAt: "2025-04-15T00:00:00Z",
          issuer: "(mino)",
        }),
      }),
    );

    await page.goto("/verify/MINO-FOO-DEADBEEF");

    await expect(page.getByTestId("verify-valid")).toBeVisible();
    await expect(page.getByTestId("verify-course-title")).toHaveText(
      "Foo Course",
    );
    await expect(page.getByTestId("verify-member-name")).toHaveText(
      "Jane Practitioner",
    );
    await expect(page.getByTestId("verify-certificate-id")).toContainText(
      "MINO-FOO-DEADBEEF",
    );
    await expect(page.getByTestId("verify-invalid")).toHaveCount(0);
  });

  test("renders the not-found card when the API returns 404", async ({
    page,
  }) => {
    await page.route("**/api/learn/verify/MINO-MISSING-0000", (route) =>
      route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ valid: false, error: "Certificate not found." }),
      }),
    );

    await page.goto("/verify/MINO-MISSING-0000");

    await expect(page.getByTestId("verify-invalid")).toBeVisible();
    await expect(page.getByTestId("verify-error")).toContainText(
      "doesn't match any record",
    );
    await expect(page.getByTestId("verify-valid")).toHaveCount(0);
  });
});
