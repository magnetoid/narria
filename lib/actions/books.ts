"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createBook, deleteBook, updateBook } from "@/lib/db/repositories/books";
import type { BookStatus, BookTypeValue } from "@/lib/constants";

export async function createBookAction(input: {
  title: string;
  book_type: BookTypeValue;
  cover_emoji?: string;
}): Promise<{ error: string } | void> {
  let id: string;
  try {
    const book = await createBook({
      title: input.title.trim() || "Untitled",
      book_type: input.book_type,
      cover_emoji: input.cover_emoji,
    });
    id = book.id;
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/");
  redirect(`/books/${id}/interview`);
}

export async function updateBookAction(
  id: string,
  patch: Partial<{ title: string; subtitle: string; status: BookStatus; cover_emoji: string }>,
): Promise<{ error: string } | { ok: true }> {
  try {
    await updateBook(id, patch);
    revalidatePath(`/books/${id}`, "layout");
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deleteBookAction(id: string): Promise<{ error: string } | void> {
  try {
    await deleteBook(id);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/");
  redirect("/");
}
