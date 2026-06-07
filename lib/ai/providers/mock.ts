import type {
  AIProvider,
  GenResult,
  GenStructuredRequest,
  GenTextRequest,
  StructuredResult,
} from "@/lib/ai/provider";
import { getBookType } from "@/lib/constants";
import type { Book, BookBrain, Chapter } from "@/lib/db/types";

const approxTokens = (s: string) => Math.max(1, Math.ceil(s.length / 4));

function input<T = unknown>(req: { meta: { input?: Record<string, unknown> } }, key: string): T | undefined {
  return req.meta.input?.[key] as T | undefined;
}

// ── structured builders ──────────────────────────────────────────────────────────
function buildBrain(req: GenStructuredRequest<unknown>): unknown {
  const book = input<Book>(req, "book");
  const qa = input<{ question: string; answer: string }[]>(req, "qa") ?? [];
  const fiction = book ? getBookType(book.book_type).fiction : false;
  const answers = qa.map((x) => x.answer).filter(Boolean);
  const ideas = answers.flatMap((a) =>
    a.split(/[.\n]/).map((s) => s.trim()).filter((s) => s.length > 12),
  );
  return {
    audience: answers[1]?.slice(0, 120) || "Curious general readers who want depth without jargon.",
    tone: answers[3]?.slice(0, 80) || "Warm, clear, and quietly confident.",
    writing_style: "Concrete, sensory, and well-paced — short paragraphs, vivid specifics.",
    author_background: answers[4]?.slice(0, 160) || "An author writing from lived experience and genuine care for the subject.",
    author_goals: answers[2]?.slice(0, 160) || "Leave the reader changed — informed, moved, and ready to act.",
    reader_takeaway: answers[0]?.slice(0, 160) || "A clear, memorable understanding of the book's central promise.",
    key_ideas: (ideas.length ? ideas : ["The central premise", "Why it matters now", "What to do with it"]).slice(0, 6),
    style_rules: ["Show, don't tell.", "Cut filler ruthlessly.", "One idea per paragraph.", "Earn every emotional beat."],
    characters: fiction
      ? [
          { name: "The Protagonist", role: "Lead", description: "Wants something badly and is changed by the cost of getting it." },
          { name: "The Foil", role: "Counterpoint", description: "Embodies the path not taken." },
        ]
      : [],
  };
}

function buildOutline(req: GenStructuredRequest<unknown>): unknown {
  const book = input<Book>(req, "book");
  const brain = input<BookBrain | null>(req, "brain") ?? null;
  const type = book ? getBookType(book.book_type) : getBookType("other");
  const ideas = brain?.key_ideas?.length
    ? brain.key_ideas
    : ["Foundations", "The turning point", "The deeper pattern", "Putting it to work", "What comes next"];

  const middle = ideas.map((idea, i) => ({
    title: idea.replace(/^[a-z]/, (c) => c.toUpperCase()).slice(0, 60),
    goal: `Help the reader fully grasp: ${idea.toLowerCase()}.`,
    summary: `This chapter develops "${idea}" with examples and reflection, moving the ${type.fiction ? "story" : "argument"} forward. It builds on what came before and sets up what follows.`,
    key_points: ["Open with a concrete moment", `Unpack ${idea.toLowerCase()}`, "Ground it in an example", "Land the takeaway"],
    estimated_word_count: 2200 + (i % 3) * 400,
  }));

  const chapters = [
    {
      title: type.fiction ? "The World Tilts" : "Why This Book",
      goal: type.fiction ? "Establish the ordinary world and the inciting crack in it." : "Hook the reader and promise the journey.",
      summary: `Set the stage for "${book?.title ?? "the book"}" and make the reader feel why this matters to them right now.`,
      key_points: ["Open with a vivid hook", "Establish stakes", "Promise the payoff"],
      estimated_word_count: 1800,
    },
    ...middle,
    {
      title: type.fiction ? "What Remains" : "Where You Go From Here",
      goal: type.fiction ? "Resolve the arc and echo the opening." : "Synthesize and send the reader off changed.",
      summary: "Bring the threads together, deliver the final emotional and intellectual beat, and leave the reader with something to carry.",
      key_points: ["Tie the threads together", "Deliver the final beat", "Leave a lasting image or call to action"],
      estimated_word_count: 1900,
    },
  ];
  return { chapters };
}

