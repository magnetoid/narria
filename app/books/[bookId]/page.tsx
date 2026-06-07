import { redirect } from "next/navigation";
import { getBrain } from "@/lib/db/repositories/brain";

export const dynamic = "force-dynamic";

// Land on the right step: the Book Brain once the interview is done, else the interview.
export default async function BookIndex({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const brain = await getBrain(bookId);
  redirect(`/books/${bookId}/${brain ? "brain" : "interview"}`);
}
