import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import {
  ArrowRight,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  History,
  Share2,
} from "lucide-react";
import {
  certificateDownloadUrl,
  fetchDashboard,
  fetchEarnedCertificates,
  type LearnDashboardItem,
  type LearnEarnedCertificate,
  type LearnRecentLesson,
} from "@/lib/learn-api";
import { LearnIcon } from "@/components/learn-icon";

export default function LearnDashboardPage() {
  const { user } = useAuth();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["learn", "dashboard"],
    queryFn: fetchDashboard,
  });

  const certificatesQuery = useQuery({
    queryKey: ["learn", "certificates"],
    queryFn: fetchEarnedCertificates,
  });

  const greetingName = user?.firstName || user?.email?.split("@")[0] || "";

  return (
    <main
      data-testid="page-learn-dashboard"
      className="min-h-screen bg-mino-cream pt-32 pb-24 px-6 md:px-12"
    >
      <div className="max-w-[88rem] mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <span className="mino-rule" />
          <span className="mino-eyebrow text-mino-sage-deep">
            Vol. II · Your library
          </span>
        </div>
        <h1
          data-testid="dashboard-heading"
          className="font-serif text-5xl md:text-6xl text-mino-forest mb-5 max-w-3xl leading-[1.05]"
        >
          {greetingName ? `Welcome back, ${greetingName}.` : "Your library."}
        </h1>
        <p className="font-serif text-lg md:text-xl text-mino-forest/85 max-w-2xl mb-12 leading-relaxed">
          Pick up where you left off, or browse the full library to start
          something new.
        </p>

        {isLoading && (
          <p
            data-testid="dashboard-loading"
            className="font-serif text-mino-forest/60"
          >
            Loading your library…
          </p>
        )}

        {isError && (
          <p
            data-testid="dashboard-error"
            className="font-serif text-red-700"
          >
            {(error as Error)?.message ?? "Failed to load your library."}
          </p>
        )}

        {!isLoading && !isError && data && data.items.length === 0 && (
          <EmptyState />
        )}

        {!isLoading && !isError && data && data.items.length > 0 && (
          <div
            data-testid="dashboard-list"
            className="grid gap-6 md:grid-cols-2"
          >
            {data.items.map((item) => (
              <DashboardCard key={item.slug} item={item} />
            ))}
          </div>
        )}

        {!isLoading && !isError && data && data.recentLessons.length > 0 && (
          <RecentlyViewed lessons={data.recentLessons} />
        )}

        {certificatesQuery.data && certificatesQuery.data.length > 0 && (
          <EarnedCertificates certificates={certificatesQuery.data} />
        )}

        {!isLoading && !isError && data && data.items.length > 0 && (
          <div className="mt-14 pt-8 border-t border-mino-forest/10 flex items-center justify-between flex-wrap gap-4">
            <p className="font-serif text-mino-forest/85">
              Looking for something new?
            </p>
            <Link
              href="/learn"
              data-testid="link-browse-library"
              className="inline-flex items-center gap-2 mino-eyebrow text-mino-forest border border-mino-forest/30 hover:border-mino-forest/60 transition-colors px-5 py-2.5"
            >
              Browse all courses <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

function EmptyState() {
  return (
    <div
      data-testid="dashboard-empty"
      className="border border-mino-forest/15 bg-mino-bone/30 p-10 max-w-2xl"
    >
      <Compass className="h-6 w-6 text-mino-sage-deep mb-4" aria-hidden />
      <h2 className="font-serif text-2xl text-mino-forest mb-3">
        You haven't enrolled in anything yet.
      </h2>
      <p className="font-serif text-mino-forest/85 mb-6">
        The library is free for members. Pick a course to start — your progress
        will show up here.
      </p>
      <Link
        href="/learn"
        data-testid="link-browse-empty"
        className="inline-flex items-center gap-2 mino-eyebrow text-mino-cream bg-mino-forest hover:bg-mino-ink transition-colors px-5 py-3"
      >
        Browse the library <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}

function RecentlyViewed({ lessons }: { lessons: LearnRecentLesson[] }) {
  return (
    <section
      data-testid="dashboard-recent"
      className="mt-14 pt-8 border-t border-mino-forest/10"
    >
      <div className="flex items-center gap-3 mb-6">
        <History className="h-4 w-4 text-mino-sage-deep" aria-hidden />
        <span className="mino-eyebrow text-mino-sage-deep">
          Recently viewed
        </span>
      </div>
      <ul
        data-testid="dashboard-recent-list"
        className="grid gap-3 md:grid-cols-2"
      >
        {lessons.map((l) => (
          <li key={l.lessonId}>
            <Link
              href={`/learn/${l.courseSlug}/${l.lessonSlug}`}
              data-testid={`dashboard-recent-${l.lessonId}`}
              className="group flex items-start gap-4 p-4 border border-mino-forest/10 hover:border-mino-forest/40 bg-mino-bone/30 transition-colors"
            >
              <BookOpen
                className="h-4 w-4 text-mino-sage-deep mt-1 shrink-0"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="mino-eyebrow text-mino-sage-deep mb-1 truncate">
                  {l.courseTitle}
                </p>
                <p className="font-serif text-lg text-mino-forest leading-snug group-hover:underline underline-offset-4 truncate">
                  {l.lessonTitle}
                </p>
                <p className="mt-2 flex items-center gap-3 text-xs font-serif text-mino-forest/60">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" aria-hidden /> {l.lessonDuration}
                  </span>
                  <span>· Opened {formatRelativeDate(l.lastViewedAt)}</span>
                </p>
              </div>
              <ArrowRight
                className="h-4 w-4 text-mino-forest/40 group-hover:text-mino-forest mt-1 shrink-0"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DashboardCard({ item }: { item: LearnDashboardItem }) {
  const resumeHref = item.nextLesson
    ? `/learn/${item.slug}/${item.nextLesson.slug}`
    : `/learn/${item.slug}`;
  const resumeLabel = item.completed
    ? "Review course"
    : item.completedLessons === 0
    ? "Start course"
    : "Resume";

  return (
    <article
      data-testid={`dashboard-card-${item.slug}`}
      className="flex flex-col bg-mino-bone/40 border border-mino-forest/10 hover:border-mino-forest/40 transition-colors p-7"
    >
      <div className="flex items-start justify-between mb-5">
        <div className="h-12 w-12 rounded-md bg-mino-forest/8 flex items-center justify-center text-mino-forest">
          <LearnIcon name={item.icon} className="h-5 w-5" />
        </div>
        {item.completed ? (
          <span
            data-testid={`dashboard-card-complete-${item.slug}`}
            className="mino-eyebrow inline-flex items-center gap-1.5 text-mino-sage-deep"
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Complete
          </span>
        ) : (
          <span className="mino-eyebrow text-mino-sage-deep">
            {item.category}
          </span>
        )}
      </div>

      <Link
        href={`/learn/${item.slug}`}
        data-testid={`dashboard-card-title-${item.slug}`}
        className="font-serif text-2xl text-mino-forest leading-tight mb-3 hover:underline underline-offset-4"
      >
        {item.title}
      </Link>
      <p className="font-serif text-base text-mino-forest/85 leading-relaxed mb-5">
        {item.subtitle}
      </p>

      <div className="mt-auto">
        <div className="flex items-center justify-between gap-4 mb-2 text-xs font-serif text-mino-forest/60">
          <span>
            {item.completedLessons} / {item.lessonCount}{" "}
            {item.lessonCount === 1 ? "lesson" : "lessons"}
          </span>
          <span data-testid={`dashboard-card-percent-${item.slug}`}>
            {item.progressPercent}%
          </span>
        </div>
        <div className="h-1 bg-mino-forest/10 overflow-hidden">
          <div
            className="h-full bg-mino-sage-deep"
            style={{ width: `${item.progressPercent}%` }}
            data-testid={`dashboard-card-progress-${item.slug}`}
          />
        </div>

        <div className="mt-5 flex items-center gap-4 flex-wrap">
          <Link
            href={resumeHref}
            data-testid={`dashboard-card-resume-${item.slug}`}
            className="inline-flex items-center gap-2 mino-eyebrow text-mino-cream bg-mino-forest hover:bg-mino-ink transition-colors px-4 py-2.5"
          >
            {resumeLabel} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
          {item.completed && (
            <a
              href={certificateDownloadUrl(item.slug)}
              data-testid={`dashboard-card-certificate-${item.slug}`}
              className="inline-flex items-center gap-2 mino-eyebrow text-mino-forest border border-mino-forest/30 hover:border-mino-forest/60 transition-colors px-4 py-2.5"
            >
              <Award className="h-3.5 w-3.5" aria-hidden /> Download certificate
            </a>
          )}
          {item.nextLesson && !item.completed && (
            <span className="font-serif text-sm text-mino-forest/60 inline-flex items-center gap-3 min-w-0">
              <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span
                data-testid={`dashboard-card-next-${item.slug}`}
                className="truncate"
              >
                {item.nextLesson.title}
              </span>
              <span className="inline-flex items-center gap-1 shrink-0 text-mino-forest/50">
                <Clock className="h-3 w-3" aria-hidden />
                {item.nextLesson.duration}
              </span>
            </span>
          )}
        </div>

        <p className="mt-4 mino-eyebrow text-mino-sage-deep">
          Last activity {formatRelativeDate(item.lastActivityAt)}
        </p>
      </div>
    </article>
  );
}

function EarnedCertificates({
  certificates,
}: {
  certificates: LearnEarnedCertificate[];
}) {
  return (
    <section
      data-testid="dashboard-certificates"
      className="mt-14 pt-8 border-t border-mino-forest/10"
    >
      <div className="flex items-center gap-3 mb-6">
        <Award className="h-4 w-4 text-mino-sage-deep" aria-hidden />
        <span className="mino-eyebrow text-mino-sage-deep">
          Achievements · {certificates.length}
          {" "}
          {certificates.length === 1 ? "certificate" : "certificates"} earned
        </span>
      </div>
      <ul
        data-testid="dashboard-certificates-list"
        className="grid gap-4 md:grid-cols-2"
      >
        {certificates.map((c) => (
          <li key={c.certificateId}>
            <CertificateCard certificate={c} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CertificateCard({
  certificate,
}: {
  certificate: LearnEarnedCertificate;
}) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(certificate.verifyUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback for browsers without clipboard support: open the URL
      // so the member can copy it manually from the address bar.
      window.open(certificate.verifyUrl, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <article
      data-testid={`certificate-card-${certificate.courseSlug}`}
      className="flex items-start gap-5 p-5 border border-mino-forest/10 hover:border-mino-forest/40 bg-mino-bone/30 transition-colors"
    >
      <div className="h-12 w-12 rounded-md bg-mino-forest/8 flex items-center justify-center text-mino-forest shrink-0">
        <LearnIcon name={certificate.courseIcon} className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="mino-eyebrow text-mino-sage-deep mb-1">
          {certificate.courseCategory}
        </p>
        <Link
          href={`/learn/${certificate.courseSlug}`}
          className="font-serif text-xl text-mino-forest leading-snug hover:underline underline-offset-4"
          data-testid={`certificate-card-title-${certificate.courseSlug}`}
        >
          {certificate.courseTitle}
        </Link>
        <p className="mt-1 text-xs font-serif text-mino-forest/60">
          Issued {formatIssuedDate(certificate.issuedAt)}
          <span className="ml-2 text-mino-forest/40">
            · ID {certificate.certificateId}
          </span>
        </p>
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <a
            href={certificate.downloadUrl}
            data-testid={`certificate-card-download-${certificate.courseSlug}`}
            className="inline-flex items-center gap-2 mino-eyebrow text-mino-cream bg-mino-forest hover:bg-mino-ink transition-colors px-3.5 py-2"
          >
            <Award className="h-3.5 w-3.5" aria-hidden /> Download
          </a>
          <button
            type="button"
            onClick={handleShare}
            data-testid={`certificate-card-share-${certificate.courseSlug}`}
            className="inline-flex items-center gap-2 mino-eyebrow text-mino-forest border border-mino-forest/30 hover:border-mino-forest/60 transition-colors px-3.5 py-2"
            aria-label={`Copy verification link for ${certificate.courseTitle}`}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" aria-hidden /> Link copied
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5" aria-hidden /> Share
              </>
            )}
          </button>
          <a
            href={certificate.verifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={`certificate-card-verify-${certificate.courseSlug}`}
            className="text-xs font-serif text-mino-forest/60 hover:text-mino-forest underline underline-offset-4"
          >
            View verification page
          </a>
        </div>
      </div>
    </article>
  );
}

function formatIssuedDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < minute) return "just now";
  if (diffMs < hour) {
    const m = Math.floor(diffMs / minute);
    return `${m} minute${m === 1 ? "" : "s"} ago`;
  }
  if (diffMs < day) {
    const h = Math.floor(diffMs / hour);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  if (diffMs < 30 * day) {
    const d = Math.floor(diffMs / day);
    return `${d} day${d === 1 ? "" : "s"} ago`;
  }
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
