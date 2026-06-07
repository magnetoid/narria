import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { buttonVariants } from "@/components/ui/button";
import { BOOK_TYPES } from "@/lib/constants";

// Phase 1 placeholder. The guided create flow (naming + AI interview) is wired
// in Phase 3, where these cards become an interactive picker backed by a server action.
export default function NewBookPage() {
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
          {BOOK_TYPES.map((type) => (
            <div
              key={type.value}
              className="rounded-xl border border-line bg-surface p-4 shadow-paper transition-colors hover:border-accent"
            >
              <div className="text-2xl">{type.emoji}</div>
              <div className="mt-2 font-serif text-base font-semibold text-ink">
                {type.label}
              </div>
              <p className="mt-0.5 text-xs leading-snug text-muted">
                {type.blurb}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-muted">
          Guided setup connects in the next step.
        </p>
      </div>
    </AppShell>
  );
}
