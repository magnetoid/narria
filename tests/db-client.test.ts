import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getAdminDb, getDb, isDbConfigured, requireDb } from "@/lib/db/client";
import { __resetMemoryStore } from "@/lib/db/memory-store";
import { createBook, listBooks } from "@/lib/db/repositories/books";

afterEach(() => {
  __resetMemoryStore();
});

// The zero-setup contract, now across an async boundary: no env at all must still
// mean "no client", which is what routes every repository to the memory store.
describe("getDb (no env)", () => {
  it("resolves to null", async () => {
    expect(await getDb()).toBeNull();
  });

  it("is async — callers that forget to await would get a truthy Promise", () => {
    expect(getDb()).toBeInstanceOf(Promise);
  });

  it("leaves repositories on the memory store", async () => {
    const book = await createBook({ title: "Zero setup", book_type: "novel" }, "user_1");
    expect((await listBooks("user_1")).map((b) => b.id)).toContain(book.id);
  });

  it("reports the database as unconfigured", () => {
    expect(isDbConfigured()).toBe(false);
  });
});

describe("getAdminDb (no env)", () => {
  it("returns null rather than a client that cannot reach anything", () => {
    expect(getAdminDb()).toBeNull();
  });
});

describe("requireDb (no env)", () => {
  it("rejects", async () => {
    await expect(requireDb()).rejects.toThrow(/Supabase/);
  });

  // URL + service role alone no longer boots (getSessionUser refuses it), so the
  // operator who hits this message must be told the anon key is part of the answer.
  it("names the anon key, not just the URL and service-role key", async () => {
    await expect(requireDb()).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });
});

// getDb() is async, and `Promise<SupabaseClient | null>` is truthy — so a forgotten
// `await` type-checks, skips the `if (!db)` memory-store fallback, and breaks
// zero-setup at runtime only. Scan the source: a runtime test only covers the paths
// it happens to exercise, this covers every call site.
describe("getDb call sites", () => {
  const repositories = path.resolve(__dirname, "../lib/db/repositories");

  it("await getDb() everywhere in lib/db/repositories", () => {
    const unawaited: string[] = [];
    let callSites = 0;

    for (const file of readdirSync(repositories).filter((f) => f.endsWith(".ts"))) {
      const source = readFileSync(path.join(repositories, file), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      for (const line of source.split("\n")) {
        if (!/\bgetDb\(\)/.test(line)) continue;
        callSites++;
        if (!/\bawait\s+getDb\(\)/.test(line)) unawaited.push(`${file}: ${line.trim()}`);
      }
    }

    // Guards the guard: a rename must not turn this into a vacuous pass.
    expect(callSites).toBeGreaterThan(0);
    expect(unawaited).toEqual([]);
  });
});
