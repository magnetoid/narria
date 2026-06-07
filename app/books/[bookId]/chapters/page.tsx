import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ListTree } from "lucide-react";
import { getBook } from "@/lib/db/repositories/books";
import { listChapters } from "@/lib/db/repositories/chapters";
import { BookPage, SectionHeader } from "@/components/layout/book-page";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ChaptersIndex({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const book = await getBook(bookId);
  if (!book) notFound();

  const chapters = await listChapters(bookId);
  if (chapters.length === 0) {
    return (
      <BookPage>
        <SectionHeader title="Chapters" />
        <EmptyState
          icon={<ListTree className="size-6" />}
          title="No chapters yet"
          description="Generate your outline first — each chapter becomes a focused workspace with AI assistance."
          action={
            <Link href={`/books/${book.id}/outline`} className={buttonVariants()}>
              Go to outline
            </Link>
          }
        />
      </BookPage>
    );
  }

  redirect(`/books/${bookId}/chapters/${chapters[0].id}`);
}
