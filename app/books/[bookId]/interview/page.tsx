import { notFound } from "next/navigation";
import { getBook } from "@/lib/db/repositories/books";
import { getBrain } from "@/lib/db/repositories/brain";
import { interviewQuestions } from "@/lib/interview";
import { InterviewWizard } from "@/components/interview/interview-wizard";

export const dynamic = "force-dynamic";

export default async function InterviewPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const book = await getBook(bookId);
  if (!book) notFound();

  const brain = await getBrain(bookId);
  const questions = interviewQuestions(book.book_type);

  return (
    <InterviewWizard
      bookId={book.id}
      bookTitle={book.title}
      questions={questions}
      initialAnswers={(brain?.interview ?? {}) as Record<string, string>}
    />
  );
}
