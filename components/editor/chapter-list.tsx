"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Chapter } from "@/lib/db/types";

const STATUS_DOT: Record<string, string> = {
  planned: "bg-line-strong",
  drafting: "bg-gold",
  written: "bg-sage",
};

export function ChapterList({
  bookId,
  chapters,
  activeId,
}: {
  bookId: string;
  chapters: Chapter[];
  activeId: string;
}) {
  return (
    <nav className="space-y-0.5 p-3">
      <div className="px-2.5 pb-2 text-xs font-medium uppercase tracking-wide text-muted">
        Chapters
      </div>
      {chapters.map((c, i) => (
        <Link
          key={c.id}
          href={`/books/${bookId}/chapters/${c.id}`}
          className={cn(
            "flex items-start gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
            c.id === activeId
              ? "bg-accent-soft text-accent"
              : "text-ink-soft hover:bg-surface-2 hover:text-ink",
          )}
        >
          <span className="mt-0.5 w-4 shrink-0 text-center text-xs text-muted">
            {i + 1}
          </span>
          <span className="line-clamp-2 min-w-0 flex-1 font-medium">{c.title}</span>
          <span
            className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", STATUS_DOT[c.status])}
            aria-hidden
          />
        </Link>
      ))}
    </nav>
  );
}
