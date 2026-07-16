import { beforeEach, describe, expect, it } from "vitest";
import { createBook, deleteBook, getBook, listBooks, updateBook } from "@/lib/db/repositories/books";
import { getBrain, upsertBrain } from "@/lib/db/repositories/brain";
import {
  createChapter,
  getChapter,
  listChapters,
  reorderChapters,
} from "@/lib/db/repositories/chapters";
import { listAssets, upsertAsset } from "@/lib/db/repositories/publish";

const USER = "user_1";
const OTHER = "user_2";

// No Supabase env is set anywhere in this suite (see vitest.config.ts / CI), so
// getDb() returns null and every repository call must fall back to the memory store.
beforeEach(() => {
  const g = globalThis as unknown as { __narriaMem?: unknown };
  delete g.__narriaMem;
});

describe("books repository (memory fallback)", () => {
  it("createBook then listBooks returns it", async () => {
    const book = await createBook({ title: "Repo Book", book_type: "novel" }, USER);
    const listed = await listBooks(USER);
    expect(listed.map((b) => b.id)).toContain(book.id);
  });

  it("getBook on an unknown id returns null", async () => {
    expect(await getBook("nonexistent", USER)).toBeNull();
  });

  it("updateBook persists the patch", async () => {
    const book = await createBook({ title: "Original", book_type: "novel" }, USER);
    const updated = await updateBook(book.id, { title: "Updated" });
    expect(updated.title).toBe("Updated");
    expect((await getBook(book.id, USER))?.title).toBe("Updated");
  });

  it("deleteBook removes it from listBooks", async () => {
    const book = await createBook({ title: "Gone", book_type: "novel" }, USER);
    await deleteBook(book.id);
    expect(await getBook(book.id, USER)).toBeNull();
  });
});

describe("brain repository (memory fallback)", () => {
  it("getBrain on a book with no brain returns null", async () => {
    expect(await getBrain("nonexistent", USER)).toBeNull();
  });

  it("upsertBrain then getBrain returns the saved patch", async () => {
    const book = await createBook({ title: "Brainy", book_type: "novel" }, USER);
    await upsertBrain(book.id, { tone: "warm and direct" }, USER);
    const brain = await getBrain(book.id, USER);
    expect(brain?.tone).toBe("warm and direct");
  });
});

describe("chapters repository (memory fallback)", () => {
  it("createChapter then listChapters returns it in order", async () => {
    const book = await createBook({ title: "Chaptered", book_type: "novel" }, USER);
    const c1 = await createChapter(book.id, { title: "First" }, USER);
    const c2 = await createChapter(book.id, { title: "Second" }, USER);
    const listed = await listChapters(book.id, USER);
    expect(listed.map((c) => c.id)).toEqual([c1.id, c2.id]);
  });

  it("getChapter on an unknown id returns null", async () => {
    expect(await getChapter("nonexistent", USER)).toBeNull();
  });

  it("reorderChapters updates order_index to match", async () => {
    const book = await createBook({ title: "Reorder", book_type: "novel" }, USER);
    const c1 = await createChapter(book.id, { title: "First" }, USER);
    const c2 = await createChapter(book.id, { title: "Second" }, USER);
    await reorderChapters([c2.id, c1.id]);
    const listed = await listChapters(book.id, USER);
    expect(listed.map((c) => c.id)).toEqual([c2.id, c1.id]);
  });
});

describe("publish repository (memory fallback)", () => {
  it("upsertAsset then listAssets returns it", async () => {
    const book = await createBook({ title: "Published", book_type: "novel" }, USER);
    await upsertAsset(book.id, "description", { text: "blurb" }, USER);
    const assets = await listAssets(book.id, USER);
    expect(assets).toHaveLength(1);
    expect(assets[0].content).toEqual({ text: "blurb" });
  });
});

// Knowing a row id must never be enough to read it — every read is scoped to the
// owner. These guard the IDOR that the ownership filters closed.
describe("repository ownership (another user's ids are invisible)", () => {
  it("getBook does not return a book owned by someone else", async () => {
    const book = await createBook({ title: "Private", book_type: "novel" }, USER);
    expect(await getBook(book.id, OTHER)).toBeNull();
    expect(await getBook(book.id, USER)).not.toBeNull();
  });

  it("listBooks only returns the caller's books", async () => {
    const mine = await createBook({ title: "Mine", book_type: "novel" }, USER);
    const theirs = await createBook({ title: "Theirs", book_type: "novel" }, OTHER);
    const mineIds = (await listBooks(USER)).map((b) => b.id);
    expect(mineIds).toContain(mine.id);
    expect(mineIds).not.toContain(theirs.id);
  });

  it("getChapter does not return a chapter owned by someone else", async () => {
    const book = await createBook({ title: "Private", book_type: "novel" }, USER);
    const chapter = await createChapter(book.id, { title: "Secret" }, USER);
    expect(await getChapter(chapter.id, OTHER)).toBeNull();
    expect(await getChapter(chapter.id, USER)).not.toBeNull();
  });

  it("listChapters does not return chapters of someone else's book", async () => {
    const book = await createBook({ title: "Private", book_type: "novel" }, USER);
    await createChapter(book.id, { title: "Secret" }, USER);
    expect(await listChapters(book.id, OTHER)).toEqual([]);
    expect(await listChapters(book.id, USER)).toHaveLength(1);
  });

  it("getBrain does not return the brain of someone else's book", async () => {
    const book = await createBook({ title: "Private", book_type: "novel" }, USER);
    await upsertBrain(book.id, { tone: "confidential" }, USER);
    expect(await getBrain(book.id, OTHER)).toBeNull();
    expect(await getBrain(book.id, USER)).not.toBeNull();
  });

  it("listAssets does not return assets of someone else's book", async () => {
    const book = await createBook({ title: "Private", book_type: "novel" }, USER);
    await upsertAsset(book.id, "description", { text: "unreleased" }, USER);
    expect(await listAssets(book.id, OTHER)).toEqual([]);
    expect(await listAssets(book.id, USER)).toHaveLength(1);
  });
});
