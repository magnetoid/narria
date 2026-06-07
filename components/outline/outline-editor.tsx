"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ArrowRight, ListTree, Plus, RefreshCw, Sparkles } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { BookPage, SectionHeader } from "@/components/layout/book-page";
import { ChapterRow } from "./chapter-row";
import {
  addChapterAction,
  deleteChapterAction,
  generateOutlineAction,
  reorderChaptersAction,
} from "@/lib/actions/chapters";
import { formatNumber } from "@/lib/utils";
import type { Chapter } from "@/lib/db/types";

export function OutlineEditor({
  bookId,
  initialChapters,
}: {
  bookId: string;
  initialChapters: Chapter[];
}) {
  const router = useRouter();
  const [chapters, setChapters] = useState<Chapter[]>(initialChapters);
  const [busy, startBusy] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const totalWords = chapters.reduce((s, c) => s + (c.estimated_word_count || 0), 0);

  function generate(regenerate = false) {
    if (regenerate && !window.confirm("Regenerate will replace your current outline. Continue?"))
      return;
    setError(null);
    startBusy(async () => {
      const res = await generateOutlineAction(bookId);
      if ("error" in res) setError(res.error);
      else router.refresh();
    });
  }

  async function addChapter() {
    const res = await addChapterAction(bookId);
    if ("chapter" in res) setChapters((prev) => [...prev, res.chapter]);
    else setError(res.error);
  }

  function removeChapter(id: string) {
    setChapters((prev) => prev.filter((c) => c.id !== id));
    void deleteChapterAction(id);
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      setChapters((prev) => {
        const oldIndex = prev.findIndex((c) => c.id === active.id);
        const newIndex = prev.findIndex((c) => c.id === over.id);
        const next = arrayMove(prev, oldIndex, newIndex);
        void reorderChaptersAction(next.map((c) => c.id));
        return next;
      });
    }
  }

  if (chapters.length === 0) {
    return (
      <BookPage>
        <SectionHeader
          title="Outline"
          description="Generate a table of contents, then edit, add, remove, and reorder chapters."
        />
        <EmptyState
          icon={<ListTree className="size-6" />}
          title="No outline yet"
          description="Generate a complete table of contents from your Book Brain — then make it yours."
          action={
            <Button size="lg" onClick={() => generate(false)} disabled={busy}>
              {busy ? <Spinner /> : <Sparkles className="size-4" />}
              Generate outline
            </Button>
          }
        />
        {error && (
          <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
      </BookPage>
    );
  }

  return (
    <BookPage>
      <SectionHeader
        title="Outline"
        description={`${chapters.length} chapters · ~${formatNumber(totalWords)} words`}
        action={
          <>
            <Button variant="secondary" size="sm" onClick={() => generate(true)} disabled={busy}>
              {busy ? <Spinner /> : <RefreshCw className="size-4" />}
              Regenerate
            </Button>
            <Link href={`/books/${bookId}/chapters`} className={buttonVariants({ size: "sm" })}>
              Write
              <ArrowRight className="size-4" />
            </Link>
          </>
        }
      />

      {error && (
        <p className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={chapters.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2.5">
            {chapters.map((c, i) => (
              <ChapterRow key={c.id} chapter={c} index={i} onRemove={removeChapter} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button variant="outline" className="mt-3 w-full" onClick={addChapter}>
        <Plus className="size-4" />
        Add chapter
      </Button>
    </BookPage>
  );
}
