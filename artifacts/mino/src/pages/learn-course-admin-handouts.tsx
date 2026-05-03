import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from "lucide-react";
import {
  type AdminHandout,
  createAdminHandout,
  deleteAdminHandout,
  fetchAdminHandouts,
  reorderAdminHandouts,
  updateAdminHandout,
} from "@/lib/learn-api";
import { useAdminStatus } from "@/hooks/use-admin-status";

interface Props {
  params: { courseSlug: string };
}

export default function LearnCourseAdminHandoutsPage({ params }: Props) {
  const { courseSlug } = params;
  const { isAdmin, isLoading: adminLoading } = useAdminStatus();

  if (adminLoading) {
    return (
      <main className="min-h-screen bg-mino-cream pt-32 pb-24 px-6 md:px-12">
        <p
          data-testid="learn-admin-handouts-loading"
          className="font-serif text-mino-forest/60"
        >
          Loading…
        </p>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-mino-cream pt-32 pb-24 px-6 md:px-12">
        <p
          data-testid="learn-admin-handouts-forbidden"
          className="font-serif text-red-700"
        >
          You don't have permission to manage handouts.
        </p>
        <Link
          href={`/learn/${courseSlug}`}
          className="mt-6 inline-flex items-center gap-2 mino-eyebrow text-mino-forest underline underline-offset-4"
        >
          ← Back to course
        </Link>
      </main>
    );
  }

  return <Editor courseSlug={courseSlug} />;
}

