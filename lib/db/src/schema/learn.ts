import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const learnCourseCategoryEnum = pgEnum("learn_course_category", [
  "business",
  "clinical",
  "specialty",
]);

export const learnCoursesTable = pgTable(
  "learn_courses",
  {
    slug: text("slug").primaryKey(),
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull(),
    description: text("description").notNull(),
    audience: text("audience").notNull(),
    duration: text("duration").notNull(),
    category: learnCourseCategoryEnum("category").notNull(),
    icon: text("icon").notNull(),
    color: text("color").notNull(),
    outcomes: jsonb("outcomes").$type<string[]>().notNull().default([]),
    position: integer("position").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    positionIdx: index("learn_courses_position_idx").on(table.position),
  }),
);

export const learnModulesTable = pgTable(
  "learn_modules",
  {
    id: text("id").primaryKey(),
    courseSlug: text("course_slug")
      .notNull()
      .references(() => learnCoursesTable.slug, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    duration: text("duration").notNull(),
    objective: text("objective").notNull(),
  },
  (table) => ({
    courseIdx: index("learn_modules_course_idx").on(
      table.courseSlug,
      table.position,
    ),
    courseUniq: uniqueIndex("learn_modules_course_position_uniq").on(
      table.courseSlug,
      table.position,
    ),
  }),
);

export interface LessonContentItem {
  type: "text";
  body: string;
}

export interface LessonQuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export const learnLessonsTable = pgTable(
  "learn_lessons",
  {
    id: text("id").primaryKey(),
    moduleId: text("module_id")
      .notNull()
      .references(() => learnModulesTable.id, { onDelete: "cascade" }),
    courseSlug: text("course_slug")
      .notNull()
      .references(() => learnCoursesTable.slug, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    duration: text("duration").notNull(),
    contentItems: jsonb("content_items")
      .$type<LessonContentItem[]>()
      .notNull()
      .default([]),
    quiz: jsonb("quiz").$type<LessonQuizQuestion[] | null>(),
  },
  (table) => ({
    courseSlugIdx: index("learn_lessons_course_slug_idx").on(
      table.courseSlug,
      table.slug,
    ),
    courseSlugUniq: uniqueIndex("learn_lessons_course_slug_uniq").on(
      table.courseSlug,
      table.slug,
    ),
    moduleIdx: index("learn_lessons_module_idx").on(
      table.moduleId,
      table.position,
    ),
  }),
);

export const learnEnrollmentsTable = pgTable(
  "learn_enrollments",
  {
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    courseSlug: text("course_slug")
      .notNull()
      .references(() => learnCoursesTable.slug, { onDelete: "cascade" }),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.courseSlug] }),
  }),
);

export const learnLessonProgressTable = pgTable(
  "learn_lesson_progress",
  {
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => learnLessonsTable.id, { onDelete: "cascade" }),
    courseSlug: text("course_slug")
      .notNull()
      .references(() => learnCoursesTable.slug, { onDelete: "cascade" }),
    completed: boolean("completed").notNull().default(true),
    quizScore: integer("quiz_score"),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.lessonId] }),
    courseIdx: index("learn_lesson_progress_user_course_idx").on(
      table.userId,
      table.courseSlug,
    ),
  }),
);

export const learnLessonViewsTable = pgTable(
  "learn_lesson_views",
  {
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => learnLessonsTable.id, { onDelete: "cascade" }),
    courseSlug: text("course_slug")
      .notNull()
      .references(() => learnCoursesTable.slug, { onDelete: "cascade" }),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.lessonId] }),
    recentIdx: index("learn_lesson_views_user_recent_idx").on(
      table.userId,
      table.lastViewedAt,
    ),
  }),
);

/**
 * Optional, per-course downloadable handouts. Rendered server-side as
 * branded PDFs via /api/learn/courses/:slug/handouts/:handoutId.
 *
 * The body is plain text where blank lines (\n\n) separate paragraphs
 * and a leading "- " marks a bullet list item. The PDF renderer wraps
 * paragraphs to the page width.
 */
export const learnCourseHandoutsTable = pgTable(
  "learn_course_handouts",
  {
    id: text("id").primaryKey(),
    courseSlug: text("course_slug")
      .notNull()
      .references(() => learnCoursesTable.slug, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    body: text("body").notNull(),
    // True when an admin authored or edited this handout via the editor
    // UI; false when the importer auto-generated it from course outcomes.
    // The importer uses this flag to decide which rows it owns: it will
    // only overwrite or remove handouts where `is_authored` is false.
    isAuthored: boolean("is_authored").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    courseIdx: index("learn_course_handouts_course_idx").on(
      table.courseSlug,
      table.position,
    ),
    courseUniq: uniqueIndex("learn_course_handouts_course_position_uniq").on(
      table.courseSlug,
      table.position,
    ),
  }),
);

/**
 * Permanent record of every certificate a member has earned. The id is the
 * deterministic, opaque certificate id rendered on the PDF (e.g.
 * MINO-FOOBAR-1A2B3C4D). `issuedAt` captures the *first* time the
 * certificate was unlocked, which is what we display on the
 * achievements page and the public verification endpoint — completing
 * additional lessons later (or even unenrolling and re-enrolling) does
 * not move this date.
 *
 * The (user_id, course_slug) tuple is unique so a member can only ever
 * have one certificate per course.
 */
export const learnCertificatesTable = pgTable(
  "learn_certificates",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    courseSlug: text("course_slug")
      .notNull()
      .references(() => learnCoursesTable.slug, { onDelete: "cascade" }),
    issuedAt: timestamp("issued_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userCourseUniq: uniqueIndex("learn_certificates_user_course_uniq").on(
      table.userId,
      table.courseSlug,
    ),
    userIssuedIdx: index("learn_certificates_user_issued_idx").on(
      table.userId,
      table.issuedAt,
    ),
  }),
);

export type LearnCourse = typeof learnCoursesTable.$inferSelect;
export type InsertLearnCourse = typeof learnCoursesTable.$inferInsert;
export type LearnModule = typeof learnModulesTable.$inferSelect;
export type InsertLearnModule = typeof learnModulesTable.$inferInsert;
export type LearnLesson = typeof learnLessonsTable.$inferSelect;
export type InsertLearnLesson = typeof learnLessonsTable.$inferInsert;
export type LearnEnrollment = typeof learnEnrollmentsTable.$inferSelect;
export type LearnLessonProgress = typeof learnLessonProgressTable.$inferSelect;
export type LearnLessonView = typeof learnLessonViewsTable.$inferSelect;
export type LearnCourseHandout = typeof learnCourseHandoutsTable.$inferSelect;
export type InsertLearnCourseHandout =
  typeof learnCourseHandoutsTable.$inferInsert;
export type LearnCertificate = typeof learnCertificatesTable.$inferSelect;
export type InsertLearnCertificate = typeof learnCertificatesTable.$inferInsert;
