import { getBookType, type PublishAssetKind } from "@/lib/constants";
import type { Book, BookBrain, Chapter } from "@/lib/db/types";

export interface BuiltPrompt {
  system: string;
  prompt: string;
}

const PREAMBLE = `You are a senior writing collaborator inside Narria, a calm, premium book-writing studio.
You help a human author write THEIR book in THEIR voice — never generic, never robotic, never filler.
You always honor the Book Brain below: audience, tone, writing style, goals, and rules are binding.
Output only the requested content. No preamble, no "Sure!", no meta commentary, no markdown headers unless asked.`;

function list(label: string, items: string[] | undefined): string {
  if (!items || items.length === 0) return "";
  return `${label}:\n${items.map((i) => `- ${i}`).join("\n")}\n`;
}

function line(label: string, value: string | null | undefined): string {
  return value ? `${label}: ${value}\n` : "";
}

/** Compact, binding context block fed to every agent. */
export function brainContext(book: Book, brain: BookBrain | null): string {
  const type = getBookType(book.book_type);
  let out = `BOOK BRAIN\n`;
  out += `Title: ${book.title}\n`;
  if (book.subtitle) out += `Subtitle: ${book.subtitle}\n`;
  out += `Type: ${type.label}${type.fiction ? " (fiction)" : ""}\n`;
  if (brain) {
    out += line("Audience", brain.audience);
    out += line("Tone", brain.tone);
    out += line("Writing style", brain.writing_style);
    out += line("Author background", brain.author_background);
    out += line("Author goals", brain.author_goals);
    out += line("What the reader should feel/learn", brain.reader_takeaway);
    out += list("Key ideas", brain.key_ideas);
    out += list("Style rules", brain.style_rules);
    out += list("Research notes", brain.research_notes);
    if (brain.characters?.length) {
      out += `Characters:\n${brain.characters
        .map((c) => `- ${c.name} (${c.role}): ${c.description}`)
        .join("\n")}\n`;
    }
  }
  return out.trim();
}

// ── Book Planner ────────────────────────────────────────────────────────────────
export function buildBrainSynthesis(
  book: Book,
  qa: { question: string; answer: string }[],
): BuiltPrompt {
  const type = getBookType(book.book_type);
  const transcript = qa
    .filter((x) => x.answer.trim())
    .map((x) => `Q: ${x.question}\nA: ${x.answer}`)
    .join("\n\n");
  return {
    system: `${PREAMBLE}\n\nYou are the Book Planner. Turn a guided interview into a structured Book Brain for a ${type.label.toLowerCase()}.`,
    prompt: `Here is the author's interview for "${book.title}" (${type.label}).
Synthesize it into a Book Brain. Be specific and faithful to what they said; infer tastefully where they were brief, but never contradict them.
${type.fiction ? "Include the main characters." : "Return an empty characters list."}

INTERVIEW
${transcript || "(The author kept it brief — infer a sensible starting point from the title and type.)"}`,
  };
}

export function buildOutline(book: Book, brain: BookBrain | null): BuiltPrompt {
  const type = getBookType(book.book_type);
  return {
    system: `${PREAMBLE}\n\nYou are the Book Planner. Design a complete, well-paced table of contents.\n\n${brainContext(book, brain)}`,
    prompt: `Generate a complete chapter outline for this ${type.label.toLowerCase()}.
Aim for ${type.fiction ? "a satisfying narrative arc" : "a logical progression that delivers the reader takeaway"}.
Return 8–14 chapters. For each: a real title (not "Chapter 1"), a one-sentence goal, a 2–3 sentence summary, 3–5 key points, and a realistic estimated word count (1500–4000).`,
  };
}

// ── Chapter Writer ───────────────────────────────────────────────────────────────
export function buildContinue(
  book: Book,
  brain: BookBrain | null,
  chapter: Chapter,
  currentText: string,
): BuiltPrompt {
  return {
    system: `${PREAMBLE}\n\nYou are the Chapter Writer. Continue the manuscript seamlessly in the author's voice.\n\n${brainContext(book, brain)}`,
    prompt: `Chapter: "${chapter.title}"
Goal: ${chapter.goal ?? "(open)"}
Key points still to cover: ${(chapter.key_points ?? []).join("; ") || "(use your judgement)"}

Continue writing from where this leaves off. Write 2–4 polished paragraphs. Match the existing rhythm; do not repeat what's already written; do not summarize.

MANUSCRIPT SO FAR:
${currentText.trim() ? currentText.slice(-4000) : "(blank — write the opening of the chapter)"}`,
  };
}

