"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChapterEditor, type ChapterEditorHandle } from "./chapter-editor";
import { ChapterList } from "./chapter-list";
import { AiPanel } from "./ai-panel";
import { updateChapterAction } from "@/lib/actions/chapters";
import { wordCount, wordsLabel } from "@/lib/utils";
import type { Book, Chapter } from "@/lib/db/types";

export function ChapterWorkspace({
  book,
  chapters,
  chapter,
}: {
  book: Book;
  chapters: Chapter[];
  chapter: Chapter;
}) {
  const router = useRouter();
  const editorRef = useRef<ChapterEditorHandle | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [title, setTitle] = useState(chapter.title);
  const [words, setWords] = useState(() => wordCount(chapter.content));
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const idx = chapters.findIndex((c) => c.id === chapter.id);
  const prev = chapters[idx - 1];
  const next = chapters[idx + 1];

  // Recompute the word count shortly after edits.
  function handleChange() {
    setWords(wordCount(editorRef.current?.getText() ?? ""));
  }

  function onTitle(value: string) {
    setTitle(value);
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => {
      void updateChapterAction(chapter.id, { title: value || "Untitled chapter" });
    }, 800);
  }

  useEffect(() => () => {
    if (titleTimer.current) clearTimeout(titleTimer.current);
  }, []);

  return (
    <div className="flex flex-col lg:h-dvh">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line/70 px-4">
        <input
          value={title}
          onChange={(e) => onTitle(e.target.value)}
          className="min-w-0 flex-1 truncate bg-transparent font-serif text-lg font-semibold text-ink focus:outline-none"
          placeholder="Chapter title"
        />
        <span className="hidden shrink-0 text-xs text-muted sm:inline">
          {wordsLabel(words)}
        </span>
        <div className="flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={!prev}
            onClick={() => prev && router.push(`/books/${book.id}/chapters/${prev.id}`)}
            aria-label="Previous chapter"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={!next}
            onClick={() => next && router.push(`/books/${book.id}/chapters/${next.id}`)}
            aria-label="Next chapter"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <Button
          variant="subtle"
          size="sm"
          className="lg:hidden"
          onClick={() => setPanelOpen(true)}
        >
          <Sparkles className="size-4" />
          AI
        </Button>
      </header>

      {/* Panes */}
      <div className="flex flex-1 lg:min-h-0">
        <aside className="hidden w-56 shrink-0 overflow-y-auto border-r border-line/70 xl:block">
          <ChapterList bookId={book.id} chapters={chapters} activeId={chapter.id} />
        </aside>

        <div className="min-w-0 flex-1 overflow-y-auto bg-paper">
          <div className="mx-auto max-w-3xl px-6 py-10">
            <ChapterEditor
              ref={editorRef}
              chapterId={chapter.id}
              initialContent={chapter.content}
              onChange={handleChange}
            />
          </div>
        </div>

        <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-line/70 lg:block">
          <AiPanel
            bookId={book.id}
            chapterId={chapter.id}
            chapter={chapter}
            editorRef={editorRef}
          />
        </aside>
      </div>

      {/* Mobile AI drawer */}
      {panelOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/20"
            onClick={() => setPanelOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 w-80 max-w-[85%] border-l border-line bg-surface shadow-paper-lg">
            <div className="flex items-center justify-end p-2">
              <Button variant="ghost" size="icon-sm" onClick={() => setPanelOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
            <AiPanel
              bookId={book.id}
              chapterId={chapter.id}
              chapter={chapter}
              editorRef={editorRef}
            />
          </div>
        </div>
      )}
    </div>
  );
}
