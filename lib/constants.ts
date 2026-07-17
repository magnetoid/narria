// ── App identity ───────────────────────────────────────────────────────────────
export const SITE = {
  name: "Narria",
  tagline: "From idea to published book.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://narria.dotbooks.store",
} as const;

// Owner of the shared demo workspace. Only reached when no auth is configured and
// no per-visitor demo cookie exists (build-time prerender) — see lib/auth/session.ts.
export const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

// ── Book types ───────────────────────────────────────────────────────────────
export type BookTypeValue =
  | "novel"
  | "memoir"
  | "biography"
  | "business"
  | "self_help"
  | "academic"
  | "children"
  | "history"
  | "cookbook"
  | "other";

export interface BookType {
  value: BookTypeValue;
  label: string;
  emoji: string;
  blurb: string;
  /** Fiction types unlock characters/world and a narrative interview slant. */
  fiction: boolean;
}

export const BOOK_TYPES: BookType[] = [
  { value: "novel", label: "Novel", emoji: "📖", blurb: "Fiction with characters, plot, and arc.", fiction: true },
  { value: "memoir", label: "Memoir", emoji: "🕯️", blurb: "Your life, a season of it, told with meaning.", fiction: false },
  { value: "biography", label: "Biography", emoji: "👤", blurb: "The life of another, researched and shaped.", fiction: false },
  { value: "business", label: "Business Book", emoji: "📈", blurb: "Ideas, frameworks, and lessons for work.", fiction: false },
  { value: "self_help", label: "Self-Help", emoji: "🌱", blurb: "Guide the reader toward change and growth.", fiction: false },
  { value: "academic", label: "Academic", emoji: "🎓", blurb: "Rigorous, cited, structured argument.", fiction: false },
  { value: "children", label: "Children's Book", emoji: "🧸", blurb: "Simple, warm, illustrated-friendly stories.", fiction: true },
  { value: "history", label: "History", emoji: "🏛️", blurb: "Events and eras, narrated and sourced.", fiction: false },
  { value: "cookbook", label: "Cookbook", emoji: "🍲", blurb: "Recipes wrapped in story and method.", fiction: false },
  { value: "other", label: "Other", emoji: "✨", blurb: "Something all your own.", fiction: false },
];

export function getBookType(value: string): BookType {
  return BOOK_TYPES.find((t) => t.value === value) ?? BOOK_TYPES[BOOK_TYPES.length - 1];
}

// ── Book status ──────────────────────────────────────────────────────────────
export type BookStatus = "draft" | "outlining" | "writing" | "publishing";

export const BOOK_STATUS_LABEL: Record<BookStatus, string> = {
  draft: "Draft",
  outlining: "Outlining",
  writing: "Writing",
  publishing: "Publishing",
};

// ── AI agents ────────────────────────────────────────────────────────────────
export type AgentName =
  | "bookPlanner"
  | "chapterWriter"
  | "editor"
  | "critic"
  | "researchAssistant"
  | "factCheck"
  | "metadata";

// ── Rate limits ──────────────────────────────────────────────────────────────
/** Ceilings on the NUMBER of paid model calls, enforced in the `ai` facade (see
 *  lib/rate-limit.ts). Tunable: these are cost guards, not product rules — raise them
 *  if legitimate writing hits the ceiling. The facade skips this enforcement entirely
 *  when the resolved provider is the mock (lib/ai/index.ts: enforceCallBudget) — with
 *  no ANTHROPIC_API_KEY there is nothing to guard the cost of, and the zero-setup demo
 *  must not be throttled for a bill it will never receive.
 *
 *  These meter call count only. Per-call cost is bounded separately, by truncation
 *  where text enters a prompt (lib/ai/prompts.ts: brainContext, chapter content,
 *  currentText) — because every input is caller-written and none of it is otherwise
 *  bounded. Tune the two together: multiplying a ceiling here multiplies the bill by
 *  the per-call cost the prompt caps allow, INPUT included. Reasoning from max_tokens
 *  alone understates it by an order of magnitude — the system prompt carries the Book
 *  Brain on every call, and it is saved by an unmetered non-AI action.
 *
 *  `concurrentStreams` exists because the per-minute counter cannot see a few
 *  long-lived streams each burning tokens for minutes on one call apiece.
 *
 *  The `demo*` pair is a ceiling across ALL demo callers at once, not per caller.
 *  A demo identity is a cookie the visitor carries and the proxy will mint on
 *  demand (lib/auth/session.ts, proxy.ts), so the per-caller limits above are only
 *  a fairness control there: rotating the cookie buys a fresh per-caller budget.
 *  These two are keyed on a name the server chose, so they are what bounds the demo's
 *  call volume when a deployment has an ANTHROPIC_API_KEY and no Supabase auth — a
 *  public, login-less endpoint on a real key. The tradeoff is deliberate: an abuser
 *  can exhaust the shared demo budget and leave honest visitors throttled, which is
 *  the cheaper failure of the two. */
