import { z } from "zod";
import { BOOK_TYPES, CHAPTER_AI_ACTIONS, PUBLISH_ASSETS } from "@/lib/constants";

/**
 * Abuse-prevention for server actions and API bodies — not UX validation.
 * Shapes stay permissive (optional fields, loose enums); the point is to cap
 * lengths and reject malformed ids/enums before they reach the DB or an AI call.
 */

const bookTypeValues = BOOK_TYPES.map((t) => t.value);
const publishAssetKinds = PUBLISH_ASSETS.map((a) => a.kind);
const transformActionIds = CHAPTER_AI_ACTIONS.filter((a) => a.group === "transform").map((a) => a.id);
const reviewActionIds = CHAPTER_AI_ACTIONS.filter((a) => a.group === "review").map((a) => a.id);

// Memory-store ids look like "mem_1a2b3c"; Supabase ids are UUIDs — accept either shape.
export const idSchema = z.string().trim().min(1).max(200);

// Sign-in inputs. Normalise before validating (z.email() would otherwise reject a
// padded address); 254 is the practical maximum length of an email address.
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
export const oauthProviderSchema = z.enum(["google", "github"]);

const shortText = (max: number) => z.string().max(max);
const nullableShortText = (max: number) => z.string().max(max).nullable();
const bigText = z.string().max(60_000);

export const createBookInput = z.object({
  title: shortText(200).optional(),
  book_type: z.enum(bookTypeValues as [string, ...string[]]),
  cover_emoji: shortText(16).optional(),
});

export const updateBookPatch = z
  .object({
    title: shortText(200),
    subtitle: shortText(300),
    status: z.enum(["draft", "outlining", "writing", "publishing"]),
    cover_emoji: shortText(16),
  })
  .partial();

export const chapterPatch = z
  .object({
    title: shortText(200),
    goal: nullableShortText(2000),
    summary: nullableShortText(4000),
    key_points: z.array(shortText(500)).max(50),
    estimated_word_count: z.number().int().min(0).max(1_000_000),
    content: bigText,
    status: z.enum(["planned", "drafting", "written"]),
  })
  .partial();

const brainCharacter = z.object({
  name: shortText(200),
  role: shortText(200),
  description: shortText(2000),
});

export const brainPatch = z
  .object({
    audience: nullableShortText(2000),
    tone: nullableShortText(2000),
    writing_style: nullableShortText(2000),
    author_background: nullableShortText(2000),
    author_goals: nullableShortText(2000),
    reader_takeaway: nullableShortText(2000),
    key_ideas: z.array(shortText(500)).max(100),
    style_rules: z.array(shortText(500)).max(100),
    characters: z.array(brainCharacter).max(100),
    research_notes: z.array(shortText(1000)).max(200),
    interview: z.record(z.string().max(200), shortText(20_000)),
  })
  .partial();

export const assetContent = z.object({
  text: shortText(20_000).optional(),
  items: z.array(shortText(1000)).max(200).optional(),
});

export const interviewEntries = z
  .array(
    z.object({
      id: idSchema,
      question: shortText(500),
      answer: shortText(20_000),
    }),
  )
  .max(50);

export const continueBody = z.object({
  bookId: idSchema,
  chapterId: idSchema,
  currentText: bigText,
});

export const chapterEditInput = z.object({
  actionId: z.enum(transformActionIds as [string, ...string[]]),
  bookId: idSchema,
  chapterId: idSchema,
  selection: bigText,
});

export const chapterReviewInput = z.object({
  actionId: z.enum(reviewActionIds as [string, ...string[]]),
  bookId: idSchema,
  chapterId: idSchema,
  content: bigText,
});

export const publishAssetKind = z.enum(publishAssetKinds as [string, ...string[]]);

export const reorderChaptersInput = z.array(idSchema).max(1000);
