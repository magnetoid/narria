import { notFound } from "next/navigation";
import { getBook } from "@/lib/db/repositories/books";
import { getChapter, listChapters } from "@/lib/db/repositories/chapters";
import { ChapterWorkspace } from "@/components/editor/chapter-workspace";

export const dynamic = "force-dynamic";

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ bookId: string; chapterId: string }>;
}) {
  const { bookId, chapterId } = await params;
  const [book, chapters, chapter] = await Promise.all([
    getBook(bookId),
    listChapters(bookId),
    getChapter(chapterId),
  ]);
  if (!book || !chapter) notFound();

  return (
    <ChapterWorkspace
      key={chapter.id}
      book={book}
      chapters={chapters}
      chapter={chapter}
    />
  );
}
