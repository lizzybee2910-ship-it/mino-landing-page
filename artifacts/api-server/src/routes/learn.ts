import { Router, type IRouter, type Request } from "express";
import { z } from "zod";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  db,
  learnCoursesTable,
  learnModulesTable,
  learnLessonsTable,
  learnEnrollmentsTable,
  learnLessonProgressTable,
  learnLessonViewsTable,
  learnCourseHandoutsTable,
  learnCertificatesTable,
  usersTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { isUserAdmin, requireAdmin } from "../middlewares/requireAdmin";
import {
  renderCertificatePdf,
  renderHandoutPdf,
} from "../lib/learn-pdf";
import crypto from "node:crypto";

const RECENT_LESSONS_LIMIT = 5;
// Retention cap for `learn_lesson_views`: after every upsert we trim each
// user's history down to their most-recently-viewed N lessons so the table
// (and the join behind the dashboard's "Recently viewed" strip) does not
// grow unbounded as members move through more courses.
const VIEW_HISTORY_RETAIN_PER_USER = 50;

const router: IRouter = Router();

/**
 * GET /api/learn/verify/:certificateId
 *
 * Public, unauthenticated endpoint that lets a third party (e.g. a hiring
 * manager) confirm a certificate is genuine. Returns only the metadata
 * already printed on the PDF — course title, member display name, and
 * issue date — never anything PII-adjacent like email or user id.
 *
 * Mounted *before* the global requireAuth middleware below.
 */
router.get("/learn/verify/:certificateId", async (req, res) => {
  const certificateId = req.params.certificateId;

  const [row] = await db
    .select({
      id: learnCertificatesTable.id,
      issuedAt: learnCertificatesTable.issuedAt,
      courseSlug: learnCertificatesTable.courseSlug,
      courseTitle: learnCoursesTable.title,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      email: usersTable.email,
    })
    .from(learnCertificatesTable)
    .innerJoin(
      learnCoursesTable,
      eq(learnCoursesTable.slug, learnCertificatesTable.courseSlug),
    )
    .innerJoin(
      usersTable,
      eq(usersTable.id, learnCertificatesTable.userId),
    )
    .where(eq(learnCertificatesTable.id, certificateId));

  if (!row) {
    res.status(404).json({ valid: false, error: "Certificate not found." });
    return;
  }

  res.setHeader("Cache-Control", "public, max-age=60");
  res.json({
    valid: true,
    certificateId: row.id,
    courseSlug: row.courseSlug,
    courseTitle: row.courseTitle,
    memberName: formatMemberName({
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
    }),
    issuedAt: row.issuedAt.toISOString(),
    issuer: "(mino)",
  });
});

// All other /learn endpoints require an authenticated session.
router.use(requireAuth);

const lessonProgressBody = z.object({
  quizScore: z.number().int().min(0).max(100).optional(),
});

/**
 * GET /api/learn/me
 * Returns the caller's enrolled courses plus the next-incomplete lesson
 * per course and a "last activity" timestamp suitable for sorting on a
 * personal dashboard.
 */
