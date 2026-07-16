import { describe, expect, it } from "vitest";
import {
  assetContent,
  chapterEditInput,
  chapterPatch,
  chapterReviewInput,
  continueBody,
  createBookInput,
  idSchema,
  interviewEntries,
  brainPatch,
  updateBookPatch,
} from "@/lib/validation";

describe("idSchema", () => {
  it("accepts a non-empty id (memory-store or uuid shaped)", () => {
    expect(idSchema.safeParse("mem_1a2b3c").success).toBe(true);
    expect(idSchema.safeParse("11111111-1111-1111-1111-111111111111").success).toBe(true);
  });

  it("rejects empty or non-string ids", () => {
    expect(idSchema.safeParse("").success).toBe(false);
    expect(idSchema.safeParse(42).success).toBe(false);
    expect(idSchema.safeParse(undefined).success).toBe(false);
  });

  it("rejects an absurdly long id", () => {
    expect(idSchema.safeParse("x".repeat(500)).success).toBe(false);
  });
});

describe("createBookInput", () => {
  it("accepts a minimal valid input", () => {
    const res = createBookInput.safeParse({ book_type: "novel" });
    expect(res.success).toBe(true);
  });

  it("accepts an optional title and cover_emoji", () => {
    const res = createBookInput.safeParse({
      book_type: "memoir",
      title: "My Life",
      cover_emoji: "🕯️",
    });
    expect(res.success).toBe(true);
  });

  it("rejects an unknown book_type", () => {
    const res = createBookInput.safeParse({ book_type: "not-a-type" });
    expect(res.success).toBe(false);
  });

  it("rejects a missing book_type", () => {
    const res = createBookInput.safeParse({ title: "x" });
    expect(res.success).toBe(false);
  });

  it("rejects a title over 200 chars", () => {
    const res = createBookInput.safeParse({ book_type: "novel", title: "a".repeat(201) });
    expect(res.success).toBe(false);
  });
});

describe("updateBookPatch", () => {
  it("accepts an empty patch", () => {
    expect(updateBookPatch.safeParse({}).success).toBe(true);
  });

  it("accepts a partial patch with a valid status", () => {
    const res = updateBookPatch.safeParse({ title: "New title", status: "outlining" });
    expect(res.success).toBe(true);
  });

  it("rejects an invalid status", () => {
    const res = updateBookPatch.safeParse({ status: "archived" });
    expect(res.success).toBe(false);
  });

  it("rejects an overlong title", () => {
    const res = updateBookPatch.safeParse({ title: "a".repeat(201) });
    expect(res.success).toBe(false);
  });
});

describe("chapterPatch", () => {
  it("accepts an empty patch", () => {
    expect(chapterPatch.safeParse({}).success).toBe(true);
  });

  it("accepts a partial patch with key_points and status", () => {
    const res = chapterPatch.safeParse({
      title: "Chapter One",
      key_points: ["a", "b"],
      status: "drafting",
      estimated_word_count: 2000,
    });
    expect(res.success).toBe(true);
  });

  it("rejects an invalid status", () => {
    expect(chapterPatch.safeParse({ status: "done" }).success).toBe(false);
  });

  it("rejects a negative estimated_word_count", () => {
    expect(chapterPatch.safeParse({ estimated_word_count: -1 }).success).toBe(false);
  });

  it("rejects content over the length cap", () => {
    expect(chapterPatch.safeParse({ content: "a".repeat(60_001) }).success).toBe(false);
  });
});

describe("brainPatch", () => {
  it("accepts an empty patch", () => {
    expect(brainPatch.safeParse({}).success).toBe(true);
  });

  it("accepts null scalar fields", () => {
    const res = brainPatch.safeParse({ audience: null, tone: null });
    expect(res.success).toBe(true);
  });

  it("accepts a full patch with characters and interview", () => {
    const res = brainPatch.safeParse({
      audience: "Curious readers",
      key_ideas: ["idea one", "idea two"],
      characters: [{ name: "Ada", role: "Lead", description: "Sharp and stubborn." }],
      interview: { about: "A memoir about resilience." },
    });
    expect(res.success).toBe(true);
  });

  it("rejects a malformed character entry", () => {
    const res = brainPatch.safeParse({ characters: [{ name: "Ada" }] });
    expect(res.success).toBe(false);
  });

  it("rejects an oversized key_ideas array", () => {
    const res = brainPatch.safeParse({ key_ideas: Array.from({ length: 1000 }, (_, i) => `idea ${i}`) });
    expect(res.success).toBe(false);
  });
});

