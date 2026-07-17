import "server-only";
import { getDb } from "@/lib/db/client";
import { getSessionUser, requireUserId } from "@/lib/auth/session";
import { assertOwnsBook } from "@/lib/db/repositories/books";
import type { PublishAssetKind } from "@/lib/constants";
import type { PublishAssetRow } from "@/lib/db/types";
import { memListAssets, memUpsertAsset } from "@/lib/db/memory-store";

export async function listAssets(bookId: string, userId?: string): Promise<PublishAssetRow[]> {
  userId ??= (await getSessionUser())?.id;
  if (!userId) return [];
  const db = await getDb();
  if (!db) return memListAssets(bookId, userId);
  const { data, error } = await db
    .from("publish_assets")
    .select("*")
    .eq("book_id", bookId)
    .eq("user_id", userId);
  if (error) {
    console.error("listAssets", error.message);
    return [];
  }
  return (data ?? []) as PublishAssetRow[];
}

export async function upsertAsset(
  bookId: string,
  kind: PublishAssetKind,
  content: { text?: string; items?: string[] },
  userId?: string,
): Promise<PublishAssetRow> {
  userId ??= await requireUserId();
  // Conflict target is (book_id, kind), not the owner — see upsertBrain.
  await assertOwnsBook(bookId, userId);
  const db = await getDb();
  if (!db) return memUpsertAsset(bookId, kind, content, userId);
  const { data, error } = await db
    .from("publish_assets")
    .upsert(
      { book_id: bookId, user_id: userId, kind, content },
      { onConflict: "book_id,kind" },
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as PublishAssetRow;
}
