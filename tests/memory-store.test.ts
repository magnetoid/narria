import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetMemoryStore,
  memCreateBook,
  memCreateChapter,
  memDeleteBook,
  memGetBook,
  memGetBrain,
  memListAssets,
  memListBooks,
  memListChapters,
  memReorderChapters,
  memUpdateBook,
  memUpsertAsset,
  memUpsertBrain,
} from "@/lib/db/memory-store";

const USER = "user_1";
const OTHER = "user_2";

// The store backs its maps on globalThis (see memory-store.ts) so every route
// in the process shares one instance — `__resetMemoryStore()` clears the Maps
// in place between tests for isolation (a plain `delete globalThis.__narriaMem`
// does NOT work here: this module destructured the Maps out of `state` at load
// time, so it would keep the same, now-detached-from-global Maps forever).
beforeEach(() => {
  __resetMemoryStore();
});

describe("memory-store books", () => {
  it("creates, gets, updates, and deletes a book", () => {
    const book = memCreateBook({ title: "My Book", book_type: "novel" }, USER);
    expect(memGetBook(book.id, USER)).toEqual(book);

    const updated = memUpdateBook(book.id, { title: "Renamed" }, USER);
    expect(updated.title).toBe("Renamed");
    expect(memGetBook(book.id, USER)?.title).toBe("Renamed");

    memDeleteBook(book.id, USER);
    expect(memGetBook(book.id, USER)).toBeNull();
  });

  it("defaults title to Untitled when blank", () => {
    const book = memCreateBook({ title: "", book_type: "other" }, USER);
    expect(book.title).toBe("Untitled");
  });

  it("throws when updating a book that doesn't exist", () => {
    expect(() => memUpdateBook("does-not-exist", { title: "x" }, USER)).toThrow();
  });

  // Mirrors the owner-scoped SQL writes: to a non-owner, another user's row must
  // behave exactly like one that isn't there.
  it("treats another user's book as not found on update, and ignores their delete", () => {
    const book = memCreateBook({ title: "Mine", book_type: "novel" }, USER);

    expect(() => memUpdateBook(book.id, { title: "defaced" }, OTHER)).toThrow();
    memDeleteBook(book.id, OTHER);

    expect(memGetBook(book.id, USER)?.title).toBe("Mine");
  });

  it("refuses to seed a brain or asset from another user's row", () => {
    const book = memCreateBook({ title: "Mine", book_type: "novel" }, USER);
    memUpsertBrain(book.id, { tone: "mine" }, USER);
    memUpsertAsset(book.id, "description", { text: "mine" }, USER);

    expect(() => memUpsertBrain(book.id, { tone: "stolen" }, OTHER)).toThrow();
    expect(() => memUpsertAsset(book.id, "description", { text: "stolen" }, OTHER)).toThrow();

    expect(memGetBrain(book.id, USER)?.tone).toBe("mine");
    expect(memListAssets(book.id, USER)[0].content).toEqual({ text: "mine" });
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

    memDeleteBook(book.id, USER);

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

    memDeleteBook(a.id, USER);

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

    memReorderChapters([c3.id, c1.id, c2.id], USER);

    const ordered = memListChapters(book.id, USER);
    expect(ordered.map((c) => c.id)).toEqual([c3.id, c1.id, c2.id]);
    expect(ordered.map((c) => c.order_index)).toEqual([0, 1, 2]);
  });

  it("ignores unknown ids without throwing", () => {
    expect(() => memReorderChapters(["nonexistent"], USER)).not.toThrow();
  });
});

// RED-first regression: `delete globalThis.__narriaMem` in the beforeEach above
// looks like a reset but the module already destructured `books` etc. out of
// `state` at load time, so it keeps the same Map forever. By this point in the
// file several earlier tests have created books for USER and never deleted
// them, so under the broken reset this sees every leftover instead of a clean
// store — exactly the leak that made an unrelated ownership test see 8 books
// instead of 1.
describe("memory-store reset actually isolates tests", () => {
  it("does not leak books created by earlier tests in this file", () => {
    expect(memListBooks(USER)).toHaveLength(0);
  });

  it("__resetMemoryStore empties a store that was just seeded", () => {
    memCreateBook({ title: "Seeded", book_type: "novel" }, USER);
    expect(memListBooks(USER)).toHaveLength(1);

    __resetMemoryStore();

    expect(memListBooks(USER)).toHaveLength(0);
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
