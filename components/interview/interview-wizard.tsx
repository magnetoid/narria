"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  finishInterview,
  saveInterview,
  type InterviewEntry,
} from "@/lib/actions/interview";
import type { InterviewQuestion } from "@/lib/interview";
import { cn } from "@/lib/utils";

export function InterviewWizard({
  bookId,
  bookTitle,
  questions,
  initialAnswers,
}: {
  bookId: string;
  bookTitle: string;
  questions: InterviewQuestion[];
  initialAnswers: Record<string, string>;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const q of questions) seed[q.id] = initialAnswers[q.id] ?? "";
    return seed;
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const total = questions.length;
  const q = questions[step];
  const isLast = step === total - 1;

  const entries = useMemo<() => InterviewEntry[]>(
    () => () =>
      questions.map((x) => ({
        id: x.id,
        question: x.question,
        answer: answers[x.id] ?? "",
      })),
    [questions, answers],
  );

  function goNext() {
    void saveInterview(bookId, entries());
    if (!isLast) setStep((s) => s + 1);
  }

  function finish() {
    setError(null);
    startTransition(async () => {
      const res = await finishInterview(bookId, entries());
      if (res?.error) setError(res.error);
    });
  }

  if (pending) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 py-16">
        <div className="text-center">
          <div className="mx-auto mb-5 grid size-14 animate-pulse place-items-center rounded-full bg-accent-soft text-accent">
            <Sparkles className="size-6" />
          </div>
          <h2 className="font-serif text-2xl text-ink">Shaping your Book Brain…</h2>
          <p className="mt-2 text-sm text-muted">
            Reading your answers and turning them into structure.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-6 py-10 sm:py-16">
      {/* Progress */}
      <div className="mb-10">
        <div className="mb-3 flex items-center justify-between text-xs text-muted">
          <span className="inline-flex items-center gap-1.5 font-medium text-accent">
            <Sparkles className="size-3.5" />
            Interview
          </span>
          <span>
            {step + 1} of {total}
          </span>
        </div>
        <div className="flex gap-1.5">
          {questions.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i <= step ? "bg-accent" : "bg-line",
              )}
            />
          ))}
        </div>
      </div>

      {/* Question */}
      <div className="flex-1">
        <p className="mb-1 text-sm text-muted">{bookTitle}</p>
        <h1 className="text-balance font-serif text-3xl font-semibold leading-tight text-ink">
          {q.question}
        </h1>
        <Textarea
          autoFocus
          value={answers[q.id] ?? ""}
          onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
          placeholder={q.placeholder}
          className="mt-6 min-h-40 text-base"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              if (isLast) finish();
              else goNext();
            }
          }}
        />
        <p className="mt-2 text-xs text-muted">
          Answer in your own words — even a few honest sentences is plenty. You can
          skip and refine later.
        </p>
        {error && (
          <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
      </div>

      {/* Nav */}
      <div className="mt-10 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        {isLast ? (
          <Button onClick={finish}>
            <Sparkles className="size-4" />
            Build my Book Brain
          </Button>
        ) : (
          <Button onClick={goNext}>
            Next
            <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
