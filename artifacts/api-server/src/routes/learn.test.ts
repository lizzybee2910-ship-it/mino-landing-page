/**
 * Integration tests for GET /api/learn/me.
 *
 * These tests boot a small Express app that mounts the real learn router
 * behind a stubbed auth middleware (so we don't need OIDC), and they read
 * and write the real Postgres database — but isolated under a unique slug
 * prefix per run so fixtures never collide with seeded catalog data or
 * other concurrent runs.
 *
 * Branches covered (see task #34):
 *   1. No enrollments → empty `items`.
 *   2. Multiple enrollments → sorted by `lastActivityAt` (most recent first).
 *   3. All lessons complete → `nextLesson` is null and `completed` is true.
 *   4. Enrollment with zero lessons → `nextLesson` null, percent 0.
 */

import { inflateSync } from "node:zlib";

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import express from "express";
import request from "supertest";
import type { NextFunction, Request, Response } from "express";
import type { Express } from "express";
import { eq, inArray } from "drizzle-orm";

import learnRouter from "./learn";
import {
  db,
  pool,
  learnCoursesTable,
  learnModulesTable,
  learnLessonsTable,
  learnEnrollmentsTable,
  learnLessonProgressTable,
  learnCourseHandoutsTable,
  learnCertificatesTable,
  usersTable,
} from "@workspace/db";

// Inflate every `/Filter /FlateDecode` stream in `pdf` and return a
// latin1 string with each compressed body replaced by its inflated
// bytes. Lets us assert against visible text inside content streams,
// which the PDF assembler now zlib-compresses by default.
function inflateAllFlateStreams(pdf: Buffer): string {
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

// Unique-per-process prefix keeps every run's fixtures siloed even when two
// CI shards hit the same database.
const RUN_ID = `t${process.pid}-${Date.now().toString(36)}`;
const SLUG_PREFIX = `__test_dash_${RUN_ID}__`;
const courseSlug = (suffix: string) => `${SLUG_PREFIX}${suffix}`;

let app: Express;
let currentUserId: string;

/**
 * Build a tiny Express app that wires up the real learn router behind a
 * stub-auth middleware. The stub injects `req.user` and `req.isAuthenticated`
 * exactly the way the production `authMiddleware` does, so `requireAuth`
 * and the route handlers cannot tell the difference.
 */
function buildTestApp(): Express {
  const a = express();
  a.use(express.json());
  a.use((req: Request, _res: Response, next: NextFunction) => {
    req.isAuthenticated = function (this: Request) {
      return this.user != null;
    } as Request["isAuthenticated"];
    if (currentUserId) {
      req.user = {
        id: currentUserId,
        email: `${currentUserId}@test.local`,
        firstName: null,
        lastName: null,
        profileImageUrl: null,
      };
    }
    next();
  });
  a.use("/api", learnRouter);
  return a;
}

beforeAll(() => {
  // Ensure DATABASE_URL is set up — @workspace/db throws on import otherwise.
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set to run learn integration tests");
  }
  app = buildTestApp();
});

beforeEach(async () => {
  // Wipe any rows this run created so each test starts from a known state.
  // Cascades remove the matching enrollments, modules, lessons, and progress.
  if (currentUserId) {
    await db
      .delete(learnEnrollmentsTable)
      .where(eq(learnEnrollmentsTable.userId, currentUserId));
    await db
      .delete(learnLessonProgressTable)
      .where(eq(learnLessonProgressTable.userId, currentUserId));
    await db
      .delete(learnCertificatesTable)
      .where(eq(learnCertificatesTable.userId, currentUserId));
  }
  await db
    .delete(usersTable)
    .where(eq(usersTable.email, `${RUN_ID}@test.local`));

  const [user] = await db
    .insert(usersTable)
    .values({
      email: `${RUN_ID}@test.local`,
      firstName: "Dash",
      lastName: "Tester",
      emailVerified: "true",
    })
    .returning({ id: usersTable.id });
  currentUserId = user!.id;
});

afterAll(async () => {
  // Clean up all fixture courses created across the run. Cascades take care
  // of modules, lessons, enrollments, and lesson_progress rows.
  const fixtureCourses = await db
    .select({ slug: learnCoursesTable.slug })
    .from(learnCoursesTable);
  const ourSlugs = fixtureCourses
    .map((c) => c.slug)
    .filter((s) => s.startsWith(SLUG_PREFIX));
  if (ourSlugs.length > 0) {
    await db
      .delete(learnCoursesTable)
      .where(inArray(learnCoursesTable.slug, ourSlugs));
  }
  // Remove the test user too.
  await db
    .delete(usersTable)
    .where(eq(usersTable.email, `${RUN_ID}@test.local`));

  await pool.end();
});

