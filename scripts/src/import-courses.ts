/**
 * Idempotent importer that materializes the Lovable peptide-palooza course
 * catalog into the database. Re-run safely; rows are upserted by stable IDs.
 *
 * Source data lives in ./seed-data-courses.ts (a verbatim copy of the
 * original `src/data/courses.ts` from the upstream Lovable repository).
 */
import { and, eq } from "drizzle-orm";
import {
  db,
  pool,
  learnCoursesTable,
  learnModulesTable,
  learnLessonsTable,
  learnCourseHandoutsTable,
} from "@workspace/db";
import type {
  LessonContentItem,
  LessonQuizQuestion,
} from "@workspace/db";
import { courses, type Course, type CourseModule } from "./seed-data-courses";

function slugifyTitle(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function mapCategory(value: Course["category"]) {
  // Source uses the same vocabulary as our enum.
  return value;
}

function buildLessonContent(mod: CourseModule): LessonContentItem[] {
  return mod.content.map((body) => ({ type: "text" as const, body }));
}

function buildQuiz(mod: CourseModule): LessonQuizQuestion[] | null {
  if (!mod.quiz || mod.quiz.length === 0) return null;
  return mod.quiz.map((q) => ({
    question: q.question,
    options: q.options,
    correctIndex: q.correctIndex,
  }));
}

async function importOneCourse(course: Course, position: number): Promise<void> {
  console.log(`-> ${course.id}`);

  await db
    .insert(learnCoursesTable)
    .values({
      slug: course.id,
      title: course.title,
      subtitle: course.subtitle,
      description: course.description,
      audience: course.audience,
      duration: course.duration,
      category: mapCategory(course.category),
      icon: course.icon,
      color: course.color,
      outcomes: course.outcomes,
      position,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: learnCoursesTable.slug,
      set: {
        title: course.title,
        subtitle: course.subtitle,
        description: course.description,
        audience: course.audience,
        duration: course.duration,
        category: mapCategory(course.category),
        icon: course.icon,
        color: course.color,
        outcomes: course.outcomes,
        position,
        updatedAt: new Date(),
      },
    });

  // Wipe + recreate the modules and lessons for this course to keep ordering
  // and titles authoritative against the source. Cascades clean lessons too.
  await db
    .delete(learnModulesTable)
    .where(eq(learnModulesTable.courseSlug, course.id));

  // The importer owns exactly one handout per course: the auto-generated
  // "Quick reference" one-pager keyed by `${course.id}__h1`. Any other
  // handouts (and any version of `__h1` that has been touched in the
  // editor — `is_authored = true`) are left strictly alone so re-running
  // the importer never wipes out admin-authored copy.
  const autoHandoutId = `${course.id}__h1`;
  await db
    .delete(learnCourseHandoutsTable)
    .where(
      and(
        eq(learnCourseHandoutsTable.id, autoHandoutId),
        eq(learnCourseHandoutsTable.isAuthored, false),
      ),
    );

  // A single auto-generated "Quick reference" handout per course built
  // from the course outcomes + a recap of each module's objective. This
  // gives every course at least one downloadable PDF so the new feature
  // is visible in the UI without the editorial team having to author
  // anything by hand.
  const handoutBody = [
    "Use this one-pager as a refresher after you finish the course or to brief a teammate before clinic.",
    "",
    "Outcomes you should now own:",
    ...course.outcomes.map((o) => `- ${o}`),
    "",
    "Module recap:",
    ...course.modules.map((m) => `- ${m.title} — ${m.objective}`),
  ].join("\n");

  // Only re-insert the auto-generated handout when the editor hasn't
  // claimed it. If an admin has overwritten or repositioned it, leave
  // the editor's version in place — they own it now.
  const [existingAuto] = await db
    .select({ isAuthored: learnCourseHandoutsTable.isAuthored })
    .from(learnCourseHandoutsTable)
    .where(eq(learnCourseHandoutsTable.id, autoHandoutId));
  if (!existingAuto || existingAuto.isAuthored === false) {
    const autoPosition = await pickAutoHandoutPosition(course.id);
    await db.insert(learnCourseHandoutsTable).values({
      id: autoHandoutId,
      courseSlug: course.id,
      position: autoPosition,
      title: `${course.title} — Quick reference`,
      description:
        "A one-pager you can keep on your desk: the headline outcomes plus a one-line recap of every module.",
      body: handoutBody,
      isAuthored: false,
    });
  }

  for (let i = 0; i < course.modules.length; i++) {
    const mod = course.modules[i];
    const moduleId = `${course.id}__m${i + 1}`;
    const lessonSlug = slugifyTitle(mod.title) || `lesson-${i + 1}`;
    const lessonId = `${moduleId}__l1`;

    await db.insert(learnModulesTable).values({
      id: moduleId,
      courseSlug: course.id,
      position: i + 1,
      title: mod.title,
      duration: mod.duration,
      objective: mod.objective,
    });

    await db.insert(learnLessonsTable).values({
      id: lessonId,
      moduleId,
      courseSlug: course.id,
      slug: lessonSlug,
      position: i + 1,
      title: mod.title,
      duration: mod.duration,
      contentItems: buildLessonContent(mod),
      quiz: buildQuiz(mod),
    });
  }
}

/**
 * Pick a position for the auto-generated handout that doesn't collide
 * with any admin-authored siblings. The unique index on
 * (course_slug, position) means we can't just default to 1 — admins
 * may have inserted handouts that already occupy that slot.
 */
async function pickAutoHandoutPosition(courseSlug: string): Promise<number> {
  const rows = await db
    .select({ position: learnCourseHandoutsTable.position })
    .from(learnCourseHandoutsTable)
    .where(eq(learnCourseHandoutsTable.courseSlug, courseSlug));
  const used = new Set(rows.map((r) => r.position));
  let p = 1;
  while (used.has(p)) p++;
  return p;
}

async function main() {
  console.log(`Importing ${courses.length} courses...`);
  for (let i = 0; i < courses.length; i++) {
    await importOneCourse(courses[i], i);
  }
  console.log("Done.");
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await pool.end();
    process.exit(1);
  });
