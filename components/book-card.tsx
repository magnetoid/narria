import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { BOOK_STATUS_LABEL, getBookType } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";
import type { Book } from "@/lib/db/types";

export function BookCard({ book }: { book: Book }) {
  const type = getBookType(book.book_type);
  return (
    <Link
      href={`/books/${book.id}`}
      className="group flex flex-col rounded-xl border border-line bg-surface p-5 shadow-paper transition-all hover:-translate-y-0.5 hover:border-line-strong hover:shadow-paper-lg"
    >
      <div className="flex items-start justify-between">
        <span className="text-3xl leading-none">{book.cover_emoji}</span>
        <Badge variant="muted">{BOOK_STATUS_LABEL[book.status]}</Badge>
      </div>
      <h3 className="mt-4 line-clamp-2 font-serif text-lg font-semibold text-ink group-hover:text-accent">
        {book.title}
      </h3>
      {book.subtitle ? (
        <p className="mt-1 line-clamp-1 text-sm text-muted">{book.subtitle}</p>
      ) : null}
      <div className="mt-auto flex items-center gap-2 pt-4 text-xs text-muted">
        <span>{type.label}</span>
        <span aria-hidden>·</span>
        <span>Updated {timeAgo(book.updated_at)}</span>
      </div>
    </Link>
  );
}
