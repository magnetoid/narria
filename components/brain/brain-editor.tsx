"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Plus, RefreshCw, X, ArrowRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListEditor } from "@/components/ui/list-editor";
import { Spinner } from "@/components/ui/spinner";
import { BookPage, SectionHeader } from "@/components/layout/book-page";
import { saveBrain, regenerateBrain } from "@/lib/actions/brain";
import { getBookType } from "@/lib/constants";
import type { Book, BookBrain, BrainCharacter } from "@/lib/db/types";

interface Draft {
  audience: string;
  tone: string;
  writing_style: string;
  author_background: string;
  author_goals: string;
  reader_takeaway: string;
  key_ideas: string[];
  style_rules: string[];
  characters: BrainCharacter[];
  research_notes: string[];
}

type SaveStatus = "idle" | "dirty" | "saving" | "saved";

function Field({
  label,
  value,
  onChange,
  placeholder,
  rows = 2,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ink-soft">{label}</label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="min-h-0"
      />
    </div>
  );
}

export function BrainEditor({ book, brain }: { book: Book; brain: BookBrain }) {
  const router = useRouter();
  const fiction = getBookType(book.book_type).fiction;

  const [draft, setDraft] = useState<Draft>(() => ({
    audience: brain.audience ?? "",
    tone: brain.tone ?? "",
    writing_style: brain.writing_style ?? "",
    author_background: brain.author_background ?? "",
    author_goals: brain.author_goals ?? "",
    reader_takeaway: brain.reader_takeaway ?? "",
    key_ideas: brain.key_ideas ?? [],
    style_rules: brain.style_rules ?? [],
    characters: brain.characters ?? [],
    research_notes: brain.research_notes ?? [],
  }));
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [regenerating, startRegen] = useTransition();

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFirst = useRef(true);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    setStatus("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setStatus("saving");
      const res = await saveBrain(book.id, draft);
      setStatus("error" in res ? "dirty" : "saved");
    }, 1100);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [draft, book.id]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function regenerate() {
    startRegen(async () => {
      await regenerateBrain(book.id);
      router.refresh();
    });
  }

  return (
    <BookPage>
      <SectionHeader
        title="Book Brain"
        description="The single source of truth for your book. Every AI action honors what's here — edit anything."
        action={
          <>
            <span className="mr-1 inline-flex items-center gap-1.5 text-xs text-muted">
              {status === "saving" && (
                <>
                  <Spinner className="size-3.5" /> Saving…
                </>
              )}
              {status === "saved" && (
                <>
                  <Check className="size-3.5 text-sage" /> Saved
                </>
              )}
            </span>
            <Button variant="secondary" size="sm" onClick={regenerate} disabled={regenerating}>
              {regenerating ? <Spinner /> : <RefreshCw className="size-4" />}
              Re-synthesize
            </Button>
          </>
        }
      />

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Voice &amp; audience</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Audience" value={draft.audience} onChange={(v) => set("audience", v)} placeholder="Who is this book for?" />
            <Field label="Tone" value={draft.tone} onChange={(v) => set("tone", v)} placeholder="The feeling of the prose." />
            <Field label="Writing style" value={draft.writing_style} onChange={(v) => set("writing_style", v)} placeholder="How it reads on the page." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Author &amp; goals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Author background" value={draft.author_background} onChange={(v) => set("author_background", v)} placeholder="Why you, and what you bring." />
            <Field label="Author goals" value={draft.author_goals} onChange={(v) => set("author_goals", v)} placeholder="What you want this book to do." />
            <Field label="What the reader should feel or learn" value={draft.reader_takeaway} onChange={(v) => set("reader_takeaway", v)} placeholder="The lasting takeaway." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Key ideas</CardTitle>
          </CardHeader>
          <CardContent>
            <ListEditor items={draft.key_ideas} onChange={(v) => set("key_ideas", v)} placeholder="A core idea or theme" addLabel="Add idea" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Style rules</CardTitle>
          </CardHeader>
          <CardContent>
            <ListEditor items={draft.style_rules} onChange={(v) => set("style_rules", v)} placeholder="A rule the writing should follow" addLabel="Add rule" />
          </CardContent>
        </Card>

        {(fiction || draft.characters.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle>Characters</CardTitle>
            </CardHeader>
            <CardContent>
              <CharacterEditor
                characters={draft.characters}
                onChange={(v) => set("characters", v)}
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Research notes</CardTitle>
          </CardHeader>
          <CardContent>
            <ListEditor items={draft.research_notes} onChange={(v) => set("research_notes", v)} placeholder="Something to remember or verify" addLabel="Add note" />
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 flex justify-end">
        <Link href={`/books/${book.id}/outline`} className={buttonVariants({ size: "lg" })}>
          Continue to outline
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </BookPage>
  );
}

function CharacterEditor({
  characters,
  onChange,
}: {
  characters: BrainCharacter[];
  onChange: (c: BrainCharacter[]) => void;
}) {
  function update(i: number, patch: Partial<BrainCharacter>) {
    const next = characters.map((c, idx) => (idx === i ? { ...c, ...patch } : c));
    onChange(next);
  }
  return (
    <div className="space-y-3">
      {characters.map((c, i) => (
        <div key={i} className="rounded-lg border border-line bg-paper/50 p-3">
          <div className="flex items-center gap-2">
            <Input
              value={c.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="Name"
              className="font-medium"
            />
            <Input
              value={c.role}
              onChange={(e) => update(i, { role: e.target.value })}
              placeholder="Role"
              className="max-w-[40%]"
            />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onChange(characters.filter((_, idx) => idx !== i))}
              aria-label="Remove character"
            >
              <X className="size-4" />
            </Button>
          </div>
          <Textarea
            value={c.description}
            onChange={(e) => update(i, { description: e.target.value })}
            placeholder="Who they are, what they want, what stands in their way."
            rows={2}
            className="mt-2 min-h-0"
          />
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange([...characters, { name: "", role: "", description: "" }])}
      >
        <Plus className="size-4" />
        Add character
      </Button>
    </div>
  );
}
