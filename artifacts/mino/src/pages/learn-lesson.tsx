import { useMemo, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
} from "lucide-react";
import {
  fetchLesson,
  markLessonComplete,
  recordLessonView,
  unmarkLessonComplete,
  type LearnLessonDetail,
  type LearnQuizQuestion,
} from "@/lib/learn-api";

interface Props {
  params: { courseSlug: string; lessonSlug: string };
}

export default function LearnLessonPage({ params }: Props) {
  const { courseSlug, lessonSlug } = params;
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const queryKey = ["learn", "lesson", courseSlug, lessonSlug];
  const { data, isLoading, isError, error } = useQuery({
    queryKey,
    queryFn: () => fetchLesson(courseSlug, lessonSlug),
  });

  // If the API tells us they're not enrolled, redirect to the course page so
  // they can enroll. (Server returns 403 when there's no enrollment.)
  useEffect(() => {
    if (
      isError &&
      error instanceof Error &&
      error.message.toLowerCase().includes("enroll")
    ) {
      navigate(`/learn/${courseSlug}`, { replace: true });
    }
  }, [isError, error, navigate, courseSlug]);

  // Record this lesson view (independent of completion) so the dashboard
  // "Recently viewed" strip can surface partial visits. Fires once per
  // lesson load. Failures are non-blocking — viewing lessons must not
  // depend on this analytic write succeeding.
  const lessonId = data?.lesson.id;
  useEffect(() => {
    if (!lessonId) return;
    let cancelled = false;
    recordLessonView(lessonId)
      .then(() => {
        if (cancelled) return;
        queryClient.invalidateQueries({ queryKey: ["learn", "dashboard"] });
      })
      .catch(() => {
        // Ignore — recording a view is best-effort and must never block reading.
      });
    return () => {
      cancelled = true;
    };
  }, [lessonId, queryClient]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-mino-cream pt-32 pb-24 px-6 md:px-12">
        <p
          data-testid="learn-lesson-loading"
          className="font-serif text-mino-forest/60"
        >
          Loading lesson…
        </p>
      </main>
    );
  }
  if (isError || !data) {
    return (
      <main className="min-h-screen bg-mino-cream pt-32 pb-24 px-6 md:px-12">
        <p
          data-testid="learn-lesson-error"
          className="font-serif text-red-700"
        >
          {(error as Error)?.message ?? "Lesson not found."}
        </p>
      </main>
    );
  }

  return (
    <LessonView
      data={data}
      courseSlug={courseSlug}
      onProgressChange={() => {
        queryClient.invalidateQueries({ queryKey });
        queryClient.invalidateQueries({
          queryKey: ["learn", "course", courseSlug],
        });
        queryClient.invalidateQueries({ queryKey: ["learn", "catalog"] });
        queryClient.invalidateQueries({ queryKey: ["learn", "dashboard"] });
      }}
    />
  );
}

