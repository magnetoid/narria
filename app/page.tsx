import Link from "next/link";
import { BookPlus, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SITE } from "@/lib/constants";

export default function DashboardPage() {
  return (
    <AppShell
      action={
        <Link href="/books/new" className={buttonVariants({ size: "sm" })}>
          <BookPlus className="size-4" />
          New book
        </Link>
      }
    >
      {/* Hero */}
      <section className="mx-auto max-w-2xl pb-12 pt-6 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
          <Sparkles className="size-3.5" />
          AI + human book studio
        </span>
        <h1 className="mt-5 text-balance font-serif text-4xl font-semibold leading-tight text-ink sm:text-5xl">
          {SITE.tagline}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-base text-ink-soft">
          Narria interviews you, builds your{" "}
          <span className="accent-italic">Book Brain</span>, shapes an outline,
          and helps you write — through guided steps, never a blank chat box.
        </p>
        <div className="mt-7 flex items-center justify-center gap-3">
          <Link href="/books/new" className={buttonVariants({ size: "lg" })}>
            <BookPlus className="size-5" />
            Create your first book
          </Link>
        </div>
      </section>

      {/* Library */}
      <section>
        <h2 className="mb-4 font-serif text-xl font-semibold text-ink">
          Your books
        </h2>
        <EmptyState
          icon={<BookPlus className="size-6" />}
          title="No books yet"
          description="Start with an idea, a memory, or a messy pile of notes — Narria will interview you and shape it into a real book."
          action={
            <Link href="/books/new" className={buttonVariants()}>
              Start a book
            </Link>
          }
        />
      </section>
    </AppShell>
  );
}