function buildMetadata(req: GenStructuredRequest<unknown>): unknown {
  const book = input<Book>(req, "book");
  const kind = input<string>(req, "kind") ?? "description";
  const title = book?.title ?? "This Book";
  switch (kind) {
    case "subtitle_ideas":
      return { items: [`A Guide to ${title}`, `How to Begin`, `Lessons Worth Keeping`, `The Honest Path`, `From Idea to Done`, `What No One Told You`] };
    case "keywords":
      return { items: ["writing", "creativity", "self-improvement", "storytelling", "craft", "inspiration", "how-to", "growth", "beginners", "guide", "motivation", "practical"] };
    case "categories":
      return { items: ["Nonfiction › Self-Help", "Nonfiction › Writing", "Reference › Writing Skills", "Education › Creativity", "Business › Personal Success", "Lifestyle › Personal Growth"] };
    default:
      return {
        text: `${title} meets you where you are and walks with you to where you want to be. With warmth and clarity, it turns a daunting idea into a path you can actually follow — one honest step at a time. By the last page you won't just understand the subject; you'll be ready to act on it.`,
      };
  }
}

// ── text builders ────────────────────────────────────────────────────────────────
function buildText(req: GenTextRequest): string {
  const kind = req.meta.kind;
  if (kind === "chapter-continue") {
    const chapter = input<Chapter>(req, "chapter");
    const title = chapter?.title ?? "this chapter";
    return `The room had gone quiet in the way rooms do when something important is about to be said. ${title} had always been about this moment, though no one had named it yet.\n\nThere was a temptation to rush ahead, to reach for the tidy conclusion. Instead, the truth arrived slowly, the way truths usually do — first as a feeling, then as a sentence you can't unsay. It settled over everything and changed the shape of what came next.`;
  }
  if (kind.startsWith("edit:")) {
    const action = kind.slice(5);
    const selection = (input<string>(req, "selection") ?? "").trim();
    if (!selection) return "Select a passage and try again.";
    switch (action) {
      case "shorten": {
        const first = selection.split(/(?<=[.!?])\s/)[0] ?? selection;
        return first.trim();
      }
      case "expand":
        return `${selection} The detail mattered more than it first appeared — and the longer you sat with it, the more it opened up, revealing the quiet logic underneath.`;
      case "add_example":
        return `For example, consider the morning everything almost fell apart: a single overlooked detail nearly undid weeks of careful work — and it was precisely that near-miss that taught the lesson nothing else could.`;
      case "add_dialogue":
        return `"You really think this will work?" she asked.\n"No," he said. "But I think it's worth finding out."`;
      case "emotional":
        return `${selection.replace(/\.$/, "")} — and it landed somewhere deeper than thought, in the place where we keep the things we can't quite say.`;
      case "professional":
        return selection.replace(/\bsort of\b|\bkind of\b/gi, "").trim();
      default:
        return `${selection.trim()}`;
    }
  }
  if (kind === "critic:consistency") {
    return "- Tone is consistent with the Book Brain.\n- One section leans more formal than the stated voice — consider warming it.\n- A claim near the middle would benefit from a concrete example.\nOverall: aligned, with small, easy fixes.";
  }
  if (kind === "critic:summary") {
    const chapter = input<Chapter>(req, "chapter");
    return `In "${chapter?.title ?? "this chapter"}," the central idea is introduced through a concrete moment and carried to a clear turning point. It moves the book forward and sets up what follows.`;
  }
  if (kind === "research") {
    return "- Key background point worth weaving in.\n- A useful statistic to find and verify.\n- A historical parallel readers will recognize.\n- One common misconception to address.\n(Verify specifics before publishing.)";
  }
  if (kind === "factcheck") {
    return "- Claim: a specific figure is cited — verify the source.\n- Claim: a date is referenced — confirm it.\n- Claim: an attribution is made — check the original quote.";
  }
  return "Generated draft text.";
}

export class MockProvider implements AIProvider {
  readonly name = "mock";

  async generateText(req: GenTextRequest): Promise<GenResult> {
    const text = buildText(req);
    return { text, model: "mock", tokens: approxTokens(text) };
  }

  async *streamText(req: GenTextRequest): AsyncIterable<string> {
    const text = buildText(req);
    // Emit in small word-group chunks to simulate streaming.
    const words = text.split(/(\s+)/);
    let buf = "";
    for (let i = 0; i < words.length; i++) {
      buf += words[i];
      if (i % 4 === 3) {
        yield buf;
        buf = "";
      }
    }
    if (buf) yield buf;
  }

  async generateStructured<T>(req: GenStructuredRequest<T>): Promise<StructuredResult<T>> {
    let obj: unknown;
    if (req.meta.kind === "brain-synthesis") obj = buildBrain(req);
    else if (req.meta.kind === "outline") obj = buildOutline(req);
    else if (req.meta.kind.startsWith("metadata:")) obj = buildMetadata(req);
    else obj = {};
    // Validate against the real schema so mock output can never drift from contract.
    const data = req.schema.parse(obj);
    return { data, model: "mock", tokens: approxTokens(JSON.stringify(data)) };
  }
}
