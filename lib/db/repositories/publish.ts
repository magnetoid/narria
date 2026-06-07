import "server-only";
import { getDb } from "@/lib/db/client";
import { DEV_USER_ID } from "@/lib/constants";
import type { PublishAssetKind } from "@/lib/constants";
import type { PublishAssetRow } from "@/lib/db/types";
import { memListAssets, memUpsertAsset } from "@/lib/db/memory-store";

export async function listAssets(bookId: string): Promise<PublishAssetRow[]> {
  const db = getDb();
  if (!db) return memListAssets(bookId);
  const { data, error } = await db
    .from("publish_assets")
    .select("*")
    .eq("book_id", bookId);
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
  userId: string = DEV_USER_ID,
): Promise<PublishAssetRow> {
  const db = getDb();
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