router.get("/learn/me", async (req, res) => {
  const userId = req.user!.id;

  const [enrollments, progress, recentViews] = await Promise.all([
    db
      .select()
      .from(learnEnrollmentsTable)
      .where(eq(learnEnrollmentsTable.userId, userId)),
    db
      .select()
      .from(learnLessonProgressTable)
      .where(eq(learnLessonProgressTable.userId, userId)),
    db
      .select({
        lessonId: learnLessonViewsTable.lessonId,
        courseSlug: learnLessonViewsTable.courseSlug,
        lastViewedAt: learnLessonViewsTable.lastViewedAt,
        lessonSlug: learnLessonsTable.slug,
        lessonTitle: learnLessonsTable.title,
        lessonDuration: learnLessonsTable.duration,
        courseTitle: learnCoursesTable.title,
      })
      .from(learnLessonViewsTable)
      .innerJoin(
        learnLessonsTable,
        eq(learnLessonsTable.id, learnLessonViewsTable.lessonId),
      )
      .innerJoin(
        learnCoursesTable,
        eq(learnCoursesTable.slug, learnLessonViewsTable.courseSlug),
      )
      .where(eq(learnLessonViewsTable.userId, userId))
      .orderBy(desc(learnLessonViewsTable.lastViewedAt))
      .limit(RECENT_LESSONS_LIMIT),
  ]);

  const recentLessons = recentViews.map((v) => ({
    lessonId: v.lessonId,
    lessonSlug: v.lessonSlug,
    lessonTitle: v.lessonTitle,
    lessonDuration: v.lessonDuration,
    courseSlug: v.courseSlug,
    courseTitle: v.courseTitle,
    lastViewedAt: v.lastViewedAt.toISOString(),
  }));

  if (enrollments.length === 0) {
    res.json({ items: [], recentLessons });
    return;
  }

  const enrolledSlugs = enrollments.map((e) => e.courseSlug);

  const [courses, modules, lessons] = await Promise.all([
    db.select().from(learnCoursesTable).orderBy(asc(learnCoursesTable.position)),
    db
      .select()
      .from(learnModulesTable)
      .orderBy(asc(learnModulesTable.position)),
    db
      .select({
        id: learnLessonsTable.id,
        slug: learnLessonsTable.slug,
        title: learnLessonsTable.title,
        duration: learnLessonsTable.duration,
        position: learnLessonsTable.position,
        courseSlug: learnLessonsTable.courseSlug,
      })
      .from(learnLessonsTable)
      .orderBy(asc(learnLessonsTable.position)),
  ]);

  const enrolledSet = new Set(enrolledSlugs);
  const courseBySlug = new Map(courses.map((c) => [c.slug, c]));
  const enrolledAtBySlug = new Map(
    enrollments.map((e) => [e.courseSlug, e.enrolledAt]),
  );

  const completedLessonIdsByCourse = new Map<string, Set<string>>();
  const lastProgressByCourse = new Map<string, Date>();
  for (const p of progress) {
    if (!enrolledSet.has(p.courseSlug)) continue;
    if (p.completed) {
      let set = completedLessonIdsByCourse.get(p.courseSlug);
      if (!set) {
        set = new Set();
        completedLessonIdsByCourse.set(p.courseSlug, set);
      }
      set.add(p.lessonId);
    }
    const prev = lastProgressByCourse.get(p.courseSlug);
    if (!prev || p.completedAt > prev) {
      lastProgressByCourse.set(p.courseSlug, p.completedAt);
    }
  }

  const lessonsByCourse = new Map<string, typeof lessons>();
  for (const l of lessons) {
    if (!enrolledSet.has(l.courseSlug)) continue;
    const arr = lessonsByCourse.get(l.courseSlug) ?? [];
    arr.push(l);
    lessonsByCourse.set(l.courseSlug, arr);
  }
  const moduleCountByCourse = new Map<string, number>();
  for (const m of modules) {
    if (!enrolledSet.has(m.courseSlug)) continue;
    moduleCountByCourse.set(
      m.courseSlug,
      (moduleCountByCourse.get(m.courseSlug) ?? 0) + 1,
    );
  }

  const items = enrolledSlugs
    .map((slug) => {
      const course = courseBySlug.get(slug);
      if (!course) return null;
      const courseLessons = lessonsByCourse.get(slug) ?? [];
      const completedSet = completedLessonIdsByCourse.get(slug) ?? new Set();
      const totalLessons = courseLessons.length;
      const completedLessons = courseLessons.filter((l) =>
        completedSet.has(l.id),
      ).length;
      const nextIncomplete =
        courseLessons.find((l) => !completedSet.has(l.id)) ?? null;
      const enrolledAt = enrolledAtBySlug.get(slug)!;
      const lastProgressAt = lastProgressByCourse.get(slug) ?? null;
      const lastActivityAt =
        lastProgressAt && lastProgressAt > enrolledAt
          ? lastProgressAt
          : enrolledAt;
      return {
        slug: course.slug,
        title: course.title,
        subtitle: course.subtitle,
        category: course.category,
        duration: course.duration,
        audience: course.audience,
        icon: course.icon,
        color: course.color,
        moduleCount: moduleCountByCourse.get(slug) ?? 0,
        lessonCount: totalLessons,
        completedLessons,
        progressPercent:
          totalLessons === 0
            ? 0
            : Math.round((completedLessons / totalLessons) * 100),
        enrolledAt: enrolledAt.toISOString(),
        lastActivityAt: lastActivityAt.toISOString(),
        completed: totalLessons > 0 && completedLessons === totalLessons,
        nextLesson: nextIncomplete
          ? {
              slug: nextIncomplete.slug,
              title: nextIncomplete.title,
              duration: nextIncomplete.duration,
              position: nextIncomplete.position,
            }
          : null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort(
      (a, b) =>
        new Date(b.lastActivityAt).getTime() -
        new Date(a.lastActivityAt).getTime(),
    );

  res.json({ items, recentLessons });
});

/**
 * GET /api/learn/courses
 * List the catalog. Includes the caller's enrollment status and per-course
 * progress percentage so the catalog page can render badges.
 */
router.get("/learn/courses", async (req, res) => {
  const userId = req.user!.id;

  const [courses, modules, lessons, enrollments, progress] = await Promise.all([
    db.select().from(learnCoursesTable).orderBy(asc(learnCoursesTable.position)),
    db.select().from(learnModulesTable).orderBy(asc(learnModulesTable.position)),
    db.select({
      id: learnLessonsTable.id,
      courseSlug: learnLessonsTable.courseSlug,
    }).from(learnLessonsTable),
    db.select().from(learnEnrollmentsTable).where(
      eq(learnEnrollmentsTable.userId, userId),
    ),
    db.select().from(learnLessonProgressTable).where(
      eq(learnLessonProgressTable.userId, userId),
    ),
  ]);

  const lessonCountByCourse = new Map<string, number>();
  for (const lesson of lessons) {
    lessonCountByCourse.set(
      lesson.courseSlug,
      (lessonCountByCourse.get(lesson.courseSlug) ?? 0) + 1,
    );
  }
  const moduleCountByCourse = new Map<string, number>();
  for (const m of modules) {
    moduleCountByCourse.set(
      m.courseSlug,
      (moduleCountByCourse.get(m.courseSlug) ?? 0) + 1,
    );
  }
  const enrolledSet = new Set(enrollments.map((e) => e.courseSlug));
  const completedByCourse = new Map<string, number>();
  for (const p of progress) {
    if (p.completed) {
      completedByCourse.set(
        p.courseSlug,
        (completedByCourse.get(p.courseSlug) ?? 0) + 1,
      );
    }
  }

  const payload = courses.map((c) => {
    const totalLessons = lessonCountByCourse.get(c.slug) ?? 0;
    const completedLessons = completedByCourse.get(c.slug) ?? 0;
    return {
      slug: c.slug,
      title: c.title,
      subtitle: c.subtitle,
      description: c.description,
      audience: c.audience,
      duration: c.duration,
      category: c.category,
      icon: c.icon,
      color: c.color,
      outcomes: c.outcomes,
      moduleCount: moduleCountByCourse.get(c.slug) ?? 0,
      lessonCount: totalLessons,
      enrolled: enrolledSet.has(c.slug),
      completedLessons,
      progressPercent:
        totalLessons === 0
          ? 0
          : Math.round((completedLessons / totalLessons) * 100),
    };
  });

  res.json({ courses: payload });
});

/**
 * GET /api/learn/courses/:slug
 * Course detail with modules + lesson summaries (titles only — full content
 * is gated behind enrollment via the lesson endpoint below).
 */
router.get("/learn/courses/:slug", async (req, res) => {
  const userId = req.user!.id;
  const slug = req.params.slug;

  const [course] = await db
    .select()
    .from(learnCoursesTable)
    .where(eq(learnCoursesTable.slug, slug));
  if (!course) {
    res.status(404).json({ error: "Course not found." });
    return;
  }

  const [modules, lessons, enrollment, progress, handouts] = await Promise.all([
    db
      .select()
      .from(learnModulesTable)
      .where(eq(learnModulesTable.courseSlug, slug))
      .orderBy(asc(learnModulesTable.position)),
    db
      .select({
        id: learnLessonsTable.id,
        moduleId: learnLessonsTable.moduleId,
        slug: learnLessonsTable.slug,
        title: learnLessonsTable.title,
        duration: learnLessonsTable.duration,
        position: learnLessonsTable.position,
      })
      .from(learnLessonsTable)
      .where(eq(learnLessonsTable.courseSlug, slug))
      .orderBy(asc(learnLessonsTable.position)),
    db
      .select()
      .from(learnEnrollmentsTable)
      .where(
        and(
          eq(learnEnrollmentsTable.userId, userId),
          eq(learnEnrollmentsTable.courseSlug, slug),
        ),
      ),
    db
      .select()
      .from(learnLessonProgressTable)
      .where(
        and(
          eq(learnLessonProgressTable.userId, userId),
          eq(learnLessonProgressTable.courseSlug, slug),
        ),
      ),
    db
      .select({
        id: learnCourseHandoutsTable.id,
        title: learnCourseHandoutsTable.title,
        description: learnCourseHandoutsTable.description,
        position: learnCourseHandoutsTable.position,
      })
      .from(learnCourseHandoutsTable)
      .where(eq(learnCourseHandoutsTable.courseSlug, slug))
      .orderBy(asc(learnCourseHandoutsTable.position)),
  ]);

  const completedSet = new Set(
    progress.filter((p) => p.completed).map((p) => p.lessonId),
  );

  const modulesPayload = modules.map((m) => ({
    id: m.id,
    title: m.title,
    duration: m.duration,
    objective: m.objective,
    position: m.position,
    lessons: lessons
      .filter((l) => l.moduleId === m.id)
      .map((l) => ({
        id: l.id,
        slug: l.slug,
        title: l.title,
        duration: l.duration,
        position: l.position,
        completed: completedSet.has(l.id),
      })),
  }));

  res.json({
    course: {
      slug: course.slug,
      title: course.title,
      subtitle: course.subtitle,
      description: course.description,
      audience: course.audience,
      duration: course.duration,
      category: course.category,
      icon: course.icon,
      color: course.color,
      outcomes: course.outcomes,
    },
    modules: modulesPayload,
    enrolled: enrollment.length > 0,
    progress: {
      totalLessons: lessons.length,
      completedLessons: completedSet.size,
      percent:
        lessons.length === 0
          ? 0
          : Math.round((completedSet.size / lessons.length) * 100),
    },
    handouts: handouts.map((h) => ({
      id: h.id,
      title: h.title,
      description: h.description,
      position: h.position,
    })),
  });
});

/**
 * GET /api/learn/courses/:slug/certificate
 * Returns a branded PDF certificate. Only available once the caller is
 * enrolled and has completed every lesson in the course.
 */
router.get("/learn/courses/:slug/certificate", async (req, res) => {
  const userId = req.user!.id;
  const slug = req.params.slug;

  const [course] = await db
    .select()
    .from(learnCoursesTable)
    .where(eq(learnCoursesTable.slug, slug));
  if (!course) {
    res.status(404).json({ error: "Course not found." });
    return;
  }

  const [enrollment] = await db
    .select()
    .from(learnEnrollmentsTable)
    .where(
      and(
        eq(learnEnrollmentsTable.userId, userId),
        eq(learnEnrollmentsTable.courseSlug, slug),
      ),
    );
  if (!enrollment) {
    res
      .status(403)
      .json({ error: "Enroll in this course before downloading a certificate." });
    return;
  }

  const [lessons, progressRows] = await Promise.all([
    db
      .select({ id: learnLessonsTable.id })
      .from(learnLessonsTable)
      .where(eq(learnLessonsTable.courseSlug, slug)),
    db
      .select()
      .from(learnLessonProgressTable)
      .where(
        and(
          eq(learnLessonProgressTable.userId, userId),
          eq(learnLessonProgressTable.courseSlug, slug),
        ),
      ),
  ]);

  if (lessons.length === 0) {
    res
      .status(409)
      .json({ error: "This course has no lessons yet — no certificate to issue." });
    return;
  }

  const completedSet = new Set(
    progressRows.filter((p) => p.completed).map((p) => p.lessonId),
  );
  const allCompleted = lessons.every((l) => completedSet.has(l.id));
  if (!allCompleted) {
    res
      .status(409)
      .json({ error: "Finish every lesson to unlock your certificate." });
    return;
  }

  const certificateId = buildCertificateId(userId, slug);

  // Record (or look up) the first-issued timestamp so the awarded date
  // is stable across re-downloads and reflects when the member actually
  // earned the certificate, not when they next opened the link.
  // ON CONFLICT DO NOTHING keeps the original issuedAt; we then read
  // the row back to get the canonical value.
  await db
    .insert(learnCertificatesTable)
    .values({ id: certificateId, userId, courseSlug: slug })
    .onConflictDoNothing();
  const [certificate] = await db
    .select()
    .from(learnCertificatesTable)
    .where(eq(learnCertificatesTable.id, certificateId));
  const awardedAt = certificate?.issuedAt ?? new Date();

  const memberName = formatMemberName(req.user!);
  const verifyUrl = buildVerifyUrl(req, certificateId);
  const pdf = renderCertificatePdf({
    courseTitle: course.title,
    courseSubtitle: course.subtitle,
    memberName,
    completedAt: awardedAt,
    certificateId,
    verifyUrl,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="mino-certificate-${slug}.pdf"`,
  );
  res.setHeader("Cache-Control", "private, no-store");
  res.send(pdf);
});

/**
 * GET /api/learn/me/certificates
 *
 * Permanent record of every certificate the caller has earned, sorted
 * newest-first. The `issuedAt` is the very first time the certificate
 * was unlocked (it does not move on subsequent re-downloads). Each item
 * also includes the deterministic download + public verification URLs
 * so the dashboard can render share buttons without rebuilding them.
 */
router.get("/learn/me/certificates", async (req, res) => {
  const userId = req.user!.id;

  const rows = await db
    .select({
      id: learnCertificatesTable.id,
      issuedAt: learnCertificatesTable.issuedAt,
      courseSlug: learnCertificatesTable.courseSlug,
      courseTitle: learnCoursesTable.title,
      courseSubtitle: learnCoursesTable.subtitle,
      courseIcon: learnCoursesTable.icon,
      courseCategory: learnCoursesTable.category,
    })
    .from(learnCertificatesTable)
    .innerJoin(
      learnCoursesTable,
      eq(learnCoursesTable.slug, learnCertificatesTable.courseSlug),
    )
    .where(eq(learnCertificatesTable.userId, userId))
    .orderBy(desc(learnCertificatesTable.issuedAt));

  const items = rows.map((r) => ({
    certificateId: r.id,
    courseSlug: r.courseSlug,
    courseTitle: r.courseTitle,
    courseSubtitle: r.courseSubtitle,
    courseIcon: r.courseIcon,
    courseCategory: r.courseCategory,
    issuedAt: r.issuedAt.toISOString(),
    downloadUrl: `/api/learn/courses/${encodeURIComponent(r.courseSlug)}/certificate`,
    verifyUrl: buildVerifyUrl(req, r.id),
  }));

  res.json({ items });
});

/**
 * GET /api/learn/courses/:slug/handouts/:handoutId
 * Returns the named handout as a PDF. Requires enrollment.
 */
router.get(
  "/learn/courses/:slug/handouts/:handoutId",
  async (req, res) => {
    const userId = req.user!.id;
    const { slug, handoutId } = req.params;

    const [enrollment] = await db
      .select()
      .from(learnEnrollmentsTable)
      .where(
        and(
          eq(learnEnrollmentsTable.userId, userId),
          eq(learnEnrollmentsTable.courseSlug, slug),
        ),
      );
    // Admins can preview their own handouts without enrolling — useful
    // when they're authoring/editing copy and want to see the rendered
    // PDF before publishing it to members.
    if (!enrollment) {
      const allowed = await isUserAdmin(userId);
      if (!allowed) {
        res
          .status(403)
          .json({ error: "Enroll in this course to download handouts." });
        return;
      }
    }

    const [handout] = await db
      .select()
      .from(learnCourseHandoutsTable)
      .where(
        and(
          eq(learnCourseHandoutsTable.courseSlug, slug),
          eq(learnCourseHandoutsTable.id, handoutId),
        ),
      );
    if (!handout) {
      res.status(404).json({ error: "Handout not found." });
      return;
    }

    const [course] = await db
      .select({ title: learnCoursesTable.title })
      .from(learnCoursesTable)
      .where(eq(learnCoursesTable.slug, slug));

    const pdf = renderHandoutPdf({
      courseTitle: course?.title ?? slug,
      handoutTitle: handout.title,
      handoutDescription: handout.description,
      body: handout.body,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeFilename(handout.title)}.pdf"`,
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.send(pdf);
  },
);

interface NamedMember {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}

function formatMemberName(user: NamedMember): string {
  const first = (user.firstName ?? "").trim();
  const last = (user.lastName ?? "").trim();
  const both = [first, last].filter(Boolean).join(" ");
  if (both) return both;
  if (user.email) return user.email.split("@")[0];
  return "Member";
}

/**
 * Build the public verification URL for a certificate. The URL points at
 * the same-origin frontend page (`/verify/:certificateId`) so a third
 * party can paste it into a browser and see the metadata returned by
 * the public verify API endpoint.
 */
function buildVerifyUrl(req: Request, certificateId: string): string {
  const host = req.get("host");
  if (!host) return `/verify/${encodeURIComponent(certificateId)}`;
  // Honour the X-Forwarded-Proto header set by the Replit proxy so links
  // inside generated PDFs always render https in production.
  const proto = req.protocol;
  return `${proto}://${host}/verify/${encodeURIComponent(certificateId)}`;
}

function buildCertificateId(userId: string, slug: string): string {
  // Short, opaque, deterministic. Good enough to print on the page so
  // a member could reference it; not a security boundary.
  const seed = `${userId}:${slug}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const hex = hash.toString(16).toUpperCase().padStart(8, "0");
  return `MINO-${slug.toUpperCase().slice(0, 8)}-${hex}`;
}

function safeFilename(input: string): string {
  return (
    input
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "handout"
  );
}

/**
 * GET /api/learn/courses/:slug/lessons/:lessonSlug
 * Returns the full lesson body (content + quiz). Requires enrollment.
 */
router.get("/learn/courses/:slug/lessons/:lessonSlug", async (req, res) => {
  const userId = req.user!.id;
  const { slug, lessonSlug } = req.params;

  const [enrollment] = await db
    .select()
    .from(learnEnrollmentsTable)
    .where(
      and(
        eq(learnEnrollmentsTable.userId, userId),
        eq(learnEnrollmentsTable.courseSlug, slug),
      ),
    );
  if (!enrollment) {
    res.status(403).json({ error: "Enroll in this course to access lessons." });
    return;
  }

  const [lesson] = await db
    .select()
    .from(learnLessonsTable)
    .where(
      and(
        eq(learnLessonsTable.courseSlug, slug),
        eq(learnLessonsTable.slug, lessonSlug),
      ),
    );
  if (!lesson) {
    res.status(404).json({ error: "Lesson not found." });
    return;
  }

  const [module] = await db
    .select()
    .from(learnModulesTable)
    .where(eq(learnModulesTable.id, lesson.moduleId));

  // Sibling lessons in the same course for next/prev navigation.
  const allLessons = await db
    .select({
      id: learnLessonsTable.id,
      slug: learnLessonsTable.slug,
      title: learnLessonsTable.title,
      position: learnLessonsTable.position,
    })
    .from(learnLessonsTable)
    .where(eq(learnLessonsTable.courseSlug, slug))
    .orderBy(asc(learnLessonsTable.position));
  const idx = allLessons.findIndex((l) => l.id === lesson.id);
  const prev = idx > 0 ? allLessons[idx - 1] : null;
  const next = idx >= 0 && idx < allLessons.length - 1 ? allLessons[idx + 1] : null;

  const [progress] = await db
    .select()
    .from(learnLessonProgressTable)
    .where(
      and(
        eq(learnLessonProgressTable.userId, userId),
        eq(learnLessonProgressTable.lessonId, lesson.id),
      ),
    );

  res.json({
    lesson: {
      id: lesson.id,
      slug: lesson.slug,
      title: lesson.title,
      duration: lesson.duration,
      position: lesson.position,
      contentItems: lesson.contentItems,
      quiz: lesson.quiz,
    },
    module: module
      ? {
          id: module.id,
          title: module.title,
          objective: module.objective,
          duration: module.duration,
          position: module.position,
        }
      : null,
    course: {
      slug,
    },
    siblings: { prev, next },
    progress: progress
      ? {
          completed: progress.completed,
          quizScore: progress.quizScore,
          completedAt: progress.completedAt,
        }
      : null,
  });
});

/**
 * POST /api/learn/courses/:slug/enroll
 * Free, idempotent enrollment.
 */
router.post("/learn/courses/:slug/enroll", async (req, res) => {
  const userId = req.user!.id;
  const slug = req.params.slug;

  const [course] = await db
    .select({ slug: learnCoursesTable.slug })
    .from(learnCoursesTable)
    .where(eq(learnCoursesTable.slug, slug));
  if (!course) {
    res.status(404).json({ error: "Course not found." });
    return;
  }

  await db
    .insert(learnEnrollmentsTable)
    .values({ userId, courseSlug: slug })
    .onConflictDoNothing();

  res.json({ enrolled: true });
});

/**
 * POST /api/learn/lessons/:lessonId/view
 * Record that the caller opened a lesson (independent of completion). Used
 * to power the "Recently viewed" strip on the dashboard. Requires enrollment
 * in the parent course. Idempotent — re-views simply bump `last_viewed_at`.
 */
router.post("/learn/lessons/:lessonId/view", async (req, res) => {
  const userId = req.user!.id;
  const lessonId = req.params.lessonId;

  const [lesson] = await db
    .select({ id: learnLessonsTable.id, courseSlug: learnLessonsTable.courseSlug })
    .from(learnLessonsTable)
    .where(eq(learnLessonsTable.id, lessonId));
  if (!lesson) {
    res.status(404).json({ error: "Lesson not found." });
    return;
  }

  const [enrollment] = await db
    .select()
    .from(learnEnrollmentsTable)
    .where(
      and(
        eq(learnEnrollmentsTable.userId, userId),
        eq(learnEnrollmentsTable.courseSlug, lesson.courseSlug),
      ),
    );
  if (!enrollment) {
    res.status(403).json({ error: "Enroll in this course first." });
    return;
  }

  await db
    .insert(learnLessonViewsTable)
    .values({
      userId,
      lessonId,
      courseSlug: lesson.courseSlug,
    })
    .onConflictDoUpdate({
      target: [learnLessonViewsTable.userId, learnLessonViewsTable.lessonId],
      set: { lastViewedAt: new Date() },
    });

  // Retention sweep: drop everything older than this user's N most-recent
  // views so the table stays bounded per user. Indexed by
  // (user_id, last_viewed_at) so the inner SELECT is cheap.
  await db.execute(sql`
    DELETE FROM learn_lesson_views
    WHERE user_id = ${userId}
      AND lesson_id NOT IN (
        SELECT lesson_id FROM learn_lesson_views
        WHERE user_id = ${userId}
        ORDER BY last_viewed_at DESC
        LIMIT ${VIEW_HISTORY_RETAIN_PER_USER}
      )
  `);

  res.json({ ok: true });
});

/**
 * POST /api/learn/lessons/:lessonId/complete
 * Mark a lesson complete. Requires enrollment in the parent course.
 */
router.post("/learn/lessons/:lessonId/complete", async (req, res) => {
  const userId = req.user!.id;
  const lessonId = req.params.lessonId;
  const parsed = lessonProgressBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request." });
    return;
  }

  const [lesson] = await db
    .select()
    .from(learnLessonsTable)
    .where(eq(learnLessonsTable.id, lessonId));
  if (!lesson) {
    res.status(404).json({ error: "Lesson not found." });
    return;
  }

  const [enrollment] = await db
    .select()
    .from(learnEnrollmentsTable)
    .where(
      and(
        eq(learnEnrollmentsTable.userId, userId),
        eq(learnEnrollmentsTable.courseSlug, lesson.courseSlug),
      ),
    );
  if (!enrollment) {
    res.status(403).json({ error: "Enroll in this course first." });
    return;
  }

  await db
    .insert(learnLessonProgressTable)
    .values({
      userId,
      lessonId,
      courseSlug: lesson.courseSlug,
      completed: true,
      quizScore: parsed.data.quizScore ?? null,
    })
    .onConflictDoUpdate({
      target: [
        learnLessonProgressTable.userId,
        learnLessonProgressTable.lessonId,
      ],
      set: {
        completed: true,
        quizScore: parsed.data.quizScore ?? null,
        completedAt: new Date(),
      },
    });

  res.json({ ok: true });
});

/**
 * DELETE /api/learn/lessons/:lessonId/complete
 * Unmark a previously-completed lesson.
 */
router.delete("/learn/lessons/:lessonId/complete", async (req, res) => {
  const userId = req.user!.id;
  const lessonId = req.params.lessonId;

  await db
    .delete(learnLessonProgressTable)
    .where(
      and(
        eq(learnLessonProgressTable.userId, userId),
        eq(learnLessonProgressTable.lessonId, lessonId),
      ),
    );
  res.json({ ok: true });
});

// -----------------------------------------------------------------------
// Admin handout authoring
// -----------------------------------------------------------------------
//
// All routes below let editorial admins create, edit, reorder, and remove
// handouts for a course without rerunning the importer. They are gated by
// `requireAdmin`, which looks up the live `is_admin` flag on the user row
// every request so a flipped flag takes effect without a re-login.
//
// Authored handouts carry `is_authored = true`, which the importer uses
// as a "leave me alone" marker — the importer only manages the auto
// "Quick reference" handout it owns.

const handoutSlugMaxLen = 80;
const handoutTitleMaxLen = 200;
const handoutDescriptionMaxLen = 600;
const handoutBodyMaxLen = 20_000;

const handoutCreateSchema = z.object({
  title: z.string().trim().min(1).max(handoutTitleMaxLen),
  description: z.string().trim().max(handoutDescriptionMaxLen).default(""),
  body: z.string().max(handoutBodyMaxLen).default(""),
});

const handoutUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(handoutTitleMaxLen).optional(),
    description: z.string().trim().max(handoutDescriptionMaxLen).optional(),
    body: z.string().max(handoutBodyMaxLen).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required.",
  });

const handoutReorderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(50),
});

/**
 * GET /api/learn/admin/status
 * Returns whether the caller has admin privileges. Used by the React UI
 * to decide whether to surface admin-only links without speculatively
 * hitting a 403-prone admin endpoint.
 */
router.get("/learn/admin/status", async (req, res) => {
  const isAdmin = await isUserAdmin(req.user!.id);
  res.json({ isAdmin });
});

// Every endpoint below is admin-only; mounting `requireAdmin` on the
// sub-router instead of per-route keeps Express's route-literal type
// inference for `req.params` working correctly.
const adminRouter: IRouter = Router();
adminRouter.use(requireAdmin);
router.use("/learn/admin", adminRouter);

/**
 * GET /api/learn/admin/courses
 * Compact picker list used by the admin dashboard. Returns every
 * course slug + title so admins can navigate to a course's handout
 * editor without going through the member-facing catalog first.
 */
adminRouter.get("/courses", async (_req, res) => {
  const rows = await db
    .select({
      slug: learnCoursesTable.slug,
      title: learnCoursesTable.title,
      subtitle: learnCoursesTable.subtitle,
      position: learnCoursesTable.position,
    })
    .from(learnCoursesTable)
    .orderBy(asc(learnCoursesTable.position));
  res.json({ courses: rows });
});

/**
 * GET /api/learn/admin/courses/:slug/handouts
 * Full handout list for a course, including body text. Unlike the
 * member-facing list, this returns enough payload for the editor to
 * render an in-place edit form.
 */
adminRouter.get(
  "/courses/:slug/handouts",
  async (req, res) => {
    const slug = req.params.slug;
    const [course] = await db
      .select({ slug: learnCoursesTable.slug, title: learnCoursesTable.title })
      .from(learnCoursesTable)
      .where(eq(learnCoursesTable.slug, slug));
    if (!course) {
      res.status(404).json({ error: "Course not found." });
      return;
    }
    const handouts = await db
      .select()
      .from(learnCourseHandoutsTable)
      .where(eq(learnCourseHandoutsTable.courseSlug, slug))
      .orderBy(asc(learnCourseHandoutsTable.position));
    res.json({
      course: { slug: course.slug, title: course.title },
      handouts: handouts.map((h) => ({
        id: h.id,
        title: h.title,
        description: h.description,
        body: h.body,
        position: h.position,
        isAuthored: h.isAuthored,
        updatedAt: h.updatedAt.toISOString(),
      })),
    });
  },
);

/**
 * POST /api/learn/admin/courses/:slug/handouts
 * Create a new admin-authored handout. The new row is appended at the
 * end of the existing position list and stamped `is_authored = true` so
 * the importer leaves it alone.
 */
adminRouter.post(
  "/courses/:slug/handouts",
  async (req, res) => {
    const slug = req.params.slug;
    const parsed = handoutCreateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Invalid request." });
      return;
    }
    const [course] = await db
      .select({ slug: learnCoursesTable.slug })
      .from(learnCoursesTable)
      .where(eq(learnCoursesTable.slug, slug));
    if (!course) {
      res.status(404).json({ error: "Course not found." });
      return;
    }

    const id = `${slug.slice(0, handoutSlugMaxLen)}__a${crypto
      .randomBytes(6)
      .toString("hex")}`;
    const nextPosition = await pickNextPosition(slug);

    await db.insert(learnCourseHandoutsTable).values({
      id,
      courseSlug: slug,
      position: nextPosition,
      title: parsed.data.title,
      description: parsed.data.description,
      body: parsed.data.body,
      isAuthored: true,
      updatedAt: new Date(),
    });

    res.status(201).json({ id });
  },
);

/**
 * PATCH /api/learn/admin/courses/:slug/handouts/:handoutId
 * Update title / description / body of an existing handout. Editing
 * an importer-owned handout flips `is_authored = true` so the next
 * importer run won't undo your changes.
 */
adminRouter.patch(
  "/courses/:slug/handouts/:handoutId",
  async (req, res) => {
    const { slug, handoutId } = req.params;
    const parsed = handoutUpdateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Invalid request." });
      return;
    }
    const [existing] = await db
      .select()
      .from(learnCourseHandoutsTable)
      .where(
        and(
          eq(learnCourseHandoutsTable.courseSlug, slug),
          eq(learnCourseHandoutsTable.id, handoutId),
        ),
      );
    if (!existing) {
      res.status(404).json({ error: "Handout not found." });
      return;
    }
    await db
      .update(learnCourseHandoutsTable)
      .set({
        title: parsed.data.title ?? existing.title,
        description: parsed.data.description ?? existing.description,
        body: parsed.data.body ?? existing.body,
        isAuthored: true,
        updatedAt: new Date(),
      })
      .where(eq(learnCourseHandoutsTable.id, handoutId));

    res.json({ ok: true });
  },
);

/**
 * DELETE /api/learn/admin/courses/:slug/handouts/:handoutId
 * Remove a handout. We do not renumber surviving siblings — the next
 * reorder call will assign tight positions, and gaps are harmless to
 * the catalog renderer.
 */
adminRouter.delete(
  "/courses/:slug/handouts/:handoutId",
  async (req, res) => {
    const { slug, handoutId } = req.params;
    const result = await db
      .delete(learnCourseHandoutsTable)
      .where(
        and(
          eq(learnCourseHandoutsTable.courseSlug, slug),
          eq(learnCourseHandoutsTable.id, handoutId),
        ),
      )
      .returning({ id: learnCourseHandoutsTable.id });
    if (result.length === 0) {
      res.status(404).json({ error: "Handout not found." });
      return;
    }
    res.json({ ok: true });
  },
);

/**
 * POST /api/learn/admin/courses/:slug/handouts/reorder
 * Replace every handout's `position` for the course with its index
 * in the supplied id list. The (course_slug, position) unique index
 * means we have to clear positions to negative values first inside a
 * transaction before assigning the new tight 1..N sequence.
 */
adminRouter.post(
  "/courses/:slug/handouts/reorder",
  async (req, res) => {
    const slug = req.params.slug;
    const parsed = handoutReorderSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Invalid request." });
      return;
    }
    const ids = parsed.data.ids;
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) {
        res.status(400).json({ error: "Duplicate handout id in reorder list." });
        return;
      }
      seen.add(id);
    }

    const existing = await db
      .select({
        id: learnCourseHandoutsTable.id,
        position: learnCourseHandoutsTable.position,
      })
      .from(learnCourseHandoutsTable)
      .where(eq(learnCourseHandoutsTable.courseSlug, slug));
    const existingIds = new Set(existing.map((h) => h.id));
    if (existing.length !== ids.length) {
      res
        .status(400)
        .json({ error: "Reorder list must include every handout for the course." });
      return;
    }
    for (const id of ids) {
      if (!existingIds.has(id)) {
        res
          .status(400)
          .json({ error: "Reorder list contains an unknown handout id." });
        return;
      }
    }

    await db.transaction(async (tx) => {
      // Move every row to a guaranteed-unique negative position to escape
      // the (course_slug, position) unique index before we assign the new
      // tight 1..N positions.
      await tx
        .update(learnCourseHandoutsTable)
        .set({ position: sql`-${learnCourseHandoutsTable.position} - 1` })
        .where(eq(learnCourseHandoutsTable.courseSlug, slug));
      for (let i = 0; i < ids.length; i++) {
        await tx
          .update(learnCourseHandoutsTable)
          .set({ position: i + 1, updatedAt: new Date() })
          .where(
            and(
              eq(learnCourseHandoutsTable.courseSlug, slug),
              eq(learnCourseHandoutsTable.id, ids[i]!),
            ),
          );
      }
    });

    res.json({ ok: true });
  },
);

async function pickNextPosition(courseSlug: string): Promise<number> {
  const [row] = await db
    .select({
      maxPos: sql<number | null>`max(${learnCourseHandoutsTable.position})`,
    })
    .from(learnCourseHandoutsTable)
    .where(eq(learnCourseHandoutsTable.courseSlug, courseSlug));
  return (row?.maxPos ?? 0) + 1;
}

export default router;
