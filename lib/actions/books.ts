"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createBook, deleteBook, updateBook } from "@/lib/db/repositories/books";
import type { BookStatus, BookTypeValue } from "@/lib/constants";
import { createBookInput, idSchema, updateBookPatch } from "@/lib/validation";

export async function createBookAction(input: {
  title: string;
  book_type: BookTypeValue;
  cover_emoji?: string;
}): Promise<{ error: string } | void> {
  const parsed = createBookInput.safeParse(input);
  if (!parsed.success) return { error: "Invalid book details." };

  let id: string;
  try {
    const book = await createBook({
      title: parsed.data.title?.trim() || "Untitled",
      book_type: parsed.data.book_type as BookTypeValue,
      cover_emoji: parsed.data.cover_emoji,
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
  const parsedId = idSchema.safeParse(id);
  const parsedPatch = updateBookPatch.safeParse(patch);
  if (!parsedId.success || !parsedPatch.success) return { error: "Invalid update." };
  try {
    await updateBook(parsedId.data, parsedPatch.data);
    revalidatePath(`/books/${id}`, "layout");
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deleteBookAction(id: string): Promise<{ error: string } | void> {
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { error: "Invalid book id." };
  try {
    await deleteBook(parsedId.data);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/");
  redirect("/");
}
