import Link from "next/link";
import { notFound } from "next/navigation";
import { BrainCircuit } from "lucide-react";
import { getBook } from "@/lib/db/repositories/books";
import { getBrain } from "@/lib/db/repositories/brain";
import { listChapters } from "@/lib/db/repositories/chapters";
import { OutlineEditor } from "@/components/outline/outline-editor";
import { BookPage, SectionHeader } from "@/components/layout/book-page";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function OutlinePage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const book = await getBook(bookId);
  if (!book) notFound();

  const brain = await getBrain(bookId);
  if (!brain) {
    return (
      <BookPage>
        <SectionHeader title="Outline" />
        <EmptyState
          icon={<BrainCircuit className="size-6" />}
          title="Build your Book Brain first"
          description="The outline is generated from your Book Brain — let's set that up first."
          action={
            <Link href={`/books/${book.id}/interview`} className={buttonVariants()}>
              Start the interview
            </Link>
          }
        />
      </BookPage>
    );
  }

  const chapters = await listChapters(bookId);

  // Remount when the set of chapters changes (e.g. after regeneration).
  return (
    <OutlineEditor
      key={chapters.map((c) => c.id).join(",") || "empty"}
      bookId={book.id}
      initialChapters={chapters}
    />
  );
}
