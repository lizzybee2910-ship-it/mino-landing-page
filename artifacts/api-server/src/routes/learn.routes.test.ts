/**
 * Integration tests for the learn API endpoints other than GET /api/learn/me.
 *
 * Mirrors the isolation pattern used by `learn.test.ts`:
 *   - Boots a small Express app that mounts the real learn router behind
 *     a stub auth middleware (so we don't need OIDC).
 *   - Reads and writes the real Postgres database, but every fixture is
 *     scoped behind a unique per-process slug prefix so concurrent runs
 *     and seeded catalog data never collide.
 *
 * Branches covered (see tasks #48 and #63):
 *   - GET    /api/learn/courses                        (enrolled vs. not, progress percent)
 *   - GET    /api/learn/courses/:slug                  (404, modules + lessons + completed flag)
 *   - GET    /api/learn/courses/:slug/lessons/:lSlug   (403 when not enrolled, 404 when missing,
 *                                                       prev/next siblings across modules)
 *   - POST   /api/learn/courses/:slug/enroll           (404, idempotent)
 *   - POST   /api/learn/lessons/:lessonId/complete     (404, 403, 400, upsert + quiz score)
 *   - DELETE /api/learn/lessons/:lessonId/complete     (removes row, no-op when missing)
 *   - POST   /api/learn/lessons/:lessonId/view         (404, 403, first-call insert,
 *                                                       second-call upsert that bumps
 *                                                       last_viewed_at without duplicating)
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import express from "express";
import request from "supertest";
import type { NextFunction, Request, Response } from "express";
import type { Express } from "express";
import { and, eq, inArray } from "drizzle-orm";

import learnRouter from "./learn";
import {
  db,
  pool,
  learnCoursesTable,
  learnModulesTable,
  learnLessonsTable,
  learnEnrollmentsTable,
  learnLessonProgressTable,
  learnLessonViewsTable,
  usersTable,
} from "@workspace/db";

// Unique-per-process prefix keeps every run's fixtures siloed even when two
// CI shards (or this file and learn.test.ts) hit the same database.
const RUN_ID = `t${process.pid}-${Date.now().toString(36)}`;
const SLUG_PREFIX = `__test_routes_${RUN_ID}__`;
const courseSlug = (suffix: string) => `${SLUG_PREFIX}${suffix}`;

let app: Express;
let currentUserId: string;

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
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set to run learn integration tests");
  }
  app = buildTestApp();
});

beforeEach(async () => {
  // Wipe any rows created by the previous test for this user so each test
  // starts from a known state. Cascades from the user delete below would
  // also handle this, but doing the targeted deletes first is faster.
  if (currentUserId) {
    await db
      .delete(learnEnrollmentsTable)
      .where(eq(learnEnrollmentsTable.userId, currentUserId));
    await db
      .delete(learnLessonProgressTable)
      .where(eq(learnLessonProgressTable.userId, currentUserId));
    await db
      .delete(learnLessonViewsTable)
      .where(eq(learnLessonViewsTable.userId, currentUserId));
  }
  await db
    .delete(usersTable)
    .where(eq(usersTable.email, `${RUN_ID}@test.local`));

  const [user] = await db
    .insert(usersTable)
    .values({
      email: `${RUN_ID}@test.local`,
      firstName: "Routes",
      lastName: "Tester",
      emailVerified: "true",
    })
    .returning({ id: usersTable.id });
  currentUserId = user!.id;
});

afterAll(async () => {
  // Drop every fixture course this run created. Cascades clean up modules,
  // lessons, enrollments, and lesson_progress.
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
  await db
    .delete(usersTable)
    .where(eq(usersTable.email, `${RUN_ID}@test.local`));

  await pool.end();
});

interface SeedLesson {
  slug: string;
  title: string;
  position: number;
  /**
   * Index into the `modules` array passed alongside this lesson when seeding
   * a multi-module course. Defaults to 0 (the first module).
   */
  moduleIndex?: number;
}

