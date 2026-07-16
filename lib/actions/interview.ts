"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getBook, updateBook } from "@/lib/db/repositories/books";
import { upsertBrain } from "@/lib/db/repositories/brain";
import { synthesizeBrain } from "@/lib/ai/agents/bookPlanner";
import { idSchema, interviewEntries as interviewEntriesSchema } from "@/lib/validation";

export interface InterviewEntry {
  id: string;
  question: string;
  answer: string;
}

/** Lightweight autosave of raw answers (best-effort). */
export async function saveInterview(
  bookId: string,
  entries: InterviewEntry[],
): Promise<void> {
  const parsedId = idSchema.safeParse(bookId);
  const parsedEntries = interviewEntriesSchema.safeParse(entries);
  if (!parsedId.success || !parsedEntries.success) return; // best-effort; silently skip

  const interview = Object.fromEntries(parsedEntries.data.map((e) => [e.id, e.answer]));
  try {
    await upsertBrain(parsedId.data, { interview });
  } catch {
    // best-effort; the final synthesis re-saves everything
  }
}

/** Synthesize the Book Brain from the interview, persist it, advance status,
 *  and route to the Book Brain. Returns { error } on failure (no redirect). */
export async function finishInterview(
  bookId: string,
  entries: InterviewEntry[],
): Promise<{ error: string } | void> {
  const parsedId = idSchema.safeParse(bookId);
  const parsedEntries = interviewEntriesSchema.safeParse(entries);
  if (!parsedId.success || !parsedEntries.success) return { error: "Invalid interview answers." };

  const book = await getBook(parsedId.data);
  if (!book) return { error: "Book not found." };

  const qa = parsedEntries.data.map((e) => ({ question: e.question, answer: e.answer }));
  const interview = Object.fromEntries(parsedEntries.data.map((e) => [e.id, e.answer]));

  try {
    const synth = await synthesizeBrain(book, qa);
    await upsertBrain(bookId, {
      audience: synth.audience,
      tone: synth.tone,
      writing_style: synth.writing_style,
      author_background: synth.author_background,
      author_goals: synth.author_goals,
      reader_takeaway: synth.reader_takeaway,
      key_ideas: synth.key_ideas,
      style_rules: synth.style_rules,
      characters: synth.characters,
      interview,
    });
    await updateBook(bookId, { status: "outlining" });
  } catch (e) {
    return { error: (e as Error).message };
  }

  revalidatePath(`/books/${bookId}`, "layout");
  redirect(`/books/${bookId}/brain`);
}
