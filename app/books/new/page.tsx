"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { BOOK_TYPES, type BookTypeValue } from "@/lib/constants";
import { createBookAction } from "@/lib/actions/books";
import { cn } from "@/lib/utils";

export default function NewBookPage() {
  const [type, setType] = useState<BookTypeValue | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = BOOK_TYPES.find((t) => t.value === type);

  function submit() {
    if (!type) return;
    setError(null);
    startTransition(async () => {
      const res = await createBookAction({
        title,
        book_type: type,
        cover_emoji: selected?.emoji,
      });
      if (res?.error) setError(res.error);
    });
  }

  return (
    <AppShell
      action={
        <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft className="size-4" />
          Back
        </Link>
      }
    >
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <h1 className="font-serif text-3xl font-semibold text-ink">
            What are you writing?
          </h1>
          <p className="mt-2 text-pretty text-sm text-muted">
            Pick a type and Narria tailors the interview, tone, and structure to it.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {BOOK_TYPES.map((t) => {
            const active = type === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={cn(
                  "relative rounded-xl border bg-surface p-4 text-left shadow-paper transition-all",
                  active
                    ? "border-accent ring-2 ring-accent/30"
                    : "border-line hover:border-line-strong hover:-translate-y-0.5",
                )}
              >
                {active && (
                  <span className="absolute right-3 top-3 grid size-5 place-items-center rounded-full bg-accent text-white">
                    <Check className="size-3" />
                  </span>
                )}
                <div className="text-2xl">{t.emoji}</div>
                <div className="mt-2 font-serif text-base font-semibold text-ink">
                  {t.label}
                </div>
                <p className="mt-0.5 text-xs leading-snug text-muted">{t.blurb}</p>
              </button>
            );
          })}
        </div>

        {/* Title */}
        <div
          className={cn(
            "mt-8 transition-opacity",
            type ? "opacity-100" : "pointer-events-none opacity-40",
          )}
        >
          <Label htmlFor="title">Working title</Label>
          <p className="mb-2 text-xs text-muted">You can change this anytime.</p>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={selected ? `My ${selected.label.toLowerCase()}` : "Untitled"}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end">
          <Button size="lg" disabled={!type || pending} onClick={submit}>
            {pending ? <Spinner /> : null}
            Start the interview
            {!pending && <ArrowRight className="size-4" />}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
