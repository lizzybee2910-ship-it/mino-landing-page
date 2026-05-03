import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Users,
} from "lucide-react";
import {
  fetchCatalog,
  fetchDashboard,
  type LearnCategory,
  type LearnCatalogCourse,
  type LearnDashboardItem,
} from "@/lib/learn-api";
import { LearnIcon } from "@/components/learn-icon";

const CATEGORY_LABELS: Record<LearnCategory | "all", string> = {
  all: "All",
  business: "Business",
  clinical: "Clinical",
  specialty: "Specialty",
};

export default function LearnCatalogPage() {
  const [category, setCategory] = useState<LearnCategory | "all">("all");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["learn", "catalog"],
    queryFn: fetchCatalog,
  });

  const { data: dashboard } = useQuery({
    queryKey: ["learn", "dashboard"],
    queryFn: fetchDashboard,
  });
  const continueItems = useMemo(
    () =>
      (dashboard?.items ?? [])
        .filter((d: LearnDashboardItem) => !d.completed)
        .slice(0, 3),
    [dashboard],
  );

  const filtered = useMemo(() => {
    if (!data) return [];
    if (category === "all") return data;
    return data.filter((c) => c.category === category);
  }, [data, category]);

  return (
    <main
      data-testid="page-learn-catalog"
      className="min-h-screen bg-mino-cream pt-32 pb-24 px-6 md:px-12"
    >
      <div className="max-w-[88rem] mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <span className="mino-rule" />
          <span className="mino-eyebrow text-mino-sage-deep">
            Vol. II · Education
          </span>
        </div>
        <h1 className="font-serif text-5xl md:text-6xl text-mino-forest mb-5 max-w-3xl leading-[1.05]">
          The (mino) education library
        </h1>
        <p className="font-serif text-lg md:text-xl text-mino-forest/85 max-w-2xl mb-12 leading-relaxed">
          Free, members-only courses on clinical practice, peptide protocols,
          and the business of regenerative medicine. Enroll in any course in
          one click.
        </p>

        {continueItems.length > 0 && (
          <section
            data-testid="continue-learning"
            aria-label="Continue learning"
            className="mb-14"
          >
            <div className="flex items-end justify-between gap-4 mb-5">
              <div>
                <span className="mino-eyebrow text-mino-sage-deep">
                  Continue learning
                </span>
                <h2 className="font-serif text-2xl md:text-3xl text-mino-forest mt-2">
                  Pick up where you left off
                </h2>
              </div>
              <Link
                href="/learn/me"
                data-testid="continue-learning-view-all"
                className="hidden sm:inline-flex items-center gap-2 mino-eyebrow text-mino-forest/85 hover:text-mino-forest"
              >
                View dashboard <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {continueItems.map((item) => (
                <ContinueCard key={item.slug} item={item} />
              ))}
            </div>
          </section>
        )}

        <div
          data-testid="learn-category-filter"
          className="flex flex-wrap items-center gap-2 mb-12 border-y border-mino-forest/15 py-4"
        >
          {(["all", "business", "clinical", "specialty"] as const).map(
            (key) => {
              const active = category === key;
              return (
                <button
                  key={key}
                  type="button"
                  data-testid={`learn-filter-${key}`}
                  onClick={() => setCategory(key)}
                  className={`mino-eyebrow px-4 py-2 transition-colors border ${
                    active
                      ? "bg-mino-forest text-mino-cream border-mino-forest"
                      : "text-mino-forest/85 border-mino-forest/20 hover:border-mino-forest/50 hover:text-mino-forest"
                  }`}
                >
                  {CATEGORY_LABELS[key]}
                </button>
              );
            },
          )}
        </div>

        {isLoading && (
          <p
            data-testid="learn-catalog-loading"
            className="font-serif text-mino-forest/60"
          >
            Loading library…
          </p>
        )}

        {isError && (
          <p
            data-testid="learn-catalog-error"
            className="font-serif text-red-700"
          >
            {(error as Error)?.message ?? "Failed to load library."}
          </p>
        )}

        {!isLoading && !isError && (
          <div
            data-testid="learn-catalog-grid"
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {filtered.map((course) => (
              <CourseCard key={course.slug} course={course} />
            ))}
            {filtered.length === 0 && (
              <p
                data-testid="learn-catalog-empty"
                className="font-serif text-mino-forest/60 col-span-full"
              >
                No courses in this category yet.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function CourseCard({ course }: { course: LearnCatalogCourse }) {
  return (
    <Link
      href={`/learn/${course.slug}`}
      data-testid={`learn-card-${course.slug}`}
      className="group flex flex-col bg-mino-bone/40 border border-mino-forest/10 hover:border-mino-forest/40 transition-colors p-7"
    >
      <div className="flex items-start justify-between mb-5">
        <div className="h-12 w-12 rounded-md bg-mino-forest/8 flex items-center justify-center text-mino-forest">
          <LearnIcon name={course.icon} className="h-5 w-5" />
        </div>
        {course.enrolled && (
          <span
            data-testid={`learn-card-enrolled-${course.slug}`}
            className="mino-eyebrow inline-flex items-center gap-1.5 text-mino-sage-deep"
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Enrolled
          </span>
        )}
      </div>
      <p className="mino-eyebrow text-mino-sage-deep mb-3">
        {course.category}
      </p>
      <h3 className="font-serif text-2xl text-mino-forest leading-tight mb-3 group-hover:underline underline-offset-4">
        {course.title}
      </h3>
      <p className="font-serif text-base text-mino-forest/85 leading-relaxed mb-6 flex-1">
        {course.subtitle}
      </p>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-mino-forest/60 font-serif border-t border-mino-forest/10 pt-4">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" aria-hidden /> {course.duration}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5" aria-hidden />
          {course.lessonCount} {course.lessonCount === 1 ? "lesson" : "lessons"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" aria-hidden /> {course.audience}
        </span>
      </div>
      {course.enrolled && course.lessonCount > 0 && (
        <div className="mt-4">
          <div className="h-1 bg-mino-forest/10 overflow-hidden">
            <div
              className="h-full bg-mino-sage-deep"
              style={{ width: `${course.progressPercent}%` }}
              data-testid={`learn-card-progress-${course.slug}`}
            />
          </div>
          <p className="mino-eyebrow text-mino-sage-deep mt-2">
            {course.progressPercent}% complete
          </p>
        </div>
      )}
    </Link>
  );
}

function ContinueCard({ item }: { item: LearnDashboardItem }) {
  const resumeHref = item.nextLesson
    ? `/learn/${item.slug}/${item.nextLesson.slug}`
    : `/learn/${item.slug}`;
  return (
    <article
      data-testid={`continue-card-${item.slug}`}
      className="flex flex-col bg-mino-forest/[0.04] border border-mino-forest/15 hover:border-mino-forest/40 transition-colors p-5"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="h-9 w-9 rounded-md bg-mino-forest/10 flex items-center justify-center text-mino-forest shrink-0">
          <LearnIcon name={item.icon} className="h-4 w-4" />
        </div>
        <Link
          href={`/learn/${item.slug}`}
          className="font-serif text-lg text-mino-forest leading-tight hover:underline underline-offset-4 truncate"
        >
          {item.title}
        </Link>
      </div>
      {item.nextLesson && (
        <p className="font-serif text-sm text-mino-forest/85 mb-4">
          Next:{" "}
          <span data-testid={`continue-card-next-${item.slug}`}>
            {item.nextLesson.title}
          </span>{" "}
          <span className="text-mino-forest/50">· {item.nextLesson.duration}</span>
        </p>
      )}
      <div className="mt-auto">
        <div className="flex items-center justify-between gap-3 mb-2 text-xs font-serif text-mino-forest/60">
          <span>
            {item.completedLessons} / {item.lessonCount}{" "}
            {item.lessonCount === 1 ? "lesson" : "lessons"}
          </span>
          <span data-testid={`continue-card-percent-${item.slug}`}>
            {item.progressPercent}%
          </span>
        </div>
        <div className="h-1 bg-mino-forest/10 overflow-hidden mb-4">
          <div
            className="h-full bg-mino-sage-deep"
            style={{ width: `${item.progressPercent}%` }}
          />
        </div>
        <Link
          href={resumeHref}
          data-testid={`continue-card-resume-${item.slug}`}
          className="inline-flex items-center gap-2 mino-eyebrow text-mino-cream bg-mino-forest hover:bg-mino-ink transition-colors px-4 py-2.5"
        >
          {item.completedLessons === 0 ? "Start" : "Resume"}{" "}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </article>
  );
}
