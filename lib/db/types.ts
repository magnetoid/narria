import type { BookStatus, BookTypeValue, PublishAssetKind, AgentName } from "@/lib/constants";

/** A character in a fiction Book Brain. */
export interface BrainCharacter {
  name: string;
  role: string;
  description: string;
}

/** Raw interview answers, keyed by question id. */
export type InterviewAnswers = Record<string, string>;

export interface Book {
  id: string;
  user_id: string;
  title: string;
  subtitle: string | null;
  book_type: BookTypeValue;
  status: BookStatus;
  cover_emoji: string;
  created_at: string;
  updated_at: string;
}

export interface BookBrain {
  id: string;
  book_id: string;
  user_id: string;
  audience: string | null;
  tone: string | null;
  writing_style: string | null;
  author_background: string | null;
  author_goals: string | null;
  reader_takeaway: string | null;
  key_ideas: string[];
  style_rules: string[];
  characters: BrainCharacter[];
  research_notes: string[];
  interview: InterviewAnswers;
  created_at: string;
  updated_at: string;
}

export type ChapterStatus = "planned" | "drafting" | "written";

export interface Chapter {
  id: string;
  book_id: string;
  user_id: string;
  order_index: number;
  title: string;
  goal: string | null;
  summary: string | null;
  key_points: string[];
  estimated_word_count: number;
  content: string;
  status: ChapterStatus;
  created_at: string;
  updated_at: string;
}

export interface PublishAssetRow {
  id: string;
  book_id: string;
  user_id: string;
  kind: PublishAssetKind;
  /** prose assets => { text: string }; list assets => { items: string[] } */
  content: { text?: string; items?: string[] };
  created_at: string;
  updated_at: string;
}

export interface AiGeneration {
  id: string;
  book_id: string | null;
  chapter_id: string | null;
  user_id: string;
  agent: AgentName;
  action: string | null;
  model: string | null;
  input: unknown;
  output: string | null;
  tokens: number;
  created_at: string;
}

/** Input when creating a new book. */
export interface NewBookInput {
  title: string;
  book_type: BookTypeValue;
  cover_emoji?: string;
}

/** A planned chapter as produced by the Book Planner agent. */
export interface ChapterPlan {
  title: string;
  goal: string;
  summary: string;
  key_points: string[];
  estimated_word_count: number;
}
