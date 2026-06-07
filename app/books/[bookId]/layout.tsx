import { notFound } from "next/navigation";
import { getBook } from "@/lib/db/repositories/books";
import { BookSidebar } from "@/components/layout/book-sidebar";

export const dynamic = "force-dynamic";

export default async function BookLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const book = await getBook(bookId);
  if (!book) notFound();

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <BookSidebar book={book} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
