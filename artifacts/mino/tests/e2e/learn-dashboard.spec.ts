import { expect, test } from "@playwright/test";

/**
 * Frontend regression tests for the /learn/me dashboard.
 *
 * The dashboard branches on three things that are easy to break in a
 * refactor: the empty state, the per-card resume label ("Start course" vs
 * "Resume" vs "Review course"), and the progress bar width. We mock both
 * `/api/auth/user` (so the route guard lets us in) and `/api/learn/me`
 * (so we don't depend on real data) and then assert the rendered DOM.
 */

const AUTH_USER = {
  user: {
    id: "u_test",
    email: "tester@example.com",
    firstName: "Test",
    lastName: "User",
    profileImageUrl: null,
  },
};

interface DashItem {
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  duration: string;
  audience: string;
  icon: string;
  color: string;
  moduleCount: number;
  lessonCount: number;
  completedLessons: number;
  progressPercent: number;
  enrolledAt: string;
  lastActivityAt: string;
  completed: boolean;
  nextLesson:
    | { slug: string; title: string; duration: string; position: number }
    | null;
}

function dashItem(overrides: Partial<DashItem>): DashItem {
  return {
    slug: "course-x",
    title: "Course X",
    subtitle: "A test course",
    category: "business",
    duration: "1h",
    audience: "Everyone",
    icon: "book",
    color: "#000",
    moduleCount: 1,
    lessonCount: 4,
    completedLessons: 0,
    progressPercent: 0,
    enrolledAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    completed: false,
    nextLesson: {
      slug: "lesson-1",
      title: "First lesson",
      duration: "10m",
      position: 1,
    },
    ...overrides,
  };
}

