import "server-only";
import { getDb, requireDb } from "@/lib/db/client";
import { DEV_USER_ID } from "@/lib/constants";
import type { Book, NewBookInput } from "@/lib/db/types";

export async function listBooks(userId: string = DEV_USER_ID): Promise<Book[]> {
  const db = getDb();
  if (!db) return [];
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

export async function getBook(id: string): Promise<Book | null> {
  const db = getDb();
  if (!db) return null;
  const { data, error } = await db.from("books").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("getBook", error.message);
    return null;
  }
  return (data as Book) ?? null;
}

export async function createBook(
  input: NewBookInput,
  userId: string = DEV_USER_ID,
): Promise<Book> {
  const db = requireDb();
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
): Promise<Book> {
  const db = requireDb();
  const { data, error } = await db
    .from("books")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Book;
}

export async function deleteBook(id: string): Promise<void> {
  const db = requireDb();
  const { error } = await db.from("books").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
