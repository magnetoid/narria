import "server-only";
import { getDb, requireDb } from "@/lib/db/client";
import { DEV_USER_ID } from "@/lib/constants";
import type { BookBrain } from "@/lib/db/types";

export type BrainPatch = Partial<
  Omit<BookBrain, "id" | "book_id" | "user_id" | "created_at" | "updated_at">
>;

export async function getBrain(bookId: string): Promise<BookBrain | null> {
  const db = getDb();
  if (!db) return null;
  const { data, error } = await db
    .from("book_brain")
    .select("*")
    .eq("book_id", bookId)
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
  userId: string = DEV_USER_ID,
): Promise<BookBrain> {
  const db = requireDb();
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