describe("assetContent", () => {
  it("accepts a prose shape", () => {
    expect(assetContent.safeParse({ text: "A great blurb." }).success).toBe(true);
  });

  it("accepts a list shape", () => {
    expect(assetContent.safeParse({ items: ["one", "two"] }).success).toBe(true);
  });

  it("accepts an empty object (no text or items)", () => {
    expect(assetContent.safeParse({}).success).toBe(true);
  });

  it("rejects an oversized items array", () => {
    const res = assetContent.safeParse({ items: Array.from({ length: 1000 }, () => "x") });
    expect(res.success).toBe(false);
  });

  it("rejects text over the length cap", () => {
    expect(assetContent.safeParse({ text: "a".repeat(20_001) }).success).toBe(false);
  });
});

describe("interviewEntries", () => {
  it("accepts a list of question/answer entries", () => {
    const res = interviewEntries.safeParse([
      { id: "about", question: "What is your book about?", answer: "Resilience." },
    ]);
    expect(res.success).toBe(true);
  });

  it("accepts an empty list", () => {
    expect(interviewEntries.safeParse([]).success).toBe(true);
  });

  it("rejects an entry missing an id", () => {
    const res = interviewEntries.safeParse([{ question: "Q", answer: "A" }]);
    expect(res.success).toBe(false);
  });

  it("rejects an answer over the length cap", () => {
    const res = interviewEntries.safeParse([
      { id: "about", question: "Q", answer: "a".repeat(20_001) },
    ]);
    expect(res.success).toBe(false);
  });
});

describe("continueBody", () => {
  it("accepts a valid body", () => {
    const res = continueBody.safeParse({
      bookId: "mem_1",
      chapterId: "mem_2",
      currentText: "Once upon a time...",
    });
    expect(res.success).toBe(true);
  });

  it("accepts empty currentText (blank chapter start)", () => {
    const res = continueBody.safeParse({ bookId: "mem_1", chapterId: "mem_2", currentText: "" });
    expect(res.success).toBe(true);
  });

  it("rejects a missing bookId", () => {
    const res = continueBody.safeParse({ chapterId: "mem_2", currentText: "x" });
    expect(res.success).toBe(false);
  });

  it("rejects currentText over ~60k chars", () => {
    const res = continueBody.safeParse({
      bookId: "mem_1",
      chapterId: "mem_2",
      currentText: "a".repeat(60_001),
    });
    expect(res.success).toBe(false);
  });
});

describe("chapterEditInput", () => {
  it("accepts a valid transform action with a selection", () => {
    const res = chapterEditInput.safeParse({
      actionId: "rewrite",
      bookId: "mem_1",
      chapterId: "mem_2",
      selection: "Some passage to rewrite.",
    });
    expect(res.success).toBe(true);
  });

  it("accepts an empty selection (add_example/add_dialogue don't need one)", () => {
    const res = chapterEditInput.safeParse({
      actionId: "add_example",
      bookId: "mem_1",
      chapterId: "mem_2",
      selection: "",
    });
    expect(res.success).toBe(true);
  });

  it("rejects a review action id", () => {
    const res = chapterEditInput.safeParse({
      actionId: "summarize",
      bookId: "mem_1",
      chapterId: "mem_2",
      selection: "x",
    });
    expect(res.success).toBe(false);
  });

  it("rejects an unknown action id", () => {
    const res = chapterEditInput.safeParse({
      actionId: "not-a-real-action",
      bookId: "mem_1",
      chapterId: "mem_2",
      selection: "x",
    });
    expect(res.success).toBe(false);
  });

  it("rejects a selection over ~60k chars", () => {
    const res = chapterEditInput.safeParse({
      actionId: "rewrite",
      bookId: "mem_1",
      chapterId: "mem_2",
      selection: "a".repeat(60_001),
    });
    expect(res.success).toBe(false);
  });
});

describe("chapterReviewInput", () => {
  it("accepts a valid review action with content", () => {
    const res = chapterReviewInput.safeParse({
      actionId: "summarize",
      bookId: "mem_1",
      chapterId: "mem_2",
      content: "<p>Chapter content</p>",
    });
    expect(res.success).toBe(true);
  });

  it("rejects a transform action id", () => {
    const res = chapterReviewInput.safeParse({
      actionId: "rewrite",
      bookId: "mem_1",
      chapterId: "mem_2",
      content: "x",
    });
    expect(res.success).toBe(false);
  });

  it("rejects content over ~60k chars", () => {
    const res = chapterReviewInput.safeParse({
      actionId: "summarize",
      bookId: "mem_1",
      chapterId: "mem_2",
      content: "a".repeat(60_001),
    });
    expect(res.success).toBe(false);
  });
});
