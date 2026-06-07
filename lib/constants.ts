// ── App identity ───────────────────────────────────────────────────────────────
export const SITE = {
  name: "Narria",
  tagline: "From idea to published book.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://narria.dotbooks.store",
} as const;

// Single implicit workspace user until real auth lands. Present on every row.
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
