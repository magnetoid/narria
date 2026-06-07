"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getBook, updateBook } from "@/lib/db/repositories/books";
import { upsertBrain } from "@/lib/db/repositories/brain";
import { synthesizeBrain } from "@/lib/ai/agents/bookPlanner";

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
  const interview = Object.fromEntries(entries.map((e) => [e.id, e.answer]));
  try {
    await upsertBrain(bookId, { interview });
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
  const book = await getBook(bookId);
  if (!book) return { error: "Book not found." };

  const qa = entries.map((e) => ({ question: e.question, answer: e.answer }));
  const interview = Object.fromEntries(entries.map((e) => [e.id, e.answer]));

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