test.describe("Learn dashboard", () => {
  test.beforeEach(async ({ page }) => {
    // Pretend the visitor is signed in so RequireAuth lets us through.
    await page.route("**/api/auth/user", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(AUTH_USER),
      }),
    );
  });

  test("shows the empty state when the member has no enrollments", async ({
    page,
  }) => {
    await page.route("**/api/learn/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [] }),
      }),
    );
    await page.route("**/api/learn/me/certificates", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [] }),
      }),
    );

    await page.goto("/learn/me");

    await expect(page.getByTestId("dashboard-empty")).toBeVisible();
    await expect(page.getByTestId("link-browse-empty")).toBeVisible();
    // The course-list container must NOT be present when there are no items.
    await expect(page.getByTestId("dashboard-list")).toHaveCount(0);
    // No achievements yet either.
    await expect(page.getByTestId("dashboard-certificates")).toHaveCount(0);
  });

  test("renders the achievements section listing every earned certificate", async ({
    page,
  }) => {
    await page.route("**/api/learn/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [] }),
      }),
    );
    await page.route("**/api/learn/me/certificates", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              certificateId: "MINO-ALPHA-1234",
              courseSlug: "alpha",
              courseTitle: "Alpha Course",
              courseSubtitle: "Sub A",
              courseIcon: "book",
              courseCategory: "business",
              issuedAt: "2025-09-01T00:00:00Z",
              downloadUrl: "/api/learn/courses/alpha/certificate",
              verifyUrl: "https://example.com/verify/MINO-ALPHA-1234",
            },
            {
              certificateId: "MINO-BETA-5678",
              courseSlug: "beta",
              courseTitle: "Beta Course",
              courseSubtitle: "Sub B",
              courseIcon: "book",
              courseCategory: "clinical",
              issuedAt: "2025-08-01T00:00:00Z",
              downloadUrl: "/api/learn/courses/beta/certificate",
              verifyUrl: "https://example.com/verify/MINO-BETA-5678",
            },
          ],
        }),
      }),
    );

    await page.goto("/learn/me");

    await expect(page.getByTestId("dashboard-certificates")).toBeVisible();
    await expect(page.getByTestId("certificate-card-alpha")).toBeVisible();
    await expect(page.getByTestId("certificate-card-beta")).toBeVisible();
    await expect(
      page.getByTestId("certificate-card-download-alpha"),
    ).toHaveAttribute("href", "/api/learn/courses/alpha/certificate");
    await expect(
      page.getByTestId("certificate-card-verify-beta"),
    ).toHaveAttribute(
      "href",
      "https://example.com/verify/MINO-BETA-5678",
    );
    // Issue date is rendered as a readable string (e.g. "September 1, 2025").
    await expect(
      page.getByTestId("certificate-card-title-alpha"),
    ).toContainText("Alpha Course");
  });

  test("renders the right resume label and progress bar for each card", async ({
    page,
  }) => {
    const items: DashItem[] = [
      // Brand new enrollment → label should be "Start course".
      dashItem({
        slug: "fresh",
        title: "Fresh Course",
        completedLessons: 0,
        progressPercent: 0,
        completed: false,
        lastActivityAt: new Date(Date.now() - 1000).toISOString(),
        nextLesson: {
          slug: "intro",
          title: "Intro lesson",
          duration: "8m",
          position: 1,
        },
      }),
      // Partially complete → label should be "Resume".
      dashItem({
        slug: "midway",
        title: "Midway Course",
        completedLessons: 2,
        lessonCount: 4,
        progressPercent: 50,
        completed: false,
        lastActivityAt: new Date(Date.now() - 2000).toISOString(),
        nextLesson: {
          slug: "halfway",
          title: "Halfway lesson",
          duration: "12m",
          position: 3,
        },
      }),
      // Fully complete → label should be "Review course".
      dashItem({
        slug: "donezo",
        title: "Done Course",
        completedLessons: 3,
        lessonCount: 3,
        progressPercent: 100,
        completed: true,
        lastActivityAt: new Date(Date.now() - 3000).toISOString(),
        nextLesson: null,
      }),
    ];

    await page.route("**/api/learn/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items }),
      }),
    );

    await page.goto("/learn/me");

    await expect(page.getByTestId("dashboard-list")).toBeVisible();

    // Resume buttons: each card's button should have the right label.
    await expect(page.getByTestId("dashboard-card-resume-fresh")).toHaveText(
      /Start course/,
    );
    await expect(page.getByTestId("dashboard-card-resume-midway")).toHaveText(
      /Resume/,
    );
    await expect(page.getByTestId("dashboard-card-resume-donezo")).toHaveText(
      /Review course/,
    );

    // Completed card shows the "Complete" badge instead of the category.
    await expect(
      page.getByTestId("dashboard-card-complete-donezo"),
    ).toBeVisible();

    // Progress percent text mirrors the API value.
    await expect(page.getByTestId("dashboard-card-percent-fresh")).toHaveText(
      "0%",
    );
    await expect(page.getByTestId("dashboard-card-percent-midway")).toHaveText(
      "50%",
    );
    await expect(page.getByTestId("dashboard-card-percent-donezo")).toHaveText(
      "100%",
    );

    // Progress bar width comes from the API value.
    await expect(
      page.getByTestId("dashboard-card-progress-fresh"),
    ).toHaveAttribute("style", /width:\s*0%/);
    await expect(
      page.getByTestId("dashboard-card-progress-midway"),
    ).toHaveAttribute("style", /width:\s*50%/);
    await expect(
      page.getByTestId("dashboard-card-progress-donezo"),
    ).toHaveAttribute("style", /width:\s*100%/);

    // Resume link points at the next-incomplete lesson when there is one,
    // and at the course overview when the course is fully complete.
    await expect(
      page.getByTestId("dashboard-card-resume-fresh"),
    ).toHaveAttribute("href", "/learn/fresh/intro");
    await expect(
      page.getByTestId("dashboard-card-resume-midway"),
    ).toHaveAttribute("href", "/learn/midway/halfway");
    await expect(
      page.getByTestId("dashboard-card-resume-donezo"),
    ).toHaveAttribute("href", "/learn/donezo");

    // Empty state must not be rendered when there are items.
    await expect(page.getByTestId("dashboard-empty")).toHaveCount(0);
  });
});
