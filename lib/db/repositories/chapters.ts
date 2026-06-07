import "server-only";
import { getDb, requireDb } from "@/lib/db/client";
import { DEV_USER_ID } from "@/lib/constants";
import type { Chapter, ChapterPlan } from "@/lib/db/types";

export async function listChapters(bookId: string): Promise<Chapter[]> {
  const db = getDb();
  if (!db) return [];
  const { data, error } = await db
    .from("chapters")
    .select("*")
    .eq("book_id", bookId)
    .order("order_index", { ascending: true });
  if (error) {
    console.error("listChapters", error.message);
    return [];
  }
  return (data ?? []) as Chapter[];
}

export async function getChapter(id: string): Promise<Chapter | null> {
  const db = getDb();
  if (!db) return null;
  const { data, error } = await db.from("chapters").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("getChapter", error.message);
    return null;
  }
  return (data as Chapter) ?? null;
}

export async function createChapter(
  bookId: string,
  input: Partial<Chapter> = {},
  userId: string = DEV_USER_ID,
): Promise<Chapter> {
  const db = requireDb();
  // Default new chapters to the end of the order.
  const existing = await listChapters(bookId);
  const nextIndex = existing.length;
  const { data, error } = await db
    .from("chapters")
    .insert({
      book_id: bookId,
      user_id: userId,
      order_index: input.order_index ?? nextIndex,
      title: input.title ?? "Untitled chapter",
      goal: input.goal ?? null,
      summary: input.summary ?? null,
      key_points: input.key_points ?? [],
      estimated_word_count: input.estimated_word_count ?? 0,
      content: input.content ?? "",
      status: input.status ?? "planned",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Chapter;
}

/** Replace all chapters for a book with a fresh plan (used by outline generation). */
export async function replaceChapters(
  bookId: string,
  plans: ChapterPlan[],
  userId: string = DEV_USER_ID,
): Promise<Chapter[]> {
  const db = requireDb();
  await db.from("chapters").delete().eq("book_id", bookId);
  if (plans.length === 0) return [];
  const rows = plans.map((p, i) => ({
    book_id: bookId,
    user_id: userId,
    order_index: i,
    title: p.title,
    goal: p.goal,
    summary: p.summary,
    key_points: p.key_points,
    estimated_word_count: p.estimated_word_count,
    status: "planned" as const,
  }));
  const { data, error } = await db.from("chapters").insert(rows).select("*");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Chapter[]).sort((a, b) => a.order_index - b.order_index);
}

export async function updateChapter(
  id: string,
  patch: Partial<
    Pick<Chapter, "title" | "goal" | "summary" | "key_points" | "estimated_word_count" | "content" | "status" | "order_index">
  >,
): Promise<Chapter> {
  const db = requireDb();
  const { data, error } = await db
    .from("chapters")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Chapter;
}

export async function deleteChapter(id: string): Promise<void> {
  const db = requireDb();
  const { error } = await db.from("chapters").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Persist a new ordering. `orderedIds` is the desired top-to-bottom order. */
export async function reorderChapters(orderedIds: string[]): Promise<void> {
  const db = requireDb();
  await Promise.all(
    orderedIds.map((id, index) =>
      db.from("chapters").update({ order_index: index }).eq("id", id),
    ),
  );
}
