import "server-only";
import { ai } from "@/lib/ai";
import { buildMetadata } from "@/lib/ai/prompts";
import { ListSchema, ProseSchema } from "@/lib/ai/schemas";
import { PUBLISH_ASSETS, type PublishAssetKind } from "@/lib/constants";
import type { Book, BookBrain, Chapter } from "@/lib/db/types";

/** Generate one Publish Center asset (prose or list, depending on the kind). */
export async function generateAsset(
  kind: PublishAssetKind,
  book: Book,
  brain: BookBrain | null,
  chapters: Chapter[],
): Promise<{ text?: string; items?: string[] }> {
  const { system, prompt } = buildMetadata(kind, book, brain, chapters);
  const shape = PUBLISH_ASSETS.find((a) => a.kind === kind)?.shape ?? "prose";
  const meta = {
    agent: "metadata" as const,
    kind: `metadata:${kind}`,
    bookId: book.id,
    input: { kind, book, brain },
  };

  if (shape === "list") {
    const { data } = await ai.structured({
      system,
      prompt,
      schema: ListSchema,
      schemaName: "List",
      effort: "medium",
      meta,
    });
    return { items: data.items };
  }

  const { data } = await ai.structured({
    system,
    prompt,
    schema: ProseSchema,
    schemaName: "Prose",
    effort: "medium",
    meta,
  });
  return { text: data.text };
}
