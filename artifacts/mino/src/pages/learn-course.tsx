import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  Play,
  Users,
} from "lucide-react";
import {
  certificateDownloadUrl,
  enrollInCourse,
  fetchCourse,
  handoutDownloadUrl,
  type LearnCourseDetail,
} from "@/lib/learn-api";
import { LearnIcon } from "@/components/learn-icon";
import { useAdminStatus } from "@/hooks/use-admin-status";

interface Props {
  params: { courseSlug: string };
}

export default function LearnCoursePage({ params }: Props) {
  const { courseSlug } = params;
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["learn", "course", courseSlug],
    queryFn: () => fetchCourse(courseSlug),
  });

  const enroll = useMutation({
    mutationFn: () => enrollInCourse(courseSlug),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["learn", "course", courseSlug] }),
        queryClient.invalidateQueries({ queryKey: ["learn", "catalog"] }),
        queryClient.invalidateQueries({ queryKey: ["learn", "dashboard"] }),
      ]);
      // Auto-jump to the first lesson once enrolled.
      const firstLesson = data?.modules[0]?.lessons[0];
      if (firstLesson) {
        navigate(`/learn/${courseSlug}/${firstLesson.slug}`);
      }
    },
  });

  if (isLoading) {
    return (
      <main className="min-h-screen bg-mino-cream pt-32 pb-24 px-6 md:px-12">
        <p
          data-testid="learn-course-loading"
          className="font-serif text-mino-forest/60"
        >
          Loading course…
        </p>
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="min-h-screen bg-mino-cream pt-32 pb-24 px-6 md:px-12">
        <p
          data-testid="learn-course-error"
          className="font-serif text-red-700"
        >
          {(error as Error)?.message ?? "Course not found."}
        </p>
        <Link
          href="/learn"
          className="mt-6 inline-flex items-center gap-2 mino-eyebrow text-mino-forest underline underline-offset-4"
        >
          ← All courses
        </Link>
      </main>
    );
  }

  return <CourseView data={data} onEnroll={() => enroll.mutate()} enrolling={enroll.isPending} />;
}