export const RATE_LIMITS = {
  aiCallsPerMinute: 10,
  concurrentStreams: 4,
  demoCallsPerMinute: 60,
  demoConcurrentStreams: 12,
} as const;

// ── Chapter workspace AI actions ─────────────────────────────────────────────
export type AiActionGroup = "write" | "transform" | "review";
/** How the result returns to the workspace. */
export type AiActionOutput = "stream-append" | "replace" | "append" | "note";

export interface ChapterAiAction {
  id: string;
  label: string;
  hint: string;
  icon: string; // lucide-react icon name; mapped in the UI
  agent: AgentName;
  group: AiActionGroup;
  output: AiActionOutput;
  needsSelection?: boolean;
}

export const CHAPTER_AI_ACTIONS: ChapterAiAction[] = [
  { id: "continue", label: "Continue writing", hint: "Draft the next passage in your voice.", icon: "PenLine", agent: "chapterWriter", group: "write", output: "stream-append" },
  { id: "rewrite", label: "Rewrite selection", hint: "Same meaning, better prose.", icon: "RefreshCw", agent: "editor", group: "transform", output: "replace", needsSelection: true },
  { id: "expand", label: "Expand", hint: "Add depth and detail.", icon: "Maximize2", agent: "editor", group: "transform", output: "replace", needsSelection: true },
  { id: "shorten", label: "Shorten", hint: "Tighten without losing meaning.", icon: "Minimize2", agent: "editor", group: "transform", output: "replace", needsSelection: true },
  { id: "improve_flow", label: "Improve flow", hint: "Smooth transitions and rhythm.", icon: "Waves", agent: "editor", group: "transform", output: "replace", needsSelection: true },
  { id: "emotional", label: "More emotional", hint: "Warmer, more felt.", icon: "Heart", agent: "editor", group: "transform", output: "replace", needsSelection: true },
  { id: "professional", label: "More professional", hint: "Crisp and authoritative.", icon: "Briefcase", agent: "editor", group: "transform", output: "replace", needsSelection: true },
  { id: "add_example", label: "Add example", hint: "Ground it with an example.", icon: "Lightbulb", agent: "editor", group: "transform", output: "append", needsSelection: false },
  { id: "add_dialogue", label: "Add dialogue", hint: "Bring it to life with voices.", icon: "MessagesSquare", agent: "editor", group: "transform", output: "append", needsSelection: false },
  { id: "check_consistency", label: "Check consistency", hint: "Flag drift from your Book Brain.", icon: "ShieldCheck", agent: "critic", group: "review", output: "note" },
  { id: "summarize", label: "Summarize chapter", hint: "A tight recap of this chapter.", icon: "AlignLeft", agent: "critic", group: "review", output: "note" },
];

// ── Publish Center assets ────────────────────────────────────────────────────
export type PublishAssetKind =
  | "description"
  | "author_bio"
  | "subtitle_ideas"
  | "keywords"
  | "categories"
  | "back_cover"
  | "sales_copy";

export interface PublishAsset {
  kind: PublishAssetKind;
  label: string;
  hint: string;
  icon: string;
  /** list = array of strings; prose = single block of text */
  shape: "prose" | "list";
}

export const PUBLISH_ASSETS: PublishAsset[] = [
  { kind: "description", label: "Book description", hint: "The blurb that sells the book.", icon: "FileText", shape: "prose" },
  { kind: "author_bio", label: "Author bio", hint: "Who you are, briefly and well.", icon: "UserRound", shape: "prose" },
  { kind: "subtitle_ideas", label: "Subtitle ideas", hint: "A few subtitle directions.", icon: "Heading", shape: "list" },
  { kind: "keywords", label: "Keywords", hint: "Discoverability terms.", icon: "Tags", shape: "list" },
  { kind: "categories", label: "Category suggestions", hint: "Where this book belongs.", icon: "FolderTree", shape: "list" },
  { kind: "back_cover", label: "Back cover text", hint: "The copy for the back cover.", icon: "BookCopy", shape: "prose" },
  { kind: "sales_copy", label: "Sales page copy", hint: "Longer persuasive landing copy.", icon: "Megaphone", shape: "prose" },
];

// ── Book shell navigation ────────────────────────────────────────────────────
export const BOOK_NAV = [
  { segment: "interview", label: "Interview", icon: "MessagesSquare" },
  { segment: "brain", label: "Book Brain", icon: "BrainCircuit" },
  { segment: "outline", label: "Outline", icon: "ListTree" },
  { segment: "chapters", label: "Chapters", icon: "BookOpen" },
  { segment: "publish", label: "Publish", icon: "Sparkles" },
] as const;
