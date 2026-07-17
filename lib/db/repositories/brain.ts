import "server-only";
import { getDb } from "@/lib/db/client";
import { getSessionUser, requireUserId } from "@/lib/auth/session";
import { assertOwnsBook } from "@/lib/db/repositories/books";
import type { BookBrain } from "@/lib/db/types";
import { memGetBrain, memUpsertBrain } from "@/lib/db/memory-store";

export type BrainPatch = Partial<
  Omit<BookBrain, "id" | "book_id" | "user_id" | "created_at" | "updated_at">
>;

export async function getBrain(bookId: string, userId?: string): Promise<BookBrain | null> {
  userId ??= (await getSessionUser())?.id;
  if (!userId) return null;
  const db = await getDb();
  if (!db) return memGetBrain(bookId, userId);
  const { data, error } = await db
    .from("book_brain")
    .select("*")
    .eq("book_id", bookId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("getBrain", error.message);
    return null;
  }
  return (data as BookBrain) ?? null;
}

/** Create-or-update the single Book Brain row for a book. */
export async function upsertBrain(
  bookId: string,
  patch: BrainPatch,
  userId?: string,
): Promise<BookBrain> {
  userId ??= await requireUserId();
  // The conflict target is book_id alone, so an unowned bookId would not insert a
  // new row — it would overwrite the owner's brain and reassign user_id to the
  // caller, who could then read it through getBrain's owner filter.
  await assertOwnsBook(bookId, userId);
  const db = await getDb();
  if (!db) return memUpsertBrain(bookId, patch, userId);
  const { data, error } = await db
    .from("book_brain")
    .upsert(
      { book_id: bookId, user_id: userId, ...patch },
      { onConflict: "book_id" },
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as BookBrain;
}
