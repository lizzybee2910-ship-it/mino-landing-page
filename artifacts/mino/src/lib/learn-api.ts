/**
 * Tiny client for the /api/learn/* endpoints. Returns plain typed objects
 * for use with TanStack Query hooks defined alongside the consuming pages.
 */

export type LearnCategory = "business" | "clinical" | "specialty";

export interface LearnCatalogCourse {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  audience: string;
  duration: string;
  category: LearnCategory;
  icon: string;
  color: string;
  outcomes: string[];
  moduleCount: number;
  lessonCount: number;
  enrolled: boolean;
  completedLessons: number;
  progressPercent: number;
}

export interface LearnLessonSummary {
  id: string;
  slug: string;
  title: string;
  duration: string;
  position: number;
  completed: boolean;
}

export interface LearnModuleDetail {
  id: string;
  title: string;
  duration: string;
  objective: string;
  position: number;
  lessons: LearnLessonSummary[];
}

export interface LearnHandoutSummary {
  id: string;
  title: string;
  description: string;
  position: number;
}

export interface LearnCourseDetail {
  course: {
    slug: string;
    title: string;
    subtitle: string;
    description: string;
    audience: string;
    duration: string;
    category: LearnCategory;
    icon: string;
    color: string;
    outcomes: string[];
  };
  modules: LearnModuleDetail[];
  enrolled: boolean;
  progress: {
    totalLessons: number;
    completedLessons: number;
    percent: number;
  };
  handouts: LearnHandoutSummary[];
}

export interface LearnLessonContentItem {
  type: "text";
  body: string;
}

export interface LearnQuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface LearnLessonDetail {
  lesson: {
    id: string;
    slug: string;
    title: string;
    duration: string;
    position: number;
    contentItems: LearnLessonContentItem[];
    quiz: LearnQuizQuestion[] | null;
  };
  module: {
    id: string;
    title: string;
    objective: string;
    duration: string;
    position: number;
  } | null;
  course: { slug: string };
  siblings: {
    prev: { id: string; slug: string; title: string; position: number } | null;
    next: { id: string; slug: string; title: string; position: number } | null;
  };
  progress: {
    completed: boolean;
    quizScore: number | null;
    completedAt: string;
  } | null;
}

export interface LearnRecentLesson {
  lessonId: string;
  lessonSlug: string;
  lessonTitle: string;
  lessonDuration: string;
  courseSlug: string;
  courseTitle: string;
  lastViewedAt: string;
}

export interface LearnDashboard {
  items: LearnDashboardItem[];
  recentLessons: LearnRecentLesson[];
}

export interface LearnEarnedCertificate {
  certificateId: string;
  courseSlug: string;
  courseTitle: string;
  courseSubtitle: string;
  courseIcon: string;
  courseCategory: LearnCategory;
  issuedAt: string;
  /** Same-origin path for downloading the PDF. */
  downloadUrl: string;
  /** Absolute URL anyone can open to confirm the certificate is genuine. */
  verifyUrl: string;
}

export interface LearnVerifiedCertificate {
  valid: true;
  certificateId: string;
  courseSlug: string;
  courseTitle: string;
  memberName: string;
  issuedAt: string;
  issuer: string;
}

export interface LearnDashboardItem {
  slug: string;
  title: string;
  subtitle: string;
  category: LearnCategory;
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
  nextLesson: {
    slug: string;
    title: string;
    duration: string;
    position: number;
  } | null;
}

class LearnAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "LearnAuthError";
  }
}

async function jsonRequest<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    let message = "Something went wrong.";
    try {
      const body = await res.json();
      if (body && typeof body.error === "string") message = body.error;
    } catch {
      // ignore
    }
    throw new LearnAuthError(message, res.status);
  }
  return (await res.json()) as T;
}

export { LearnAuthError };

/**
 * Fetch the caller's permanent record of every certificate they've ever
 * earned, sorted newest first.
 */
export async function fetchEarnedCertificates(): Promise<
  LearnEarnedCertificate[]
> {
  const data = await jsonRequest<{ items: LearnEarnedCertificate[] }>(
    "/api/learn/me/certificates",
  );
  return data.items;
}

/**
 * Public, unauthenticated lookup of a certificate's metadata. Returns
 * null when the certificate does not exist (404), so callers can render
 * a friendly "not found" view without a thrown error.
 */
