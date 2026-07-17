import "server-only";
import { getAdminDb } from "@/lib/db/client";
import { getSessionUser } from "@/lib/auth/session";
import { type AgentName } from "@/lib/constants";

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
 *  break a user-facing action, and it silently no-ops when DB is unconfigured.
 *
 *  Deliberately the admin client, not getDb(): the row must land even when the user's
 *  token expired mid-stream, and 0003_rls.sql grants users SELECT only on
 *  ai_generations — a user-scoped insert would be denied by policy. An audit trail the
 *  audited party can write is not one, and later tasks add columns (usage, cost) a
 *  user must not be able to forge. Without a service-role key there is no client that
 *  may insert here, so the log no-ops rather than failing the action. */
export async function logGeneration(
  entry: GenerationLog,
  userId?: string,
): Promise<void> {
  const db = getAdminDb();
  if (!db) return;
  try {
    // Signed out (real mode only): drop the log rather than attribute it to no one.
    userId ??= (await getSessionUser())?.id;
    if (!userId) return;
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
