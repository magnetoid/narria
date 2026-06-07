import Link from "next/link";
import { notFound } from "next/navigation";
import { BrainCircuit } from "lucide-react";
import { getBook } from "@/lib/db/repositories/books";
import { getBrain } from "@/lib/db/repositories/brain";
import { BrainEditor } from "@/components/brain/brain-editor";
import { BookPage, SectionHeader } from "@/components/layout/book-page";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function BrainPage({
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
        <SectionHeader title="Book Brain" />
        <EmptyState
          icon={<BrainCircuit className="size-6" />}
          title="Your Book Brain is empty"
          description="Answer a few interview questions and Narria will build your Book Brain — the foundation every chapter is written from."
          action={
            <Link href={`/books/${book.id}/interview`} className={buttonVariants()}>
              Start the interview
            </Link>
          }
        />
      </BookPage>
    );
  }

  // Remount when the brain changes (e.g. after re-synthesis) so the editor re-seeds.
  return <BrainEditor key={brain.updated_at} book={book} brain={brain} />;
}