interface SeedLesson {
  slug: string;
  title: string;
  position: number;
}

interface SeedCourse {
  slug: string;
  title: string;
  subtitle?: string;
  position?: number;
  lessons: SeedLesson[];
}

/**
 * Insert a course with one module and N lessons. Returns the created
 * lesson rows (id-bearing) so callers can reference them in progress
 * inserts.
 */
async function seedCourse(course: SeedCourse) {
  await db.insert(learnCoursesTable).values({
    slug: course.slug,
    title: course.title,
    subtitle: course.subtitle ?? "Test subtitle",
    description: "Test description",
    audience: "Test audience",
    duration: "1h",
    category: "business",
    icon: "book",
    color: "#000",
    outcomes: ["learn things"],
    position: course.position ?? 0,
  });
  const moduleId = `${course.slug}-mod-1`;
  await db.insert(learnModulesTable).values({
    id: moduleId,
    courseSlug: course.slug,
    position: 1,
    title: "Module 1",
    duration: "30m",
    objective: "Test the dashboard",
  });
  if (course.lessons.length === 0) return { moduleId, lessons: [] };
  const lessonRows = await db
    .insert(learnLessonsTable)
    .values(
      course.lessons.map((l) => ({
        id: `${course.slug}-${l.slug}`,
        moduleId,
        courseSlug: course.slug,
        slug: l.slug,
        position: l.position,
        title: l.title,
        duration: "10m",
        contentItems: [{ type: "text" as const, body: "hello" }],
        quiz: null,
      })),
    )
    .returning();
  return { moduleId, lessons: lessonRows };
}

async function enroll(slug: string, enrolledAt?: Date) {
  await db.insert(learnEnrollmentsTable).values({
    userId: currentUserId,
    courseSlug: slug,
    ...(enrolledAt ? { enrolledAt } : {}),
  });
}

async function completeLesson(
  lessonId: string,
  cSlug: string,
  completedAt: Date,
) {
  await db.insert(learnLessonProgressTable).values({
    userId: currentUserId,
    lessonId,
    courseSlug: cSlug,
    completed: true,
    completedAt,
  });
}

interface DashboardItem {
  slug: string;
  title: string;
  lessonCount: number;
  completedLessons: number;
  progressPercent: number;
  completed: boolean;
  enrolledAt: string;
  lastActivityAt: string;
  nextLesson: { slug: string; title: string } | null;
}

async function getDashboard(): Promise<DashboardItem[]> {
  const res = await request(app).get("/api/learn/me");
  expect(res.status).toBe(200);
  return (res.body as { items: DashboardItem[] }).items;
}