export async function verifyCertificate(
  certificateId: string,
): Promise<LearnVerifiedCertificate | null> {
  try {
    return await jsonRequest<LearnVerifiedCertificate>(
      `/api/learn/verify/${encodeURIComponent(certificateId)}`,
    );
  } catch (err) {
    if (err instanceof LearnAuthError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

export async function fetchDashboard(): Promise<LearnDashboard> {
  const data = await jsonRequest<{
    items: LearnDashboardItem[];
    recentLessons?: LearnRecentLesson[];
  }>("/api/learn/me");
  return {
    items: data.items,
    recentLessons: data.recentLessons ?? [],
  };
}

export async function recordLessonView(lessonId: string): Promise<void> {
  await jsonRequest<{ ok: boolean }>(
    `/api/learn/lessons/${encodeURIComponent(lessonId)}/view`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export async function fetchCatalog(): Promise<LearnCatalogCourse[]> {
  const data = await jsonRequest<{ courses: LearnCatalogCourse[] }>(
    "/api/learn/courses",
  );
  return data.courses;
}

export async function fetchCourse(slug: string): Promise<LearnCourseDetail> {
  return jsonRequest<LearnCourseDetail>(
    `/api/learn/courses/${encodeURIComponent(slug)}`,
  );
}

export async function fetchLesson(
  courseSlug: string,
  lessonSlug: string,
): Promise<LearnLessonDetail> {
  return jsonRequest<LearnLessonDetail>(
    `/api/learn/courses/${encodeURIComponent(courseSlug)}/lessons/${encodeURIComponent(lessonSlug)}`,
  );
}

export async function enrollInCourse(slug: string): Promise<void> {
  await jsonRequest<{ enrolled: boolean }>(
    `/api/learn/courses/${encodeURIComponent(slug)}/enroll`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export async function markLessonComplete(
  lessonId: string,
  quizScore?: number,
): Promise<void> {
  await jsonRequest<{ ok: boolean }>(
    `/api/learn/lessons/${encodeURIComponent(lessonId)}/complete`,
    {
      method: "POST",
      body: JSON.stringify(quizScore !== undefined ? { quizScore } : {}),
    },
  );
}

export async function unmarkLessonComplete(lessonId: string): Promise<void> {
  await jsonRequest<{ ok: boolean }>(
    `/api/learn/lessons/${encodeURIComponent(lessonId)}/complete`,
    { method: "DELETE" },
  );
}

/**
 * Same-origin URL for the certificate PDF. Used as the `href` of an
 * anchor tag — the browser handles the download itself, including the
 * session cookie, so members can right-click → Save As as well.
 */
export function certificateDownloadUrl(courseSlug: string): string {
  return `/api/learn/courses/${encodeURIComponent(courseSlug)}/certificate`;
}

export function handoutDownloadUrl(
  courseSlug: string,
  handoutId: string,
): string {
  return `/api/learn/courses/${encodeURIComponent(courseSlug)}/handouts/${encodeURIComponent(handoutId)}`;
}

// ----- Admin handout authoring -----------------------------------------

export interface AdminCourseListing {
  slug: string;
  title: string;
  subtitle: string;
  position: number;
}

export interface AdminHandout {
  id: string;
  title: string;
  description: string;
  body: string;
  position: number;
  isAuthored: boolean;
  updatedAt: string;
}

export interface AdminCourseHandouts {
  course: { slug: string; title: string };
  handouts: AdminHandout[];
}

export async function fetchAdminStatus(): Promise<{ isAdmin: boolean }> {
  return jsonRequest<{ isAdmin: boolean }>("/api/learn/admin/status");
}

export async function fetchAdminCourses(): Promise<AdminCourseListing[]> {
  const data = await jsonRequest<{ courses: AdminCourseListing[] }>(
    "/api/learn/admin/courses",
  );
  return data.courses;
}

export async function fetchAdminHandouts(
  courseSlug: string,
): Promise<AdminCourseHandouts> {
  return jsonRequest<AdminCourseHandouts>(
    `/api/learn/admin/courses/${encodeURIComponent(courseSlug)}/handouts`,
  );
}

export async function createAdminHandout(
  courseSlug: string,
  input: { title: string; description: string; body: string },
): Promise<{ id: string }> {
  return jsonRequest<{ id: string }>(
    `/api/learn/admin/courses/${encodeURIComponent(courseSlug)}/handouts`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function updateAdminHandout(
  courseSlug: string,
  handoutId: string,
  input: { title?: string; description?: string; body?: string },
): Promise<void> {
  await jsonRequest<{ ok: boolean }>(
    `/api/learn/admin/courses/${encodeURIComponent(
      courseSlug,
    )}/handouts/${encodeURIComponent(handoutId)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export async function deleteAdminHandout(
  courseSlug: string,
  handoutId: string,
): Promise<void> {
  await jsonRequest<{ ok: boolean }>(
    `/api/learn/admin/courses/${encodeURIComponent(
      courseSlug,
    )}/handouts/${encodeURIComponent(handoutId)}`,
    { method: "DELETE" },
  );
}

export async function reorderAdminHandouts(
  courseSlug: string,
  ids: string[],
): Promise<void> {
  await jsonRequest<{ ok: boolean }>(
    `/api/learn/admin/courses/${encodeURIComponent(
      courseSlug,
    )}/handouts/reorder`,
    { method: "POST", body: JSON.stringify({ ids }) },
  );
}
