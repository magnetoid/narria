"use server";

import { getBook } from "@/lib/db/repositories/books";
import { getBrain } from "@/lib/db/repositories/brain";
import { listChapters } from "@/lib/db/repositories/chapters";
import { upsertAsset } from "@/lib/db/repositories/publish";
import { generateAsset } from "@/lib/ai/agents/metadata";
import type { PublishAssetKind } from "@/lib/constants";

type AssetContent = { text?: string; items?: string[] };

export async function generateAssetAction(
  bookId: string,
  kind: PublishAssetKind,
): Promise<{ content: AssetContent } | { error: string }> {
  const book = await getBook(bookId);
  if (!book) return { error: "Book not found." };
  const brain = await getBrain(bookId);
  const chapters = await listChapters(bookId);
  try {
    const content = await generateAsset(kind, book, brain, chapters);
    const row = await upsertAsset(bookId, kind, content);
    return { content: row.content };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function saveAssetAction(
  bookId: string,
  kind: PublishAssetKind,
  content: AssetContent,
): Promise<{ ok: true } | { error: string }> {
  try {
    await upsertAsset(bookId, kind, content);
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