describe("GET /api/learn/me", () => {
  test("returns an empty list when the caller has no enrollments", async () => {
    const items = await getDashboard();
    expect(items).toEqual([]);
  });

  test("sorts enrolled courses by most recent activity first", async () => {
    // Course A: enrolled long ago, no recent progress.
    const a = await seedCourse({
      slug: courseSlug("alpha"),
      title: "Alpha",
      position: 1,
      lessons: [
        { slug: "a1", title: "A1", position: 1 },
        { slug: "a2", title: "A2", position: 2 },
      ],
    });
    // Course B: enrolled even longer ago, but has a very recent completion.
    const b = await seedCourse({
      slug: courseSlug("beta"),
      title: "Beta",
      position: 2,
      lessons: [
        { slug: "b1", title: "B1", position: 1 },
        { slug: "b2", title: "B2", position: 2 },
      ],
    });
    // Course C: enrolled most recently, no progress.
    const c = await seedCourse({
      slug: courseSlug("gamma"),
      title: "Gamma",
      position: 3,
      lessons: [{ slug: "c1", title: "C1", position: 1 }],
    });

    // Enrollment timestamps are intentionally inverted vs. expected order
    // so the test proves activity is what's sorted on, not enrolledAt.
    const oldest = new Date("2023-06-01T00:00:00Z");
    const middle = new Date("2024-06-01T00:00:00Z");
    const justNowMinus5s = new Date(Date.now() - 5_000);

    await enroll(a.lessons[0]!.courseSlug, middle);
    await enroll(b.lessons[0]!.courseSlug, oldest);
    await enroll(c.lessons[0]!.courseSlug, justNowMinus5s);

    // Completion in B happens *now* — newer than C's enrollment → B wins.
    await completeLesson(
      b.lessons[0]!.id,
      b.lessons[0]!.courseSlug,
      new Date(),
    );

    const items = await getDashboard();
    expect(items.length).toBe(3);
    // Order: B (recent completion) > C (just-enrolled) > A (oldest enrollment).
    expect(items[0]!.slug).toBe(courseSlug("beta"));
    expect(items[1]!.slug).toBe(courseSlug("gamma"));
    expect(items[2]!.slug).toBe(courseSlug("alpha"));

    const beta = items[0]!;
    expect(beta.completedLessons).toBe(1);
    expect(beta.lessonCount).toBe(2);
    expect(beta.progressPercent).toBe(50);
    expect(beta.completed).toBe(false);
    // Next lesson should be the first incomplete one (b2, since b1 is done).
    expect(beta.nextLesson).not.toBeNull();
    expect(beta.nextLesson!.slug).toBe("b2");

    const alpha = items[2]!;
    expect(alpha.completedLessons).toBe(0);
    // Untouched course's nextLesson is the very first lesson.
    expect(alpha.nextLesson?.slug).toBe("a1");
  });

  test("returns nextLesson=null and completed=true when every lesson is finished", async () => {
    const c = await seedCourse({
      slug: courseSlug("done"),
      title: "Finished",
      position: 4,
      lessons: [
        { slug: "l1", title: "L1", position: 1 },
        { slug: "l2", title: "L2", position: 2 },
      ],
    });
    await enroll(c.lessons[0]!.courseSlug);
    const t = Date.now();
    await completeLesson(
      c.lessons[0]!.id,
      c.lessons[0]!.courseSlug,
      new Date(t - 1000),
    );
    await completeLesson(
      c.lessons[1]!.id,
      c.lessons[1]!.courseSlug,
      new Date(t),
    );

    const items = await getDashboard();
    expect(items.length).toBe(1);
    const item = items[0]!;
    expect(item.completedLessons).toBe(2);
    expect(item.lessonCount).toBe(2);
    expect(item.progressPercent).toBe(100);
    expect(item.completed).toBe(true);
    expect(item.nextLesson).toBeNull();
  });

  test("admin can create, edit, reorder, and delete handouts", async () => {
    // Promote current user to admin for the duration of this test.
    await db
      .update(usersTable)
      .set({ isAdmin: true })
      .where(eq(usersTable.id, currentUserId));

    const slug = courseSlug("adminflow");
    await seedCourse({ slug, title: "Admin Flow", position: 7, lessons: [] });

    // Seed an importer-owned handout to confirm editing flips isAuthored.
    await db.insert(learnCourseHandoutsTable).values({
      id: `${slug}__h1`,
      courseSlug: slug,
      position: 1,
      title: "Auto",
      description: "Auto desc",
      body: "Auto body",
      isAuthored: false,
    });

    // Empty list initially returns the importer row.
    const initial = await request(app).get(
      `/api/learn/admin/courses/${slug}/handouts`,
    );
    expect(initial.status).toBe(200);
    expect(initial.body.handouts.length).toBe(1);
    expect(initial.body.handouts[0].isAuthored).toBe(false);

    // Create two admin handouts.
    const c1 = await request(app)
      .post(`/api/learn/admin/courses/${slug}/handouts`)
      .send({ title: "First", description: "d1", body: "b1" });
    expect([200, 201]).toContain(c1.status);
    const c2 = await request(app)
      .post(`/api/learn/admin/courses/${slug}/handouts`)
      .send({ title: "Second", description: "d2", body: "b2" });
    expect([200, 201]).toContain(c2.status);
    const id1 = c1.body.id as string;
    const id2 = c2.body.id as string;

    // Edit the importer-owned handout — should flip isAuthored to true.
    const edit = await request(app)
      .patch(`/api/learn/admin/courses/${slug}/handouts/${slug}__h1`)
      .send({ title: "Edited Auto" });
    expect(edit.status).toBe(200);

    // Reorder: Second, First, Auto.
    const reorder = await request(app)
      .post(`/api/learn/admin/courses/${slug}/handouts/reorder`)
      .send({ ids: [id2, id1, `${slug}__h1`] });
    expect(reorder.status).toBe(200);

    const after = await request(app).get(
      `/api/learn/admin/courses/${slug}/handouts`,
    );
    expect(after.status).toBe(200);
    const handouts = after.body.handouts as Array<{
      id: string;
      title: string;
      position: number;
      isAuthored: boolean;
    }>;
    expect(handouts.map((h) => h.id)).toEqual([
      id2,
      id1,
      `${slug}__h1`,
    ]);
    expect(handouts.map((h) => h.position)).toEqual([1, 2, 3]);
    const editedAuto = handouts.find((h) => h.id === `${slug}__h1`)!;
    expect(editedAuto.title).toBe("Edited Auto");
    expect(editedAuto.isAuthored).toBe(true);

    // Delete one handout.
    const del = await request(app).delete(
      `/api/learn/admin/courses/${slug}/handouts/${id1}`,
    );
    expect(del.status).toBe(200);

    const final = await request(app).get(
      `/api/learn/admin/courses/${slug}/handouts`,
    );
    expect(final.body.handouts.map((h: { id: string }) => h.id)).toEqual([
      id2,
      `${slug}__h1`,
    ]);

    // Reset admin flag so other tests are unaffected.
    await db
      .update(usersTable)
      .set({ isAdmin: false })
      .where(eq(usersTable.id, currentUserId));
  });

  test("admin handout endpoints reject non-admin callers with 403", async () => {
    const slug = courseSlug("nonadmin");
    await seedCourse({ slug, title: "Non-admin", position: 6, lessons: [] });
    // Default test user is not admin.
    const status = await request(app).get("/api/learn/admin/status");
    expect(status.status).toBe(200);
    expect(status.body).toEqual({ isAdmin: false });

    const list = await request(app).get(
      `/api/learn/admin/courses/${slug}/handouts`,
    );
    expect(list.status).toBe(403);

    const create = await request(app)
      .post(`/api/learn/admin/courses/${slug}/handouts`)
      .send({ title: "X", description: "Y", body: "Z" });
    expect(create.status).toBe(403);
  });

  test("returns progress=0 and nextLesson=null for an enrollment with zero lessons", async () => {
    const slug = courseSlug("empty");
    // Seed a course but with no lessons in its module.
    await seedCourse({
      slug,
      title: "Empty Course",
      position: 5,
      lessons: [],
    });
    await enroll(slug);

    const items = await getDashboard();
    expect(items.length).toBe(1);
    const item = items[0]!;
    expect(item.slug).toBe(slug);
    expect(item.lessonCount).toBe(0);
    expect(item.completedLessons).toBe(0);
    expect(item.progressPercent).toBe(0);
    expect(item.completed).toBe(false);
    expect(item.nextLesson).toBeNull();
  });
});

