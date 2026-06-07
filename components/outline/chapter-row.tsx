"use client";

import { useEffect, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, GripVertical, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ListEditor } from "@/components/ui/list-editor";
import { updateChapterAction } from "@/lib/actions/chapters";
import { cn, wordsLabel } from "@/lib/utils";
import type { Chapter } from "@/lib/db/types";

interface RowDraft {
  title: string;
  goal: string;
  summary: string;
  key_points: string[];
  estimated_word_count: number;
}

export function ChapterRow({
  chapter,
  index,
  onRemove,
}: {
  chapter: Chapter;
  index: number;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: chapter.id });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RowDraft>({
    title: chapter.title,
    goal: chapter.goal ?? "",
    summary: chapter.summary ?? "",
    key_points: chapter.key_points ?? [],
    estimated_word_count: chapter.estimated_word_count ?? 0,
  });

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFirst = useRef(true);
  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void updateChapterAction(chapter.id, draft);
    }, 900);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [draft, chapter.id]);

  function set<K extends keyof RowDraft>(key: K, value: RowDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-xl border border-line bg-surface shadow-paper",
        isDragging && "z-10 opacity-80 shadow-paper-lg",
      )}
    >
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          className="cursor-grab touch-none text-muted hover:text-ink active:cursor-grabbing"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <span className="w-6 shrink-0 text-center font-serif text-sm text-muted">
          {index + 1}
        </span>
        <Input
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
          className="h-9 flex-1 border-transparent bg-transparent font-serif text-base font-medium hover:border-line"
          placeholder="Chapter title"
        />
        <div className="hidden items-center gap-1 sm:flex">
          <Input
            type="number"
            value={draft.estimated_word_count || ""}
            onChange={(e) => set("estimated_word_count", Number(e.target.value) || 0)}
            className="h-9 w-20 text-right text-sm"
            placeholder="words"
          />
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Collapse" : "Expand"}
        >
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onRemove(chapter.id)}
          aria-label="Remove chapter"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {!open && (draft.goal || draft.summary) && (
        <p className="line-clamp-1 px-3 pb-3 pl-12 text-sm text-muted">
          {draft.goal || draft.summary}
        </p>
      )}

      {open && (
        <div className="space-y-4 border-t border-line/70 p-4 pl-12">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">Goal</label>
            <Input
              value={draft.goal}
              onChange={(e) => set("goal", e.target.value)}
              placeholder="What this chapter accomplishes"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">Summary</label>
            <Textarea
              value={draft.summary}
              onChange={(e) => set("summary", e.target.value)}
              placeholder="A few sentences on what happens here"
              rows={2}
              className="min-h-0"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">
              Key points
            </label>
            <ListEditor
              items={draft.key_points}
              onChange={(v) => set("key_points", v)}
              placeholder="A point to cover"
              addLabel="Add point"
            />
          </div>
          <p className="text-xs text-muted">
            Est. {wordsLabel(draft.estimated_word_count)}
          </p>
        </div>
      )}
    </div>
  );
}
