import { getBookType, type BookTypeValue } from "@/lib/constants";

export interface InterviewQuestion {
  id: string;
  question: string;
  placeholder: string;
}

/** The guided interview, adapted to fiction vs non-fiction. Question ids are
 *  stable so saved answers persist and the Book Planner can map them. */
export function interviewQuestions(bookType: BookTypeValue): InterviewQuestion[] {
  const fiction = getBookType(bookType).fiction;

  if (fiction) {
    return [
      { id: "about", question: "What is your story about?", placeholder: "The premise, the world, the central conflict — the spark of it, in your own words." },
      { id: "characters", question: "Who are the main characters?", placeholder: "Names, roles, what they want, and what stands in their way." },
      { id: "audience", question: "Who is this story for?", placeholder: "Your ideal reader — who they are and what they love to read." },
      { id: "takeaway", question: "What should the reader feel?", placeholder: "The emotional experience you want to leave them with." },
      { id: "tone", question: "What's the tone and mood?", placeholder: "Dark? Whimsical? Tense? Tender? A few words is plenty." },
      { id: "background", question: "What draws you to this story?", placeholder: "Why you, why now — what makes this yours to tell." },
      { id: "materials", question: "Any scenes, settings, or details to include?", placeholder: "Moments you can already picture, places, objects, lines of dialogue." },
    ];
  }

  return [
    { id: "about", question: "What is your book about?", placeholder: "The big idea, in your own words. What's the heart of it?" },
    { id: "audience", question: "Who is this book for?", placeholder: "Your ideal reader — who they are and what they're struggling with." },
    { id: "takeaway", question: "What should the reader feel or learn?", placeholder: "By the last page, what should change for them?" },
    { id: "tone", question: "What tone should the book have?", placeholder: "Warm? Authoritative? Playful? Honest? A few words is fine." },
    { id: "background", question: "What's your background with this?", placeholder: "Why you? What experience or perspective do you bring?" },
    { id: "materials", question: "What should we be sure to include?", placeholder: "Stories, examples, research, memories, quotes, frameworks…" },
  ];
}
