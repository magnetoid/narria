import { describe, expect, it } from "vitest";
import { brainContext, buildEdit } from "@/lib/ai/prompts";
import { CHAPTER_AI_ACTIONS } from "@/lib/constants";
import type { Book, BookBrain, Chapter } from "@/lib/db/types";

const book = (overrides: Partial<Book> = {}): Book => ({
  id: "book_1",
  user_id: "user_1",
  title: "The Long Way Home",
  subtitle: null,
  book_type: "memoir",
  status: "draft",
  cover_emoji: "📖",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const brain = (overrides: Partial<BookBrain> = {}): BookBrain => ({
  id: "brain_1",
  book_id: "book_1",
  user_id: "user_1",
  audience: "Curious readers",
  tone: "Warm",
  writing_style: "Concrete",
  author_background: null,
  author_goals: null,
  reader_takeaway: null,
  key_ideas: [],
  style_rules: [],
  characters: [],
  research_notes: [],
  interview: {},
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const chapter = (overrides: Partial<Chapter> = {}): Chapter => ({
  id: "chapter_1",
  book_id: "book_1",
  user_id: "user_1",
  order_index: 0,
  title: "Chapter One",
  goal: null,
  summary: null,
  key_points: [],
  estimated_word_count: 0,
  content: "",
  status: "planned",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("brainContext", () => {
  it("includes lines only for fields that are present", () => {
    const ctx = brainContext(book(), brain({ audience: "Busy parents", tone: null }));
    expect(ctx).toContain("Audience: Busy parents");
    expect(ctx).not.toContain("Tone:");
  });

  it("omits Audience entirely when null", () => {
    const ctx = brainContext(book(), brain({ audience: null }));
    expect(ctx).not.toContain("Audience:");
  });

  it("includes characters only when present", () => {
    const withChars = brainContext(
      book(),
      brain({ characters: [{ name: "Ada", role: "Lead", description: "Sharp and stubborn." }] }),
    );
    expect(withChars).toContain("Characters:");
    expect(withChars).toContain("Ada (Lead): Sharp and stubborn.");

    const withoutChars = brainContext(book(), brain({ characters: [] }));
    expect(withoutChars).not.toContain("Characters:");
  });

  it("labels fiction book types as (fiction), non-fiction types without the label", () => {
    const fiction = brainContext(book({ book_type: "novel" }), null);
    expect(fiction).toContain("Type: Novel (fiction)");

    const nonFiction = brainContext(book({ book_type: "memoir" }), null);
    expect(nonFiction).toContain("Type: Memoir");
    expect(nonFiction).not.toContain("(fiction)");
  });

  it("renders just the book header when brain is null", () => {
    const ctx = brainContext(book(), null);
    expect(ctx).toContain("Title: The Long Way Home");
    expect(ctx).not.toContain("Audience:");
  });
});

describe("buildEdit / transform action instructions", () => {
  const transformActions = CHAPTER_AI_ACTIONS.filter((a) => a.group === "transform");

  it("covers every transform action with CHAPTER_AI_ACTIONS entries", () => {
    // Sanity check on the fixture itself — guards against constants.ts drifting
    // to zero transform actions without anyone noticing.
    expect(transformActions.length).toBeGreaterThan(0);
  });

  it("produces distinct prompt text for every transform action id", () => {
    const b = book();
    const c = chapter();
    const prompts = transformActions.map((a) => buildEdit(a.id, b, null, c, "Some passage.").prompt);
    expect(new Set(prompts).size).toBe(transformActions.length);
  });

  it("falls back to the rewrite instruction for an unknown action id", () => {
    const b = book();
    const c = chapter();
    const unknown = buildEdit("not-a-real-action", b, null, c, "Some passage.");
    const rewrite = buildEdit("rewrite", b, null, c, "Some passage.");
    expect(unknown.prompt).toBe(rewrite.prompt);
  });
});