function Editor({ courseSlug }: { courseSlug: string }) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => ["learn", "admin", "handouts", courseSlug] as const,
    [courseSlug],
  );

  const { data, isLoading, isError, error } = useQuery({
    queryKey,
    queryFn: () => fetchAdminHandouts(courseSlug),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: [...queryKey] });

  const createMut = useMutation({
    mutationFn: () =>
      createAdminHandout(courseSlug, {
        title: "Untitled handout",
        description: "",
        body: "",
      }),
    onSuccess: invalidate,
  });

  const reorderMut = useMutation({
    mutationFn: (ids: string[]) => reorderAdminHandouts(courseSlug, ids),
    onSuccess: invalidate,
  });

  if (isLoading) {
    return (
      <main className="min-h-screen bg-mino-cream pt-32 pb-24 px-6 md:px-12">
        <p
          data-testid="learn-admin-handouts-loading"
          className="font-serif text-mino-forest/60"
        >
          Loading handouts…
        </p>
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="min-h-screen bg-mino-cream pt-32 pb-24 px-6 md:px-12">
        <p
          data-testid="learn-admin-handouts-error"
          className="font-serif text-red-700"
        >
          {(error as Error)?.message ?? "Failed to load handouts."}
        </p>
      </main>
    );
  }

  const move = (index: number, direction: -1 | 1) => {
    const ids = data.handouts.map((h) => h.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    const next = [...ids];
    [next[index], next[target]] = [next[target]!, next[index]!];
    reorderMut.mutate(next);
  };

  return (
    <main
      data-testid="page-learn-admin-handouts"
      className="min-h-screen bg-mino-cream pt-32 pb-24 px-6 md:px-12"
    >
      <div className="max-w-3xl mx-auto">
        <Link
          href={`/learn/${courseSlug}`}
          className="inline-flex items-center gap-2 mino-eyebrow text-mino-forest mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to course
        </Link>

        <h1 className="font-serif text-3xl text-mino-forest mb-2">
          Handouts — {data.course.title}
        </h1>
        <p className="font-serif text-mino-forest/65 mb-8">
          Edit the printable handouts learners receive with this course.
          Importer-generated handouts can be edited too — once you save, they
          become admin-owned and the importer will leave them alone.
        </p>

        <div className="mb-6 flex items-center justify-between">
          <span className="mino-eyebrow text-mino-forest/60">
            {data.handouts.length} handout
            {data.handouts.length === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            data-testid="learn-admin-handout-add"
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending}
            className="inline-flex items-center gap-2 mino-eyebrow text-mino-forest border border-mino-forest/30 hover:border-mino-forest/60 transition-colors px-4 py-2 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden /> Add handout
          </button>
        </div>

        {data.handouts.length === 0 ? (
          <p
            data-testid="learn-admin-handouts-empty"
            className="font-serif text-mino-forest/60 border border-dashed border-mino-forest/30 px-6 py-10 text-center"
          >
            No handouts yet — click "Add handout" to create one.
          </p>
        ) : (
          <ul className="space-y-6">
            {data.handouts.map((h, i) => (
              <HandoutCard
                key={h.id}
                courseSlug={courseSlug}
                handout={h}
                onMoveUp={i > 0 ? () => move(i, -1) : undefined}
                onMoveDown={
                  i < data.handouts.length - 1 ? () => move(i, 1) : undefined
                }
                onChanged={invalidate}
              />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function HandoutCard({
  courseSlug,
  handout,
  onMoveUp,
  onMoveDown,
  onChanged,
}: {
  courseSlug: string;
  handout: AdminHandout;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onChanged: () => void | Promise<unknown>;
}) {
  const [title, setTitle] = useState(handout.title);
  const [description, setDescription] = useState(handout.description);
  const [body, setBody] = useState(handout.body);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Reset local form state when a server-side update changes the upstream
  // row (e.g. another admin edited it, or a reorder bumped position).
  useEffect(() => {
    setTitle(handout.title);
    setDescription(handout.description);
    setBody(handout.body);
  }, [handout.id, handout.updatedAt]);

  const saveMut = useMutation({
    mutationFn: () =>
      updateAdminHandout(courseSlug, handout.id, { title, description, body }),
    onSuccess: async () => {
      setSavedAt(new Date().toLocaleTimeString());
      await onChanged();
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteAdminHandout(courseSlug, handout.id),
    onSuccess: onChanged,
  });

  const dirty =
    title !== handout.title ||
    description !== handout.description ||
    body !== handout.body;

  return (
    <li
      data-testid={`learn-admin-handout-${handout.id}`}
      className="border border-mino-forest/15 bg-white/40 p-5"
    >
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2">
          <span className="mino-eyebrow text-mino-sage-deep">
            #{handout.position}
          </span>
          {!handout.isAuthored && (
            <span
              data-testid={`learn-admin-handout-auto-${handout.id}`}
              className="mino-eyebrow text-mino-forest/50"
            >
              Auto-generated
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-testid={`learn-admin-handout-up-${handout.id}`}
            onClick={onMoveUp}
            disabled={!onMoveUp}
            className="p-2 text-mino-forest/85 disabled:opacity-30 hover:text-mino-forest"
            aria-label="Move up"
          >
            <ArrowUp className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            data-testid={`learn-admin-handout-down-${handout.id}`}
            onClick={onMoveDown}
            disabled={!onMoveDown}
            className="p-2 text-mino-forest/85 disabled:opacity-30 hover:text-mino-forest"
            aria-label="Move down"
          >
            <ArrowDown className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            data-testid={`learn-admin-handout-delete-${handout.id}`}
            onClick={() => {
              if (confirm("Delete this handout?")) deleteMut.mutate();
            }}
            disabled={deleteMut.isPending}
            className="p-2 text-red-700/70 hover:text-red-700 disabled:opacity-30"
            aria-label="Delete handout"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <label className="block mb-3">
        <span className="mino-eyebrow text-mino-forest/60 mb-1 block">
          Title
        </span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          data-testid={`learn-admin-handout-title-${handout.id}`}
          className="w-full font-serif text-lg text-mino-forest bg-transparent border-b border-mino-forest/20 focus:border-mino-forest focus:outline-none py-1"
        />
      </label>

      <label className="block mb-3">
        <span className="mino-eyebrow text-mino-forest/60 mb-1 block">
          Description
        </span>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          data-testid={`learn-admin-handout-description-${handout.id}`}
          className="w-full font-serif text-mino-forest bg-transparent border-b border-mino-forest/20 focus:border-mino-forest focus:outline-none py-1"
        />
      </label>

      <label className="block mb-4">
        <span className="mino-eyebrow text-mino-forest/60 mb-1 block">
          Body (markdown)
        </span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          data-testid={`learn-admin-handout-body-${handout.id}`}
          rows={10}
          className="w-full font-mono text-sm text-mino-forest bg-white/60 border border-mino-forest/20 focus:border-mino-forest focus:outline-none p-3 resize-y"
        />
      </label>

      <div className="flex items-center justify-between">
        <span
          data-testid={`learn-admin-handout-status-${handout.id}`}
          className="mino-eyebrow text-mino-forest/50"
        >
          {saveMut.isError
            ? `Save failed: ${(saveMut.error as Error).message}`
            : savedAt
              ? `Saved at ${savedAt}`
              : dirty
                ? "Unsaved changes"
                : "Up to date"}
        </span>
        <button
          type="button"
          data-testid={`learn-admin-handout-save-${handout.id}`}
          onClick={() => saveMut.mutate()}
          disabled={!dirty || saveMut.isPending}
          className="inline-flex items-center gap-2 mino-eyebrow text-mino-cream bg-mino-forest hover:bg-mino-forest/90 transition-colors px-4 py-2 disabled:opacity-50"
        >
          {saveMut.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </li>
  );
}