function CourseView({
  data,
  onEnroll,
  enrolling,
}: {
  data: LearnCourseDetail;
  onEnroll: () => void;
  enrolling: boolean;
}) {
  const { course, modules, enrolled, progress, handouts } = data;
  const totalLessons = progress.totalLessons;
  const isComplete = enrolled && totalLessons > 0 && progress.completedLessons === totalLessons;
  const { isAdmin } = useAdminStatus();

  return (
    <main
      data-testid="page-learn-course"
      className="min-h-screen bg-mino-cream pt-32 pb-24 px-6 md:px-12"
    >
      <div className="max-w-4xl mx-auto">
        <Link
          href="/learn"
          data-testid="link-back-to-catalog"
          className="inline-flex items-center gap-2 mino-eyebrow text-mino-forest/60 hover:text-mino-forest mb-8"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> All courses
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <span className="mino-rule" />
          <span className="mino-eyebrow text-mino-sage-deep">
            {course.category}
          </span>
        </div>

        <div className="flex items-start gap-5 mb-8">
          <div className="h-16 w-16 rounded-md bg-mino-forest/8 flex items-center justify-center text-mino-forest shrink-0">
            <LearnIcon name={course.icon} className="h-7 w-7" />
          </div>
          <div>
            <h1 className="font-serif text-4xl md:text-5xl text-mino-forest leading-[1.05] mb-3">
              {course.title}
            </h1>
            <p className="font-serif text-lg text-mino-forest/85">
              {course.subtitle}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-mino-forest/60 font-serif mb-10">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4" aria-hidden /> {course.duration}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" aria-hidden />
            {totalLessons} {totalLessons === 1 ? "lesson" : "lessons"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-4 w-4" aria-hidden /> {course.audience}
          </span>
        </div>

        {!enrolled ? (
          <div className="border border-mino-forest/15 bg-mino-bone/30 p-7 mb-12">
            <p className="font-serif text-mino-forest/90 mb-5">
              This course is free for (mino) members. Enroll once and access
              every lesson.
            </p>
            <button
              type="button"
              data-testid="button-enroll"
              disabled={enrolling}
              onClick={onEnroll}
              className="inline-flex items-center gap-2 mino-eyebrow text-mino-cream bg-mino-forest hover:bg-mino-ink disabled:opacity-50 transition-colors px-6 py-3"
            >
              {enrolling ? "Enrolling…" : "Enroll for free"}
            </button>
          </div>
        ) : (
          <div className="border border-mino-forest/15 bg-mino-bone/30 p-7 mb-12">
            <div className="flex items-center justify-between gap-6 mb-3">
              <p
                className="mino-eyebrow text-mino-sage-deep"
                data-testid="enrolled-status"
              >
                <CheckCircle2 className="inline h-3.5 w-3.5 mr-1.5" aria-hidden />
                Enrolled
              </p>
              <p
                data-testid="course-progress-percent"
                className="font-serif text-mino-forest"
              >
                {progress.completedLessons} / {totalLessons} lessons —{" "}
                <span className="font-semibold">{progress.percent}%</span>
              </p>
            </div>
            <div className="h-1.5 bg-mino-forest/10 overflow-hidden">
              <div
                className="h-full bg-mino-sage-deep transition-[width] duration-500"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            {isComplete && (
              <div
                data-testid="course-complete-banner"
                className="mt-4 flex items-center justify-between gap-4 flex-wrap"
              >
                <p className="font-serif text-mino-forest">
                  You've completed every lesson. Congratulations.
                </p>
                <a
                  href={certificateDownloadUrl(course.slug)}
                  data-testid="course-certificate-download"
                  className="inline-flex items-center gap-2 mino-eyebrow text-mino-cream bg-mino-forest hover:bg-mino-ink transition-colors px-5 py-2.5"
                >
                  <Award className="h-3.5 w-3.5" aria-hidden /> Download
                  certificate
                </a>
              </div>
            )}
          </div>
        )}

        <section className="mb-14">
          <h2 className="font-serif text-2xl text-mino-forest mb-5">
            What you'll learn
          </h2>
          <ul className="grid sm:grid-cols-2 gap-3">
            {course.outcomes.map((outcome) => (
              <li
                key={outcome}
                className="flex items-start gap-2 font-serif text-mino-forest/85"
              >
                <CheckCircle2
                  className="h-4 w-4 text-mino-sage-deep shrink-0 mt-1"
                  aria-hidden
                />
                <span>{outcome}</span>
              </li>
            ))}
          </ul>
        </section>

        {(handouts.length > 0 || isAdmin) && (
          <section className="mb-14" data-testid="course-handouts">
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="font-serif text-2xl text-mino-forest">Handouts</h2>
              {isAdmin && (
                <Link
                  href={`/learn/${course.slug}/admin/handouts`}
                  data-testid="course-handouts-admin-link"
                  className="mino-eyebrow text-mino-forest underline underline-offset-4"
                >
                  Manage handouts
                </Link>
              )}
            </div>
            <p className="font-serif text-mino-forest/85 mb-5">
              Printable companions to the course — yours to keep.
            </p>
            <ul className="border-y border-mino-forest/15">
              {handouts.map((h) => (
                <li
                  key={h.id}
                  data-testid={`course-handout-${h.id}`}
                  className="border-b border-mino-forest/10 last:border-b-0 py-5 flex items-start gap-4"
                >
                  <FileText
                    className="h-5 w-5 text-mino-sage-deep mt-1 shrink-0"
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-serif text-lg text-mino-forest mb-1">
                      {h.title}
                    </h3>
                    <p className="font-serif text-sm text-mino-forest/65 leading-relaxed">
                      {h.description}
                    </p>
                  </div>
                  {enrolled ? (
                    <a
                      href={handoutDownloadUrl(course.slug, h.id)}
                      data-testid={`course-handout-download-${h.id}`}
                      className="shrink-0 inline-flex items-center gap-2 mino-eyebrow text-mino-forest border border-mino-forest/30 hover:border-mino-forest/60 transition-colors px-4 py-2"
                    >
                      Download PDF
                    </a>
                  ) : (
                    <span className="shrink-0 mino-eyebrow text-mino-forest/40">
                      Enroll to download
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="font-serif text-2xl text-mino-forest mb-5">
            Course modules
          </h2>
          <div
            data-testid="learn-course-modules"
            className="border-y border-mino-forest/15"
          >
            {modules.map((mod) => (
              <article
                key={mod.id}
                data-testid={`learn-module-${mod.position}`}
                className="border-b border-mino-forest/10 last:border-b-0 py-6"
              >
                <div className="flex items-baseline gap-4">
                  <span className="mino-eyebrow text-mino-sage-deep w-8 shrink-0">
                    0{mod.position}
                  </span>
                  <div className="flex-1">
                    <h3 className="font-serif text-xl text-mino-forest mb-1">
                      {mod.title}
                    </h3>
                    <p className="font-serif text-sm text-mino-forest/60 mb-3">
                      {mod.duration} · {mod.objective}
                    </p>
                    <ul className="space-y-2">
                      {mod.lessons.map((lesson) => {
                        const inner = (
                          <span className="flex items-center gap-3 font-serif text-mino-forest/90">
                            {lesson.completed ? (
                              <CheckCircle2
                                className="h-4 w-4 text-mino-sage-deep"
                                aria-hidden
                              />
                            ) : (
                              <Play
                                className="h-3.5 w-3.5 text-mino-forest/40"
                                aria-hidden
                              />
                            )}
                            <span className="underline-offset-4 group-hover:underline">
                              {lesson.title}
                            </span>
                            <span className="ml-auto text-xs text-mino-forest/50">
                              {lesson.duration}
                            </span>
                          </span>
                        );
                        return (
                          <li key={lesson.id}>
                            {enrolled ? (
                              <Link
                                href={`/learn/${course.slug}/${lesson.slug}`}
                                data-testid={`learn-lesson-link-${lesson.position}`}
                                className="group block"
                              >
                                {inner}
                              </Link>
                            ) : (
                              <div className="opacity-60 cursor-not-allowed">
                                {inner}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
