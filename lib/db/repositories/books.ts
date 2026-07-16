import "server-only";
import { getDb } from "@/lib/db/client";
import { getSessionUser, requireUserId } from "@/lib/auth/session";
import type { Book, NewBookInput } from "@/lib/db/types";
import {
  memCreateBook,
  memDeleteBook,
  memGetBook,
  memListBooks,
  memUpdateBook,
} from "@/lib/db/memory-store";

export async function listBooks(userId?: string): Promise<Book[]> {
  userId ??= (await getSessionUser())?.id;
  if (!userId) return [];
  const db = getDb();
  if (!db) return memListBooks(userId);
  const { data, error } = await db
    .from("books")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("listBooks", error.message);
    return [];
  }
  return (data ?? []) as Book[];
}

export async function getBook(id: string, userId?: string): Promise<Book | null> {
  userId ??= (await getSessionUser())?.id;
  if (!userId) return null;
  const db = getDb();
  if (!db) return memGetBook(id, userId);
  const { data, error } = await db
    .from("books")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("getBook", error.message);
    return null;
  }
  return (data as Book) ?? null;
}

export async function createBook(
  input: NewBookInput,
  userId?: string,
): Promise<Book> {
  userId ??= await requireUserId();
  const db = getDb();
  if (!db) return memCreateBook(input, userId);
  const { data, error } = await db
    .from("books")
    .insert({
      user_id: userId,
      title: input.title || "Untitled",
      book_type: input.book_type,
      cover_emoji: input.cover_emoji ?? "📖",
      status: "draft",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Book;
}

export async function updateBook(
  id: string,
  patch: Partial<Pick<Book, "title" | "subtitle" | "book_type" | "status" | "cover_emoji">>,
  userId?: string,
): Promise<Book> {
  userId ??= await requireUserId();
  const db = getDb();
  if (!db) return memUpdateBook(id, patch, userId);
  const { data, error } = await db
    .from("books")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Book;
}

export async function deleteBook(id: string, userId?: string): Promise<void> {
  userId ??= await requireUserId();
  const db = getDb();
  if (!db) return memDeleteBook(id, userId);
  const { error } = await db.from("books").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/** Guard for any write keyed on a bookId that came from the request. Knowing an id
 *  is not proof of owning it, and getDb() is the service-role client, so without
 *  this the write would land on whoever's book the id happens to name. */
export async function assertOwnsBook(bookId: string, userId: string): Promise<void> {
  if (!(await getBook(bookId, userId))) throw new Error("Book not found.");
}