describe("certificate persistence + verification", () => {
  /**
   * Helper that seeds a tiny one-lesson course, enrolls the current
   * test user, and marks the lesson complete so the certificate
   * endpoint will succeed.
   */
  async function seedCompletedCourse(suffix: string, title = "Cert Course") {
    const slug = courseSlug(suffix);
    const c = await seedCourse({
      slug,
      title,
      position: 10,
      lessons: [{ slug: "only", title: "Only Lesson", position: 1 }],
    });
    await enroll(slug);
    await completeLesson(c.lessons[0]!.id, slug, new Date());
    return slug;
  }

  test("downloading a certificate writes a learn_certificates row whose issuedAt is preserved across re-downloads", async () => {
    const slug = await seedCompletedCourse("persist", "Persistence");

    // First download — should create the row.
    const first = await request(app).get(
      `/api/learn/courses/${slug}/certificate`,
    );
    expect(first.status).toBe(200);
    expect(first.headers["content-type"]).toContain("application/pdf");
    // PDF should embed the public verify URL in its footer. The page
    // content stream is FlateDecode-compressed, so inflate it before
    // looking for visible strings.
    const firstBody = inflateAllFlateStreams(first.body);
    expect(firstBody).toContain("Verify at");
    expect(firstBody).toContain("/verify/");

    const certsAfter1 = await db
      .select()
      .from(learnCertificatesTable)
      .where(eq(learnCertificatesTable.userId, currentUserId));
    expect(certsAfter1.length).toBe(1);
    const issuedAt1 = certsAfter1[0]!.issuedAt.getTime();

    // Tiny pause so any "did the timestamp move?" bug would show up.
    await new Promise((r) => setTimeout(r, 25));

    const second = await request(app).get(
      `/api/learn/courses/${slug}/certificate`,
    );
    expect(second.status).toBe(200);

    const certsAfter2 = await db
      .select()
      .from(learnCertificatesTable)
      .where(eq(learnCertificatesTable.userId, currentUserId));
    expect(certsAfter2.length).toBe(1);
    expect(certsAfter2[0]!.issuedAt.getTime()).toBe(issuedAt1);
  });

  test("GET /api/learn/me/certificates returns every earned certificate, newest first", async () => {
    // No certificates yet → empty list.
    const empty = await request(app).get("/api/learn/me/certificates");
    expect(empty.status).toBe(200);
    expect(empty.body.items).toEqual([]);

    const slugA = await seedCompletedCourse("listA", "Alpha Cert");
    await request(app).get(`/api/learn/courses/${slugA}/certificate`);

    // Force a small delay so the second issuedAt is strictly later.
    await new Promise((r) => setTimeout(r, 25));

    const slugB = await seedCompletedCourse("listB", "Beta Cert");
    await request(app).get(`/api/learn/courses/${slugB}/certificate`);

    const list = await request(app).get("/api/learn/me/certificates");
    expect(list.status).toBe(200);
    const items = list.body.items as Array<{
      certificateId: string;
      courseSlug: string;
      courseTitle: string;
      issuedAt: string;
      downloadUrl: string;
      verifyUrl: string;
    }>;
    expect(items.length).toBe(2);
    // Newest first.
    expect(items[0]!.courseSlug).toBe(slugB);
    expect(items[1]!.courseSlug).toBe(slugA);
    // Each item exposes deterministic helper URLs.
    expect(items[0]!.downloadUrl).toBe(
      `/api/learn/courses/${encodeURIComponent(slugB)}/certificate`,
    );
    expect(items[0]!.verifyUrl).toContain(
      `/verify/${encodeURIComponent(items[0]!.certificateId)}`,
    );
  });

  test("GET /api/learn/verify/:id is unauthenticated and returns minimal metadata", async () => {
    const slug = await seedCompletedCourse("verify", "Verifiable Course");
    await request(app).get(`/api/learn/courses/${slug}/certificate`);

    const [cert] = await db
      .select()
      .from(learnCertificatesTable)
      .where(eq(learnCertificatesTable.userId, currentUserId));
    expect(cert).toBeDefined();

    // Build an *unauthenticated* test app that mounts the same router
    // but never sets req.user, to prove the verify endpoint sits in
    // front of requireAuth.
    const anon = express();
    anon.use(express.json());
    anon.use((req: Request, _res: Response, next: NextFunction) => {
      req.isAuthenticated = function (this: Request) {
        return this.user != null;
      } as Request["isAuthenticated"];
      next();
    });
    anon.use("/api", learnRouter);

    const ok = await request(anon).get(
      `/api/learn/verify/${encodeURIComponent(cert!.id)}`,
    );
    expect(ok.status).toBe(200);
    expect(ok.body.valid).toBe(true);
    expect(ok.body.certificateId).toBe(cert!.id);
    expect(ok.body.courseSlug).toBe(slug);
    expect(ok.body.courseTitle).toBe("Verifiable Course");
    expect(typeof ok.body.memberName).toBe("string");
    expect(ok.body.memberName.length).toBeGreaterThan(0);
    expect(typeof ok.body.issuedAt).toBe("string");
    expect(ok.body.issuer).toBe("(mino)");
    // No PII beyond what's on the PDF.
    expect(ok.body).not.toHaveProperty("email");
    expect(ok.body).not.toHaveProperty("userId");

    // A protected endpoint on the same anon app should still 401.
    const denied = await request(anon).get("/api/learn/me/certificates");
    expect(denied.status).toBe(401);

    // Unknown id returns 404 with valid=false.
    const missing = await request(anon).get(
      "/api/learn/verify/MINO-DOES-NOT-EXIST",
    );
    expect(missing.status).toBe(404);
    expect(missing.body.valid).toBe(false);
  });

  test("a member who has not completed a course gets no certificate row and no list entry", async () => {
    // Seed an enrolled course with one un-completed lesson.
    const slug = courseSlug("incomplete");
    await seedCourse({
      slug,
      title: "Incomplete",
      position: 11,
      lessons: [{ slug: "x", title: "X", position: 1 }],
    });
    await enroll(slug);

    const denied = await request(app).get(
      `/api/learn/courses/${slug}/certificate`,
    );
    expect(denied.status).toBe(409);

    const certs = await db
      .select()
      .from(learnCertificatesTable)
      .where(eq(learnCertificatesTable.userId, currentUserId));
    expect(certs.length).toBe(0);

    const list = await request(app).get("/api/learn/me/certificates");
    expect(list.body.items).toEqual([]);
  });
});
