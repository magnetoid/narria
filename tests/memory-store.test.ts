import { beforeEach, describe, expect, it } from "vitest";
import {
  memCreateBook,
  memCreateChapter,
  memDeleteBook,
  memGetBook,
  memGetBrain,
  memListAssets,
  memListChapters,
  memReorderChapters,
  memUpdateBook,
  memUpsertAsset,
  memUpsertBrain,
} from "@/lib/db/memory-store";

const USER = "user_1";

// The store backs its maps on globalThis (see memory-store.ts) so every route
// in the process shares one instance — clear it between tests for isolation.
beforeEach(() => {
  const g = globalThis as unknown as { __narriaMem?: unknown };
  delete g.__narriaMem;
});

describe("memory-store books", () => {
  it("creates, gets, updates, and deletes a book", () => {
    const book = memCreateBook({ title: "My Book", book_type: "novel" }, USER);
    expect(memGetBook(book.id, USER)).toEqual(book);

    const updated = memUpdateBook(book.id, { title: "Renamed" });
    expect(updated.title).toBe("Renamed");
    expect(memGetBook(book.id, USER)?.title).toBe("Renamed");

    memDeleteBook(book.id);
    expect(memGetBook(book.id, USER)).toBeNull();
  });

  it("defaults title to Untitled when blank", () => {
    const book = memCreateBook({ title: "", book_type: "other" }, USER);
    expect(book.title).toBe("Untitled");
  });

  it("throws when updating a book that doesn't exist", () => {
    expect(() => memUpdateBook("does-not-exist", { title: "x" })).toThrow();
  });
});

describe("memory-store cascade delete", () => {
  it("removes brain, chapters, and assets for a deleted book", () => {
    const book = memCreateBook({ title: "Cascade", book_type: "novel" }, USER);
    memUpsertBrain(book.id, { tone: "warm" }, USER);
    memCreateChapter(book.id, { title: "Ch 1" }, USER);
    memCreateChapter(book.id, { title: "Ch 2" }, USER);
    memUpsertAsset(book.id, "description", { text: "blurb" }, USER);

    // sanity: everything is present before delete
    expect(memGetBrain(book.id, USER)).not.toBeNull();
    expect(memListChapters(book.id, USER)).toHaveLength(2);
    expect(memListAssets(book.id, USER)).toHaveLength(1);

    memDeleteBook(book.id);

    expect(memGetBrain(book.id, USER)).toBeNull();
    expect(memListChapters(book.id, USER)).toHaveLength(0);
    expect(memListAssets(book.id, USER)).toHaveLength(0);
  });

  it("leaves other books' chapters and assets untouched", () => {
    const a = memCreateBook({ title: "A", book_type: "novel" }, USER);
    const b = memCreateBook({ title: "B", book_type: "novel" }, USER);
    memCreateChapter(a.id, { title: "A1" }, USER);
    memCreateChapter(b.id, { title: "B1" }, USER);
    memUpsertAsset(a.id, "description", { text: "a" }, USER);
    memUpsertAsset(b.id, "description", { text: "b" }, USER);

    memDeleteBook(a.id);

    expect(memListChapters(b.id, USER)).toHaveLength(1);
    expect(memListAssets(b.id, USER)).toHaveLength(1);
  });
});

describe("memory-store chapter reorder", () => {
  it("reassigns order_index to match the given id order", () => {
    const book = memCreateBook({ title: "Order", book_type: "novel" }, USER);
    const c1 = memCreateChapter(book.id, { title: "One" }, USER);
    const c2 = memCreateChapter(book.id, { title: "Two" }, USER);
    const c3 = memCreateChapter(book.id, { title: "Three" }, USER);
    expect(memListChapters(book.id, USER).map((c) => c.id)).toEqual([c1.id, c2.id, c3.id]);

    memReorderChapters([c3.id, c1.id, c2.id]);

    const ordered = memListChapters(book.id, USER);
    expect(ordered.map((c) => c.id)).toEqual([c3.id, c1.id, c2.id]);
    expect(ordered.map((c) => c.order_index)).toEqual([0, 1, 2]);
  });

  it("ignores unknown ids without throwing", () => {
    expect(() => memReorderChapters(["nonexistent"])).not.toThrow();
  });
});

describe("memory-store publish asset upsert", () => {
  it("creates on first upsert, updates in place on the next", () => {
    const book = memCreateBook({ title: "Assets", book_type: "novel" }, USER);
    const first = memUpsertAsset(book.id, "keywords", { items: ["a", "b"] }, USER);
    expect(memListAssets(book.id, USER)).toHaveLength(1);

    const second = memUpsertAsset(book.id, "keywords", { items: ["c"] }, USER);
    expect(second.id).toBe(first.id);
    expect(memListAssets(book.id, USER)).toHaveLength(1);
    expect(memListAssets(book.id, USER)[0].content).toEqual({ items: ["c"] });
  });

  it("keys assets by book + kind, so different kinds coexist", () => {
    const book = memCreateBook({ title: "Assets2", book_type: "novel" }, USER);
    memUpsertAsset(book.id, "description", { text: "x" }, USER);
    memUpsertAsset(book.id, "keywords", { items: ["y"] }, USER);
    expect(memListAssets(book.id, USER)).toHaveLength(2);
  });
});