function LessonView({
  data,
  courseSlug,
  onProgressChange,
}: {
  data: LearnLessonDetail;
  courseSlug: string;
  onProgressChange: () => void;
}) {
  const { lesson, module, siblings, progress } = data;

  const completedFromServer = Boolean(progress?.completed);

  const complete = useMutation({
    mutationFn: (quizScore?: number) =>
      markLessonComplete(lesson.id, quizScore),
    onSuccess: onProgressChange,
  });

  const uncomplete = useMutation({
    mutationFn: () => unmarkLessonComplete(lesson.id),
    onSuccess: onProgressChange,
  });

  return (
    <main
      data-testid="page-learn-lesson"
      className="min-h-screen bg-mino-cream pt-32 pb-24 px-6 md:px-12"
    >
      <div className="max-w-3xl mx-auto">
        <Link
          href={`/learn/${courseSlug}`}
          data-testid="link-back-to-course"
          className="inline-flex items-center gap-2 mino-eyebrow text-mino-forest/60 hover:text-mino-forest mb-8"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Course outline
        </Link>

        <div className="flex items-center gap-3 mb-5">
          <span className="mino-rule" />
          <span className="mino-eyebrow text-mino-sage-deep">
            Lesson {lesson.position}
            {module ? ` · ${module.title.replace(/\s+—.*$/, "")}` : ""}
          </span>
        </div>

        <h1
          data-testid="lesson-title"
          className="font-serif text-4xl md:text-5xl text-mino-forest leading-[1.05] mb-3"
        >
          {lesson.title}
        </h1>

        {module && (
          <p className="font-serif text-mino-forest/85 italic mb-6">
            {module.objective}
          </p>
        )}

        <div className="flex items-center gap-x-5 text-sm text-mino-forest/60 font-serif mb-10 border-b border-mino-forest/10 pb-6">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4" aria-hidden /> {lesson.duration}
          </span>
        </div>

        <div className="prose prose-lg max-w-none mb-12">
          <ul
            data-testid="lesson-content"
            className="space-y-4 list-none pl-0"
          >
            {lesson.contentItems.map((item, idx) => (
              <li
                key={idx}
                className="flex gap-3 font-serif text-mino-forest/90 leading-relaxed text-lg"
              >
                <span className="text-mino-sage-deep shrink-0">·</span>
                <span>{item.body}</span>
              </li>
            ))}
          </ul>
        </div>

        {lesson.quiz && lesson.quiz.length > 0 && (
          <Quiz
            quiz={lesson.quiz}
            onSubmit={(score) => complete.mutate(score)}
            disabled={complete.isPending}
          />
        )}

        <div className="border-t border-mino-forest/10 pt-8 mt-10 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {completedFromServer ? (
              <button
                type="button"
                data-testid="button-mark-incomplete"
                disabled={uncomplete.isPending}
                onClick={() => uncomplete.mutate()}
                className="inline-flex items-center gap-2 mino-eyebrow text-mino-forest border border-mino-forest/30 hover:border-mino-forest/60 transition-colors px-5 py-2.5"
              >
                <CheckCircle2
                  className="h-4 w-4 text-mino-sage-deep"
                  aria-hidden
                />
                {uncomplete.isPending ? "Updating…" : "Completed"}
              </button>
            ) : (
              <button
                type="button"
                data-testid="button-mark-complete"
                disabled={complete.isPending}
                onClick={() => complete.mutate(undefined)}
                className="inline-flex items-center gap-2 mino-eyebrow text-mino-cream bg-mino-forest hover:bg-mino-ink disabled:opacity-50 transition-colors px-5 py-2.5"
              >
                <Circle className="h-4 w-4" aria-hidden />
                {complete.isPending ? "Saving…" : "Mark complete"}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {siblings.prev && (
              <Link
                href={`/learn/${courseSlug}/${siblings.prev.slug}`}
                data-testid="link-prev-lesson"
                className="inline-flex items-center gap-2 mino-eyebrow text-mino-forest/85 hover:text-mino-forest border border-mino-forest/20 hover:border-mino-forest/50 px-4 py-2.5 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Previous
              </Link>
            )}
            {siblings.next && (
              <Link
                href={`/learn/${courseSlug}/${siblings.next.slug}`}
                data-testid="link-next-lesson"
                className="inline-flex items-center gap-2 mino-eyebrow text-mino-forest/85 hover:text-mino-forest border border-mino-forest/20 hover:border-mino-forest/50 px-4 py-2.5 transition-colors"
              >
                Next <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function Quiz({
  quiz,
  onSubmit,
  disabled,
}: {
  quiz: LearnQuizQuestion[];
  onSubmit: (score: number) => void;
  disabled?: boolean;
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const score = useMemo(() => {
    const correct = quiz.filter(
      (q, i) => answers[i] === q.correctIndex,
    ).length;
    return Math.round((correct / quiz.length) * 100);
  }, [answers, quiz]);

  function handleSubmit() {
    setSubmitted(true);
    onSubmit(score);
  }

  return (
    <section
      data-testid="lesson-quiz"
      className="mt-12 border-t border-mino-forest/10 pt-8"
    >
      <div className="flex items-center gap-3 mb-6">
        <span className="mino-rule" />
        <span className="mino-eyebrow text-mino-sage-deep">
          Knowledge check
        </span>
      </div>

      <ol className="space-y-8">
        {quiz.map((q, qi) => {
          const selected = answers[qi];
          return (
            <li key={qi} data-testid={`quiz-question-${qi}`}>
              <p className="font-serif text-lg text-mino-forest mb-3">
                {qi + 1}. {q.question}
              </p>
              <div className="space-y-2">
                {q.options.map((opt, oi) => {
                  const chosen = selected === oi;
                  const isCorrect = oi === q.correctIndex;
                  const showResult = submitted;
                  return (
                    <button
                      key={oi}
                      type="button"
                      data-testid={`quiz-q${qi}-opt${oi}`}
                      onClick={() =>
                        !submitted &&
                        setAnswers((prev) => ({ ...prev, [qi]: oi }))
                      }
                      className={`w-full text-left font-serif px-4 py-3 border transition-colors ${
                        showResult
                          ? isCorrect
                            ? "border-mino-sage-deep bg-mino-sage-deep/10 text-mino-forest"
                            : chosen
                              ? "border-red-400 bg-red-50 text-red-900"
                              : "border-mino-forest/15 text-mino-forest/85"
                          : chosen
                            ? "border-mino-forest/60 bg-mino-bone/40 text-mino-forest"
                            : "border-mino-forest/15 hover:border-mino-forest/40 text-mino-forest/90"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex items-center justify-between gap-4 mt-8">
        {submitted ? (
          <p
            data-testid="quiz-score"
            className="font-serif text-mino-forest"
          >
            Score: <span className="font-semibold">{score}%</span>
          </p>
        ) : (
          <span />
        )}
        <button
          type="button"
          data-testid="button-submit-quiz"
          disabled={
            disabled ||
            submitted ||
            Object.keys(answers).length !== quiz.length
          }
          onClick={handleSubmit}
          className="inline-flex items-center gap-2 mino-eyebrow text-mino-cream bg-mino-forest hover:bg-mino-ink disabled:opacity-50 disabled:cursor-not-allowed transition-colors px-5 py-2.5"
        >
          {submitted ? "Submitted" : "Submit answers"}
        </button>
      </div>
    </section>
  );
}
