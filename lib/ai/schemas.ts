import { z } from "zod";

export const ChapterPlanSchema = z.object({
  title: z.string(),
  goal: z.string(),
  summary: z.string(),
  key_points: z.array(z.string()),
  estimated_word_count: z.number().int(),
});

export const OutlineSchema = z.object({
  chapters: z.array(ChapterPlanSchema),
});
export type Outline = z.infer<typeof OutlineSchema>;

export const BrainSynthesisSchema = z.object({
  audience: z.string(),
  tone: z.string(),
  writing_style: z.string(),
  author_background: z.string(),
  author_goals: z.string(),
  reader_takeaway: z.string(),
  key_ideas: z.array(z.string()),
  style_rules: z.array(z.string()),
  characters: z.array(
    z.object({
      name: z.string(),
      role: z.string(),
      description: z.string(),
    }),
  ),
});
export type BrainSynthesis = z.infer<typeof BrainSynthesisSchema>;

/** Single block of prose (descriptions, bios, back cover, sales copy). */
export const ProseSchema = z.object({ text: z.string() });
export type Prose = z.infer<typeof ProseSchema>;

/** A list of short strings (subtitles, keywords, categories). */
export const ListSchema = z.object({ items: z.array(z.string()) });
export type ListOutput = z.infer<typeof ListSchema>;