interface SeedModule {
  title: string;
  duration?: string;
  objective?: string;
}

interface SeedCourse {
  slug: string;
  title: string;
  subtitle?: string;
  position?: number;
  modules?: SeedModule[];
  lessons: SeedLesson[];
}

/**
 * Insert a course with one or more modules and N lessons distributed across
 * those modules. Returns the created module + lesson rows so callers can
 * reference their ids.
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

  const modulesToSeed = course.modules ?? [{ title: "Module 1" }];
  const moduleRows = await db
    .insert(learnModulesTable)
    .values(
      modulesToSeed.map((m, i) => ({
        id: `${course.slug}-mod-${i + 1}`,
        courseSlug: course.slug,
        position: i + 1,
        title: m.title,
        duration: m.duration ?? "30m",
        objective: m.objective ?? "Test objective",
      })),
    )
    .returning();

  const lessonRows =
    course.lessons.length === 0
      ? []
      : await db
          .insert(learnLessonsTable)
          .values(
            course.lessons.map((l) => ({
              id: `${course.slug}-${l.slug}`,
              moduleId: moduleRows[l.moduleIndex ?? 0]!.id,
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

  return { modules: moduleRows, lessons: lessonRows };
}

async function enroll(slug: string) {
  await db
    .insert(learnEnrollmentsTable)
    .values({ userId: currentUserId, courseSlug: slug })
    .onConflictDoNothing();
}

async function completeLesson(lessonId: string, cSlug: string) {
  await db.insert(learnLessonProgressTable).values({
    userId: currentUserId,
    lessonId,
    courseSlug: cSlug,
    completed: true,
    completedAt: new Date(),
  });
}

describe("GET /api/learn/courses", () => {
  test("marks each course enrolled vs. not and computes progressPercent for completions", async () => {
    const enrolled = await seedCourse({
      slug: courseSlug("enrolled"),
      title: "Enrolled",
      lessons: [
        { slug: "l1", title: "L1", position: 1 },
        { slug: "l2", title: "L2", position: 2 },
        { slug: "l3", title: "L3", position: 3 },
        { slug: "l4", title: "L4", position: 4 },
      ],
    });
    const notEnrolled = await seedCourse({
      slug: courseSlug("not-enrolled"),
      title: "Not Enrolled",
      lessons: [
        { slug: "l1", title: "L1", position: 1 },
        { slug: "l2", title: "L2", position: 2 },
      ],
    });

    await enroll(enrolled.lessons[0]!.courseSlug);
    // Complete one of four lessons → 25%.
    await completeLesson(
      enrolled.lessons[0]!.id,
      enrolled.lessons[0]!.courseSlug,
    );

    const res = await request(app).get("/api/learn/courses");
    expect(res.status).toBe(200);
    const courses = (
      res.body as { courses: Array<Record<string, unknown>> }
    ).courses;

    const e = courses.find((c) => c.slug === enrolled.lessons[0]!.courseSlug)!;
    expect(e).toBeDefined();
    expect(e.enrolled).toBe(true);
    expect(e.lessonCount).toBe(4);
    expect(e.completedLessons).toBe(1);
    expect(e.progressPercent).toBe(25);
    expect(e.moduleCount).toBe(1);

    const n = courses.find(
      (c) => c.slug === notEnrolled.lessons[0]!.courseSlug,
    )!;
    expect(n).toBeDefined();
    expect(n.enrolled).toBe(false);
    expect(n.completedLessons).toBe(0);
    expect(n.progressPercent).toBe(0);
    expect(n.lessonCount).toBe(2);
  });

  test("reports 100% once every lesson in a course is complete", async () => {
    const c = await seedCourse({
      slug: courseSlug("perfect"),
      title: "Perfect",
      lessons: [
        { slug: "l1", title: "L1", position: 1 },
        { slug: "l2", title: "L2", position: 2 },
      ],
    });
    await enroll(c.lessons[0]!.courseSlug);
    await completeLesson(c.lessons[0]!.id, c.lessons[0]!.courseSlug);
    await completeLesson(c.lessons[1]!.id, c.lessons[1]!.courseSlug);

    const res = await request(app).get("/api/learn/courses");
    expect(res.status).toBe(200);
    const item = (
      res.body as { courses: Array<Record<string, unknown>> }
    ).courses.find((x) => x.slug === c.lessons[0]!.courseSlug)!;
    expect(item.enrolled).toBe(true);
    expect(item.progressPercent).toBe(100);
    expect(item.completedLessons).toBe(2);
  });
});

describe("GET /api/learn/courses/:slug", () => {
  test("returns 404 for an unknown slug", async () => {
    const res = await request(app).get(
      `/api/learn/courses/${courseSlug("does-not-exist")}`,
    );
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Course not found." });
  });

  test("returns modules + lessons with completed flags reflecting the caller's progress", async () => {
    const c = await seedCourse({
      slug: courseSlug("detail"),
      title: "Detail",
      modules: [{ title: "Intro" }, { title: "Advanced" }],
      lessons: [
        { slug: "i1", title: "Intro 1", position: 1, moduleIndex: 0 },
        { slug: "i2", title: "Intro 2", position: 2, moduleIndex: 0 },
        { slug: "a1", title: "Advanced 1", position: 3, moduleIndex: 1 },
      ],
    });
    await enroll(c.lessons[0]!.courseSlug);
    // Complete just the first lesson.
    await completeLesson(c.lessons[0]!.id, c.lessons[0]!.courseSlug);

    const res = await request(app).get(
      `/api/learn/courses/${c.lessons[0]!.courseSlug}`,
    );
    expect(res.status).toBe(200);
    const body = res.body as {
      course: { slug: string; title: string };
      modules: Array<{
        id: string;
        title: string;
        lessons: Array<{ slug: string; completed: boolean; position: number }>;
      }>;
      enrolled: boolean;
      progress: {
        totalLessons: number;
        completedLessons: number;
        percent: number;
      };
    };

    expect(body.course.slug).toBe(c.lessons[0]!.courseSlug);
    expect(body.enrolled).toBe(true);
    expect(body.progress.totalLessons).toBe(3);
    expect(body.progress.completedLessons).toBe(1);
    expect(body.progress.percent).toBe(33);

    expect(body.modules).toHaveLength(2);
    const intro = body.modules.find((m) => m.title === "Intro")!;
    const advanced = body.modules.find((m) => m.title === "Advanced")!;
    expect(intro.lessons.map((l) => l.slug)).toEqual(["i1", "i2"]);
    expect(advanced.lessons.map((l) => l.slug)).toEqual(["a1"]);
    // Only the first lesson is marked completed.
    const i1 = intro.lessons.find((l) => l.slug === "i1")!;
    const i2 = intro.lessons.find((l) => l.slug === "i2")!;
    const a1 = advanced.lessons.find((l) => l.slug === "a1")!;
    expect(i1.completed).toBe(true);
    expect(i2.completed).toBe(false);
    expect(a1.completed).toBe(false);
  });

  test("reports enrolled=false and percent=0 when the caller has not enrolled", async () => {
    const c = await seedCourse({
      slug: courseSlug("anon-detail"),
      title: "Anon Detail",
      lessons: [{ slug: "l1", title: "L1", position: 1 }],
    });

    const res = await request(app).get(
      `/api/learn/courses/${c.lessons[0]!.courseSlug}`,
    );
    expect(res.status).toBe(200);
    const body = res.body as {
      enrolled: boolean;
      progress: { percent: number; completedLessons: number };
    };
    expect(body.enrolled).toBe(false);
    expect(body.progress.completedLessons).toBe(0);
    expect(body.progress.percent).toBe(0);
  });
});

describe("GET /api/learn/courses/:slug/lessons/:lessonSlug", () => {
  test("returns 403 when the caller is not enrolled in the course", async () => {
    const c = await seedCourse({
      slug: courseSlug("locked"),
      title: "Locked",
      lessons: [{ slug: "l1", title: "L1", position: 1 }],
    });
    const res = await request(app).get(
      `/api/learn/courses/${c.lessons[0]!.courseSlug}/lessons/l1`,
    );
    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      error: "Enroll in this course to access lessons.",
    });
  });

  test("returns 404 when the lesson slug does not exist (and caller is enrolled)", async () => {
    const c = await seedCourse({
      slug: courseSlug("missing-lesson"),
      title: "Missing Lesson",
      lessons: [{ slug: "exists", title: "Exists", position: 1 }],
    });
    await enroll(c.lessons[0]!.courseSlug);

    const res = await request(app).get(
      `/api/learn/courses/${c.lessons[0]!.courseSlug}/lessons/no-such-slug`,
    );
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Lesson not found." });
  });

  test("returns prev/next siblings ordered across modules", async () => {
    const c = await seedCourse({
      slug: courseSlug("siblings"),
      title: "Siblings",
      modules: [{ title: "One" }, { title: "Two" }],
      lessons: [
        { slug: "first", title: "First", position: 1, moduleIndex: 0 },
        { slug: "second", title: "Second", position: 2, moduleIndex: 0 },
        { slug: "third", title: "Third", position: 3, moduleIndex: 1 },
        { slug: "fourth", title: "Fourth", position: 4, moduleIndex: 1 },
      ],
    });
    await enroll(c.lessons[0]!.courseSlug);

    // Middle lesson — has both a prev (in same module) and a next (in the
    // next module) so we cover the cross-module sibling case.
    const middle = await request(app).get(
      `/api/learn/courses/${c.lessons[0]!.courseSlug}/lessons/second`,
    );
    expect(middle.status).toBe(200);
    const middleBody = middle.body as {
      siblings: {
        prev: { slug: string } | null;
        next: { slug: string } | null;
      };
      module: { title: string } | null;
      lesson: { slug: string };
    };
    expect(middleBody.lesson.slug).toBe("second");
    expect(middleBody.module?.title).toBe("One");
    expect(middleBody.siblings.prev?.slug).toBe("first");
    expect(middleBody.siblings.next?.slug).toBe("third");

    // First lesson — prev should be null, next should be the second.
    const first = await request(app).get(
      `/api/learn/courses/${c.lessons[0]!.courseSlug}/lessons/first`,
    );
    expect(first.status).toBe(200);
    const firstBody = first.body as {
      siblings: { prev: unknown; next: { slug: string } | null };
    };
    expect(firstBody.siblings.prev).toBeNull();
    expect(firstBody.siblings.next?.slug).toBe("second");

    // Last lesson — next should be null, prev should be the third.
    const last = await request(app).get(
      `/api/learn/courses/${c.lessons[0]!.courseSlug}/lessons/fourth`,
    );
    expect(last.status).toBe(200);
    const lastBody = last.body as {
      siblings: { prev: { slug: string } | null; next: unknown };
    };
    expect(lastBody.siblings.prev?.slug).toBe("third");
    expect(lastBody.siblings.next).toBeNull();
  });
});

describe("POST /api/learn/courses/:slug/enroll", () => {
  test("returns 404 for an unknown course slug", async () => {
    const res = await request(app)
      .post(`/api/learn/courses/${courseSlug("ghost")}/enroll`)
      .send({});
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Course not found." });
  });

  test("creates an enrollment row, and a second call is a no-op (idempotent)", async () => {
    const c = await seedCourse({
      slug: courseSlug("idempotent"),
      title: "Idempotent",
      lessons: [{ slug: "l1", title: "L1", position: 1 }],
    });

    const first = await request(app)
      .post(`/api/learn/courses/${c.lessons[0]!.courseSlug}/enroll`)
      .send({});
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ enrolled: true });

    const rowsAfterFirst = await db
      .select()
      .from(learnEnrollmentsTable)
      .where(
        and(
          eq(learnEnrollmentsTable.userId, currentUserId),
          eq(learnEnrollmentsTable.courseSlug, c.lessons[0]!.courseSlug),
        ),
      );
    expect(rowsAfterFirst).toHaveLength(1);
    const enrolledAtFirst = rowsAfterFirst[0]!.enrolledAt;

    // Second call should succeed without creating a duplicate row or
    // bumping enrolledAt.
    const second = await request(app)
      .post(`/api/learn/courses/${c.lessons[0]!.courseSlug}/enroll`)
      .send({});
    expect(second.status).toBe(200);
    expect(second.body).toEqual({ enrolled: true });

    const rowsAfterSecond = await db
      .select()
      .from(learnEnrollmentsTable)
      .where(
        and(
          eq(learnEnrollmentsTable.userId, currentUserId),
          eq(learnEnrollmentsTable.courseSlug, c.lessons[0]!.courseSlug),
        ),
      );
    expect(rowsAfterSecond).toHaveLength(1);
    expect(rowsAfterSecond[0]!.enrolledAt.toISOString()).toBe(
      enrolledAtFirst.toISOString(),
    );
  });
});

describe("POST /api/learn/lessons/:lessonId/complete", () => {
  test("returns 404 for an unknown lessonId", async () => {
    const res = await request(app)
      .post(`/api/learn/lessons/${SLUG_PREFIX}no-such-lesson/complete`)
      .send({});
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Lesson not found." });
  });

  test("returns 403 when caller is not enrolled in the parent course", async () => {
    const c = await seedCourse({
      slug: courseSlug("complete-locked"),
      title: "Complete Locked",
      lessons: [{ slug: "l1", title: "L1", position: 1 }],
    });
    const res = await request(app)
      .post(`/api/learn/lessons/${c.lessons[0]!.id}/complete`)
      .send({});
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Enroll in this course first." });

    // No progress row should have been written.
    const rows = await db
      .select()
      .from(learnLessonProgressTable)
      .where(eq(learnLessonProgressTable.userId, currentUserId));
    expect(rows).toHaveLength(0);
  });

  test("returns 400 when the body fails validation", async () => {
    const c = await seedCourse({
      slug: courseSlug("bad-body"),
      title: "Bad Body",
      lessons: [{ slug: "l1", title: "L1", position: 1 }],
    });
    await enroll(c.lessons[0]!.courseSlug);

    const res = await request(app)
      .post(`/api/learn/lessons/${c.lessons[0]!.id}/complete`)
      .send({ quizScore: 999 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid request." });

    const rows = await db
      .select()
      .from(learnLessonProgressTable)
      .where(eq(learnLessonProgressTable.userId, currentUserId));
    expect(rows).toHaveLength(0);
  });

  test("upserts a completion row, then updates the quiz score on a second call", async () => {
    const c = await seedCourse({
      slug: courseSlug("upsert"),
      title: "Upsert",
      lessons: [{ slug: "l1", title: "L1", position: 1 }],
    });
    await enroll(c.lessons[0]!.courseSlug);

    // First call — no quiz score.
    const first = await request(app)
      .post(`/api/learn/lessons/${c.lessons[0]!.id}/complete`)
      .send({});
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ ok: true });

    const rowsFirst = await db
      .select()
      .from(learnLessonProgressTable)
      .where(
        and(
          eq(learnLessonProgressTable.userId, currentUserId),
          eq(learnLessonProgressTable.lessonId, c.lessons[0]!.id),
        ),
      );
    expect(rowsFirst).toHaveLength(1);
    expect(rowsFirst[0]!.completed).toBe(true);
    expect(rowsFirst[0]!.quizScore).toBeNull();

    // Second call — with a quiz score. Must upsert (still one row), and
    // the quiz score must be updated.
    const second = await request(app)
      .post(`/api/learn/lessons/${c.lessons[0]!.id}/complete`)
      .send({ quizScore: 88 });
    expect(second.status).toBe(200);

    const rowsSecond = await db
      .select()
      .from(learnLessonProgressTable)
      .where(
        and(
          eq(learnLessonProgressTable.userId, currentUserId),
          eq(learnLessonProgressTable.lessonId, c.lessons[0]!.id),
        ),
      );
    expect(rowsSecond).toHaveLength(1);
    expect(rowsSecond[0]!.completed).toBe(true);
    expect(rowsSecond[0]!.quizScore).toBe(88);
  });
});

describe("DELETE /api/learn/lessons/:lessonId/complete", () => {
  test("removes an existing completion row", async () => {
    const c = await seedCourse({
      slug: courseSlug("uncomplete"),
      title: "Uncomplete",
      lessons: [{ slug: "l1", title: "L1", position: 1 }],
    });
    await enroll(c.lessons[0]!.courseSlug);
    await completeLesson(c.lessons[0]!.id, c.lessons[0]!.courseSlug);

    const before = await db
      .select()
      .from(learnLessonProgressTable)
      .where(
        and(
          eq(learnLessonProgressTable.userId, currentUserId),
          eq(learnLessonProgressTable.lessonId, c.lessons[0]!.id),
        ),
      );
    expect(before).toHaveLength(1);

    const res = await request(app).delete(
      `/api/learn/lessons/${c.lessons[0]!.id}/complete`,
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    const after = await db
      .select()
      .from(learnLessonProgressTable)
      .where(
        and(
          eq(learnLessonProgressTable.userId, currentUserId),
          eq(learnLessonProgressTable.lessonId, c.lessons[0]!.id),
        ),
      );
    expect(after).toHaveLength(0);
  });

  test("is a no-op when no completion row exists", async () => {
    const res = await request(app).delete(
      `/api/learn/lessons/${SLUG_PREFIX}never-completed/complete`,
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe("POST /api/learn/lessons/:lessonId/view", () => {
  test("returns 404 when the lessonId does not exist", async () => {
    const res = await request(app)
      .post(`/api/learn/lessons/${SLUG_PREFIX}no-such-lesson/view`)
      .send({});
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Lesson not found." });

    // Defensive: a 404 must never write a view row.
    const rows = await db
      .select()
      .from(learnLessonViewsTable)
      .where(eq(learnLessonViewsTable.userId, currentUserId));
    expect(rows).toHaveLength(0);
  });

  test("returns 403 when the caller is not enrolled in the parent course", async () => {
    const c = await seedCourse({
      slug: courseSlug("view-locked"),
      title: "View Locked",
      lessons: [{ slug: "l1", title: "L1", position: 1 }],
    });

    const res = await request(app)
      .post(`/api/learn/lessons/${c.lessons[0]!.id}/view`)
      .send({});
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Enroll in this course first." });

    // No view row should have been written.
    const rows = await db
      .select()
      .from(learnLessonViewsTable)
      .where(eq(learnLessonViewsTable.userId, currentUserId));
    expect(rows).toHaveLength(0);
  });

  test("first call inserts a row into learn_lesson_views", async () => {
    const c = await seedCourse({
      slug: courseSlug("view-insert"),
      title: "View Insert",
      lessons: [{ slug: "l1", title: "L1", position: 1 }],
    });
    await enroll(c.lessons[0]!.courseSlug);

    const res = await request(app)
      .post(`/api/learn/lessons/${c.lessons[0]!.id}/view`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    const rows = await db
      .select()
      .from(learnLessonViewsTable)
      .where(
        and(
          eq(learnLessonViewsTable.userId, currentUserId),
          eq(learnLessonViewsTable.lessonId, c.lessons[0]!.id),
        ),
      );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.courseSlug).toBe(c.lessons[0]!.courseSlug);
    expect(rows[0]!.lastViewedAt).toBeInstanceOf(Date);
  });

  test("second call upserts: bumps last_viewed_at without duplicating the row", async () => {
    const c = await seedCourse({
      slug: courseSlug("view-upsert"),
      title: "View Upsert",
      lessons: [{ slug: "l1", title: "L1", position: 1 }],
    });
    await enroll(c.lessons[0]!.courseSlug);

    // First view.
    const first = await request(app)
      .post(`/api/learn/lessons/${c.lessons[0]!.id}/view`)
      .send({});
    expect(first.status).toBe(200);

    const rowsAfterFirst = await db
      .select()
      .from(learnLessonViewsTable)
      .where(
        and(
          eq(learnLessonViewsTable.userId, currentUserId),
          eq(learnLessonViewsTable.lessonId, c.lessons[0]!.id),
        ),
      );
    expect(rowsAfterFirst).toHaveLength(1);
    const firstViewedAt = rowsAfterFirst[0]!.lastViewedAt;

    // Wait long enough that the timestamp must differ. Postgres timestamps
    // have microsecond resolution but the JS Date the handler builds with
    // `new Date()` only has millisecond resolution, so a few ms is enough.
    await new Promise((resolve) => setTimeout(resolve, 25));

    // Second view of the same lesson.
    const second = await request(app)
      .post(`/api/learn/lessons/${c.lessons[0]!.id}/view`)
      .send({});
    expect(second.status).toBe(200);

    const rowsAfterSecond = await db
      .select()
      .from(learnLessonViewsTable)
      .where(
        and(
          eq(learnLessonViewsTable.userId, currentUserId),
          eq(learnLessonViewsTable.lessonId, c.lessons[0]!.id),
        ),
      );
    // No duplicate — the (user_id, lesson_id) primary key forces an upsert.
    expect(rowsAfterSecond).toHaveLength(1);
    expect(rowsAfterSecond[0]!.lastViewedAt.getTime()).toBeGreaterThan(
      firstViewedAt.getTime(),
    );
  });

  test(
    "retention sweep caps each user's history at the most-recent 50 lessons",
    async () => {
      // Mirror the VIEW_HISTORY_RETAIN_PER_USER constant in learn.ts. If
      // that cap ever changes, this test should fail loudly so the new
      // bound is reviewed deliberately.
      const RETAIN = 50;
      const OVERFLOW = RETAIN + 1;

      // Seed a single course with one extra lesson beyond the cap so the
      // retention sweep on the very last view has to prune exactly one row
      // (the oldest one) to bring the table back to RETAIN entries.
      const c = await seedCourse({
        slug: courseSlug("view-retention"),
        title: "View Retention",
        lessons: Array.from({ length: OVERFLOW }, (_, i) => ({
          slug: `l${i + 1}`,
          title: `L${i + 1}`,
          position: i + 1,
        })),
      });
      await enroll(c.lessons[0]!.courseSlug);

      // Post one view per lesson, in order. Each insert uses Postgres'
      // defaultNow() (microsecond resolution) so the lessons end up with
      // strictly-increasing last_viewed_at timestamps in the same order
      // they were viewed — meaning the very first lesson is the oldest
      // and is the row the retention sweep must drop on the final call.
      for (const lesson of c.lessons) {
        const res = await request(app)
          .post(`/api/learn/lessons/${lesson.id}/view`)
          .send({});
        expect(res.status).toBe(200);
      }

      const rows = await db
        .select({ lessonId: learnLessonViewsTable.lessonId })
        .from(learnLessonViewsTable)
        .where(eq(learnLessonViewsTable.userId, currentUserId));

      // The sweep must have capped this user's history at RETAIN rows.
      expect(rows).toHaveLength(RETAIN);

      const remainingIds = new Set(rows.map((r) => r.lessonId));
      const oldestLesson = c.lessons[0]!;
      const newestLessons = c.lessons.slice(1);

      // The oldest view (the very first lesson we posted) is the one
      // that should have been pruned.
      expect(remainingIds.has(oldestLesson.id)).toBe(false);
      // Every other lesson — the RETAIN most recent — must still be there.
      for (const lesson of newestLessons) {
        expect(remainingIds.has(lesson.id)).toBe(true);
      }
    },
    // 51 sequential POSTs against the real DB; bump the per-test timeout
    // a bit above Vitest's 5s default so a slow CI shard doesn't flake.
    20_000,
  );
});
