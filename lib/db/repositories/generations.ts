import "server-only";
import { getDb } from "@/lib/db/client";
import { DEV_USER_ID, type AgentName } from "@/lib/constants";

export interface GenerationLog {
  book_id?: string | null;
  chapter_id?: string | null;
  agent: AgentName;
  action?: string | null;
  model?: string | null;
  input?: unknown;
  output?: string | null;
  tokens?: number;
}

/** Best-effort audit log of an AI generation. Never throws — logging must not
 *  break a user-facing action, and it silently no-ops when DB is unconfigured. */
export async function logGeneration(
  entry: GenerationLog,
  userId: string = DEV_USER_ID,
): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.from("ai_generations").insert({
      user_id: userId,
      book_id: entry.book_id ?? null,
      chapter_id: entry.chapter_id ?? null,
      agent: entry.agent,
      action: entry.action ?? null,
      model: entry.model ?? null,
      input: entry.input ?? null,
      output: entry.output ?? null,
      tokens: entry.tokens ?? 0,
    });
  } catch (err) {
    console.error("logGeneration", (err as Error).message);
  }
}
