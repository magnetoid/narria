import { describe, expect, it } from "vitest";
import { brainContext, buildContinue, buildEdit } from "@/lib/ai/prompts";
import { CHAPTER_AI_ACTIONS } from "@/lib/constants";
import { brainPatch } from "@/lib/validation";
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

describe("brainContext cost bound", () => {
  // The Book Brain is attacker-writable through saveBrain, which is not an AI action
  // and so spends none of the rate limiter's budget. brainPatch caps each field but
  // not their sum, so a schema-valid brain is worth ~552k characters — and it rides
  // the SYSTEM prompt of every agent on every call. The rate limiter meters call
  // count; only this cap meters what a call costs.
  const maximalBrain = (): BookBrain =>
    brain({
      audience: "a".repeat(2000),
      tone: "a".repeat(2000),
      writing_style: "a".repeat(2000),
      author_background: "a".repeat(2000),
      author_goals: "a".repeat(2000),
      reader_takeaway: "a".repeat(2000),
      key_ideas: Array.from({ length: 100 }, () => "b".repeat(500)),
      style_rules: Array.from({ length: 100 }, () => "c".repeat(500)),
      characters: Array.from({ length: 100 }, () => ({
        name: "n".repeat(200),
        role: "r".repeat(200),
        description: "d".repeat(2000),
      })),
      research_notes: Array.from({ length: 200 }, () => "e".repeat(1000)),
    });

  it("is a brain the validation schema actually accepts", () => {
    // Guards the premise: if brainPatch tightened, this stops being an attack and
    // the cap below stops being load-bearing — better to learn that here.
    const b = maximalBrain();
    const parsed = brainPatch.safeParse({
      audience: b.audience,
      tone: b.tone,
      writing_style: b.writing_style,
      author_background: b.author_background,
      author_goals: b.author_goals,
      reader_takeaway: b.reader_takeaway,
      key_ideas: b.key_ideas,
      style_rules: b.style_rules,
      characters: b.characters,
      research_notes: b.research_notes,
    });
    expect(parsed.success).toBe(true);
  });

  it("caps the aggregate a maximal brain contributes to a prompt", () => {
    const raw = maximalBrain();
    const uncappedSize =
      (raw.research_notes?.length ?? 0) * 1000 + (raw.characters?.length ?? 0) * 2400;
    expect(uncappedSize).toBeGreaterThan(400_000);

    expect(brainContext(book(), raw).length).toBeLessThanOrEqual(8000);
  });

  it("bounds the system prompt of an agent reached from the AI route", () => {
    // app/api/ai/continue/route.ts -> continueChapter -> buildContinue. The prompt
    // side already truncates (currentText.slice(-4000)); the system side is where
    // the brain lands.
    const built = buildContinue(book(), maximalBrain(), chapter(), "Some prose.");
    expect(built.system.length).toBeLessThan(10_000);
  });

  it("leaves a realistic brain untouched", () => {
    const ctx = brainContext(
      book(),
      brain({
        audience: "Busy parents",
        key_ideas: ["Start small", "Show up daily"],
        research_notes: ["Check the 1998 census figures"],
      }),
    );
    expect(ctx).toContain("Busy parents");
    expect(ctx).toContain("Check the 1998 census figures");
    expect(ctx.length).toBeLessThan(8000);
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
