import "server-only";
import type {
  Book,
  BookBrain,
  Chapter,
  ChapterPlan,
  NewBookInput,
  PublishAssetRow,
} from "./types";
import type { BrainPatch } from "./repositories/brain";
import type { PublishAssetKind } from "@/lib/constants";

/**
 * Process-local, ephemeral store used ONLY when Supabase isn't configured —
 * so the whole app runs with zero setup for local dev and demos. Resets on
 * server restart. Production (Supabase configured) never reaches this code.
 */

// Back the maps on globalThis so all route bundles in the same Node process share
// ONE store. (Next.js production builds can give each route its own module instance,
// which would otherwise split state between pages, server actions, and API routes.)
interface MemState {
  seq: number;
  books: Map<string, Book>;
  brains: Map<string, BookBrain>; // keyed by book_id
  chapters: Map<string, Chapter>;
  assets: Map<string, PublishAssetRow>; // keyed by `${book_id}:${kind}`
}
const g = globalThis as unknown as { __narriaMem?: MemState };
const state: MemState =
  g.__narriaMem ??
  (g.__narriaMem = {
    seq: 1,
    books: new Map(),
    brains: new Map(),
    chapters: new Map(),
    assets: new Map(),
  });
const { books, brains, chapters, assets } = state;

const uid = () => `mem_${(state.seq++).toString(36)}${Date.now().toString(36)}`;
const now = () => new Date().toISOString();

// ── books ──
export function memListBooks(userId: string): Book[] {
  return [...books.values()]
    .filter((b) => b.user_id === userId)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}
export function memGetBook(id: string, userId: string): Book | null {
  const book = books.get(id);
  return book?.user_id === userId ? book : null;
}
export function memCreateBook(input: NewBookInput, userId: string): Book {
  const t = now();
  const book: Book = {
    id: uid(),
    user_id: userId,
    title: input.title || "Untitled",
    subtitle: null,
    book_type: input.book_type,
    status: "draft",
    cover_emoji: input.cover_emoji ?? "📖",
    created_at: t,
    updated_at: t,
  };
  books.set(book.id, book);
  return book;
}
export function memUpdateBook(id: string, patch: Partial<Book>, userId: string): Book {
  const b = books.get(id);
  // Someone else's book is indistinguishable from a missing one, mirroring the
  // owner-scoped SQL update that matches no rows.
  if (!b || b.user_id !== userId) throw new Error("Book not found.");
  const u = { ...b, ...patch, updated_at: now() };
  books.set(id, u);
  return u;
}
export function memDeleteBook(id: string, userId: string): void {
  // A non-owner's delete matches no rows in SQL, so it is a no-op here too.
  if (books.get(id)?.user_id !== userId) return;
  books.delete(id);
  brains.delete(id);
  for (const c of [...chapters.values()]) if (c.book_id === id) chapters.delete(c.id);
  for (const k of [...assets.keys()]) if (k.startsWith(`${id}:`)) assets.delete(k);
}

// ── brain ──
export function memGetBrain(bookId: string, userId: string): BookBrain | null {
  const brain = brains.get(bookId);
  return brain?.user_id === userId ? brain : null;
}
export function memUpsertBrain(
  bookId: string,
  patch: BrainPatch,
  userId: string,
): BookBrain {
  const t = now();
  const existing = brains.get(bookId);
  // Brains are keyed by book_id alone, so without this another owner's row would
  // become the base and take the patch. Mirrors assertOwnsBook() on the db path.
  if (existing && existing.user_id !== userId) throw new Error("Book not found.");
  const base: BookBrain =
    existing ??
    {
      id: uid(),
      book_id: bookId,
      user_id: userId,
      audience: null,
      tone: null,
      writing_style: null,
      author_background: null,
      author_goals: null,
      reader_takeaway: null,
      key_ideas: [],
      style_rules: [],
      characters: [],
      research_notes: [],
      interview: {},
      created_at: t,
      updated_at: t,
    };
  const u = { ...base, ...patch, updated_at: t };
  brains.set(bookId, u);
  return u;
}

// ── chapters ──
export function memListChapters(bookId: string, userId: string): Chapter[] {
  return [...chapters.values()]
    .filter((c) => c.book_id === bookId && c.user_id === userId)
    .sort((a, b) => a.order_index - b.order_index);
}
export function memGetChapter(id: string, userId: string): Chapter | null {
  const chapter = chapters.get(id);
  return chapter?.user_id === userId ? chapter : null;
}
export function memCreateChapter(
  bookId: string,
  input: Partial<Chapter>,
  userId: string,
): Chapter {
  const t = now();
  const c: Chapter = {
    id: uid(),
    book_id: bookId,
    user_id: userId,
    order_index: input.order_index ?? memListChapters(bookId, userId).length,
    title: input.title ?? "Untitled chapter",
    goal: input.goal ?? null,
    summary: input.summary ?? null,
    key_points: input.key_points ?? [],
    estimated_word_count: input.estimated_word_count ?? 0,
    content: input.content ?? "",
    status: input.status ?? "planned",
    created_at: t,
    updated_at: t,
  };
  chapters.set(c.id, c);
  return c;
}
export function memReplaceChapters(
  bookId: string,
  plans: ChapterPlan[],
  userId: string,
): Chapter[] {
  for (const c of [...chapters.values()]) {
    if (c.book_id === bookId && c.user_id === userId) chapters.delete(c.id);
  }
  return plans.map((p, i) =>
    memCreateChapter(bookId, { ...p, order_index: i, status: "planned" }, userId),
  );
}
export function memUpdateChapter(id: string, patch: Partial<Chapter>, userId: string): Chapter {
  const c = chapters.get(id);
  if (!c || c.user_id !== userId) throw new Error("Chapter not found.");
  const u = { ...c, ...patch, updated_at: now() };
  chapters.set(id, u);
  return u;
}
export function memDeleteChapter(id: string, userId: string): void {
  if (chapters.get(id)?.user_id !== userId) return;
  chapters.delete(id);
}
export function memReorderChapters(orderedIds: string[], userId: string): void {
  orderedIds.forEach((id, i) => {
    const c = chapters.get(id);
    if (c?.user_id === userId) chapters.set(id, { ...c, order_index: i });
  });
}

// ── publish ──
export function memListAssets(bookId: string, userId: string): PublishAssetRow[] {
  return [...assets.values()].filter(
    (a) => a.book_id === bookId && a.user_id === userId,
  );
}
export function memUpsertAsset(
  bookId: string,
  kind: PublishAssetKind,
  content: { text?: string; items?: string[] },
  userId: string,
): PublishAssetRow {
  const key = `${bookId}:${kind}`;
  const t = now();
  const ex = assets.get(key);
  // Keyed by book+kind, not by owner — see memUpsertBrain.
  if (ex && ex.user_id !== userId) throw new Error("Book not found.");
  const row: PublishAssetRow = ex
    ? { ...ex, content, updated_at: t }
    : { id: uid(), book_id: bookId, user_id: userId, kind, content, created_at: t, updated_at: t };
  assets.set(key, row);
  return row;
}
