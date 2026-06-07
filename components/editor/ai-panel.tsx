"use client";

import { useState, type RefObject } from "react";
import { Sparkles, X } from "lucide-react";
import { Icon } from "@/components/icon";
import { Spinner } from "@/components/ui/spinner";
import { CHAPTER_AI_ACTIONS, type ChapterAiAction } from "@/lib/constants";
import { runChapterEdit, runChapterReview } from "@/lib/actions/chapter-ai";
import { cn } from "@/lib/utils";
import type { Chapter } from "@/lib/db/types";
import type { ChapterEditorHandle } from "./chapter-editor";

const GROUPS: { id: ChapterAiAction["group"]; label: string }[] = [
  { id: "write", label: "Write" },
  { id: "transform", label: "Edit selection" },
  { id: "review", label: "Review" },
];

export function AiPanel({
  bookId,
  chapterId,
  chapter,
  editorRef,
}: {
  bookId: string;
  chapterId: string;
  chapter: Chapter;
  editorRef: RefObject<ChapterEditorHandle | null>;
}) {
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<{ title: string; text: string } | null>(null);

  async function run(action: ChapterAiAction) {
    const ed = editorRef.current;
    if (!ed || running) return;
    setError(null);

    if (action.id === "continue") {
      setRunning("continue");
      try {
        const currentText = ed.getText();
        ed.beginStream();
        const res = await fetch("/api/ai/continue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookId, chapterId, currentText }),
        });
        if (!res.ok || !res.body) throw new Error("Generation failed.");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          ed.streamChunk(decoder.decode(value, { stream: true }));
        }
        ed.endStream();
      } catch (e) {
        setError((e as Error).message);
      }
      setRunning(null);
      return;
    }

    if (action.group === "review") {
      setRunning(action.id);
      const res = await runChapterReview(action.id, bookId, chapterId, ed.getHTML());
      setRunning(null);
      if ("error" in res) setError(res.error);
      else setNote({ title: action.label, text: res.text });
      return;
    }

    // transform
    const selection = ed.getSelectedText();
    if (action.needsSelection && !selection.trim()) {
      setError("Select some text in the editor first.");
      return;
    }
    setRunning(action.id);
    const res = await runChapterEdit(action.id, bookId, chapterId, selection);
    setRunning(null);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    if (action.output === "replace") ed.replaceSelection(res.text);
    else ed.appendParagraphs(res.text);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line/70 p-4">
        <h2 className="flex items-center gap-1.5 font-serif text-sm font-semibold text-ink">
          <Sparkles className="size-4 text-accent" />
          AI assistant
        </h2>
        {chapter.goal ? (
          <p className="mt-1 line-clamp-2 text-xs text-muted">{chapter.goal}</p>
        ) : null}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {GROUPS.map((group) => {
          const actions = CHAPTER_AI_ACTIONS.filter((a) => a.group === group.id);
          return (
            <div key={group.id}>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                {group.label}
              </h3>
              <div className="space-y-1">
                {actions.map((action) => {
                  const isRunning = running === action.id;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => run(action)}
                      disabled={!!running}
                      className={cn(
                        "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                        "hover:bg-surface-2 disabled:opacity-50",
                        isRunning && "bg-accent-soft",
                      )}
                    >
                      <span className="mt-0.5 text-accent">
                        {isRunning ? (
                          <Spinner className="size-4" />
                        ) : (
                          <Icon name={action.icon} className="size-4" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-ink">
                          {action.label}
                        </span>
                        <span className="block text-xs text-muted">{action.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {error && (
          <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        {note && (
          <div className="rounded-lg border border-line bg-paper/60 p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                {note.title}
              </span>
              <button
                type="button"
                onClick={() => setNote(null)}
                className="text-muted hover:text-ink"
                aria-label="Dismiss"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
              {note.text}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