// ── Editor (the 8 transform actions) ────────────────────────────────────────────
const EDIT_INSTRUCTIONS: Record<string, string> = {
  rewrite: "Rewrite the selected passage so it reads better — clearer, stronger prose — while preserving its meaning and the author's voice.",
  expand: "Expand the selected passage with more depth, detail, and texture. Keep the voice; roughly double the length.",
  shorten: "Tighten the selected passage. Remove redundancy and filler; keep every essential idea. Make it noticeably shorter.",
  improve_flow: "Improve the flow of the selected passage: smoother transitions, better sentence rhythm, clearer connective tissue.",
  emotional: "Make the selected passage more emotional and evocative — warmer, more felt, more human — without melodrama.",
  professional: "Make the selected passage more professional and authoritative — crisp, confident, polished — without going cold.",
  add_example: "Add a concrete, vivid example that illustrates the passage. Return ONLY the new example paragraph(s) to append.",
  add_dialogue: "Add natural dialogue that brings this moment to life and fits the characters and tone. Return ONLY the new dialogue to append.",
};

export function buildEdit(
  actionId: string,
  book: Book,
  brain: BookBrain | null,
  chapter: Chapter,
  selection: string,
): BuiltPrompt {
  const instruction = EDIT_INSTRUCTIONS[actionId] ?? EDIT_INSTRUCTIONS.rewrite;
  const isAppend = actionId === "add_example" || actionId === "add_dialogue";
  return {
    system: `${PREAMBLE}\n\nYou are the Editor working inside the chapter "${chapter.title}".\n\n${brainContext(book, brain)}`,
    prompt: `${instruction}
${isAppend ? "Return only the new text." : "Return only the revised passage, ready to replace the original."}

PASSAGE:
${selection.trim() || "(no selection — use the current paragraph)"}`,
  };
}

// ── Critic ───────────────────────────────────────────────────────────────────────
export function buildConsistency(book: Book, brain: BookBrain | null, chapter: Chapter): BuiltPrompt {
  return {
    system: `${PREAMBLE}\n\nYou are the Critic. Check this chapter against the Book Brain and flag drift.\n\n${brainContext(book, brain)}`,
    prompt: `Review the chapter "${chapter.title}" for consistency with the Book Brain (tone, style rules, audience, facts, characters).
List concrete issues as short bullet points, each with a brief fix. If it's consistent, say so plainly. Be specific and kind.

CHAPTER:
${(chapter.content || "(empty)").slice(0, 8000)}`,
  };
}

export function buildSummary(book: Book, brain: BookBrain | null, chapter: Chapter): BuiltPrompt {
  return {
    system: `${PREAMBLE}\n\nYou are the Critic. Summarize the chapter tightly.\n\n${brainContext(book, brain)}`,
    prompt: `Write a 2–3 sentence summary of the chapter "${chapter.title}" capturing what happens and why it matters.

CHAPTER:
${(chapter.content || "(empty)").slice(0, 8000)}`,
  };
}

// ── Metadata (Publish Center) ────────────────────────────────────────────────────
const METADATA_INSTRUCTIONS: Record<PublishAssetKind, string> = {
  description: "Write a compelling ~150-word book description (the blurb a reader sees on a store page). Hook, promise, and a reason to buy.",
  author_bio: "Write a warm, credible ~80-word author bio in third person, grounded in the author's background.",
  subtitle_ideas: "Propose 6 strong subtitle options. Each should be short and clarify the book's promise.",
  keywords: "Propose 12 discoverability keywords/phrases readers would search for.",
  categories: "Propose 6 specific store categories/genres this book belongs in.",
  back_cover: "Write punchy back-cover copy (~120 words) that sells the book at a glance.",
  sales_copy: "Write persuasive sales-page copy (~250 words): headline, the problem, the promise, what's inside, and a call to action.",
};

export function buildMetadata(
  kind: PublishAssetKind,
  book: Book,
  brain: BookBrain | null,
  chapters: Chapter[],
): BuiltPrompt {
  const toc = chapters.map((c, i) => `${i + 1}. ${c.title}`).join("\n");
  return {
    system: `${PREAMBLE}\n\nYou are the Metadata agent for the Publish Center.\n\n${brainContext(book, brain)}`,
    prompt: `${METADATA_INSTRUCTIONS[kind]}

${toc ? `TABLE OF CONTENTS:\n${toc}` : ""}`,
  };
}

// ── Research & Fact-check (used by chapter tools / brain) ─────────────────────────
export function buildResearch(book: Book, brain: BookBrain | null, topic: string): BuiltPrompt {
  return {
    system: `${PREAMBLE}\n\nYou are the Research Assistant. Provide concise, useful background the author can weave in.\n\n${brainContext(book, brain)}`,
    prompt: `Give the author research notes on: "${topic}". 4–6 tight bullet points relevant to this book. Flag anything that should be verified.`,
  };
}

export function buildFactCheck(book: Book, brain: BookBrain | null, text: string): BuiltPrompt {
  return {
    system: `${PREAMBLE}\n\nYou are the Fact-Check agent. Surface claims that should be verified.\n\n${brainContext(book, brain)}`,
    prompt: `Read the passage and list factual claims that should be verified, each with why and a suggested check. Don't assert truth you can't confirm.

PASSAGE:
${text.slice(0, 8000)}`,
  };
}
