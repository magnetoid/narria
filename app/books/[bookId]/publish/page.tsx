import { notFound } from "next/navigation";
import { FileDown } from "lucide-react";
import { getBook } from "@/lib/db/repositories/books";
import { listChapters } from "@/lib/db/repositories/chapters";
import { listAssets } from "@/lib/db/repositories/publish";
import { BookPage, SectionHeader } from "@/components/layout/book-page";
import { PublishCenter } from "@/components/publish/publish-center";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PublishAssetKind } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function PublishPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const book = await getBook(bookId);
  if (!book) notFound();

  const [chapters, assets] = await Promise.all([
    listChapters(bookId),
    listAssets(bookId),
  ]);

  const initialAssets = Object.fromEntries(
    assets.map((a) => [a.kind, a.content]),
  ) as Partial<Record<PublishAssetKind, { text?: string; items?: string[] }>>;

  const hasChapters = chapters.length > 0;

  return (
    <BookPage>
      <SectionHeader
        title="Publish"
        description="Generate your description, blurb, keywords and more — then export your manuscript."
        action={
          <div className="flex items-center gap-2">
            <a
              href={`/api/export/${book.id}`}
              className={cn(
                buttonVariants({ size: "sm" }),
                !hasChapters && "pointer-events-none opacity-50",
              )}
              aria-disabled={!hasChapters}
            >
              <FileDown className="size-4" />
              Export DOCX
            </a>
            <Button variant="outline" size="sm" disabled title="Coming soon">
              PDF
            </Button>
          </div>
        }
      />

      {!hasChapters && (
        <p className="mb-5 rounded-lg bg-gold-soft px-3 py-2 text-sm text-gold">
          Write a few chapters to enable manuscript export — but you can still
          generate your publishing copy below.
        </p>
      )}

      <PublishCenter bookId={book.id} initialAssets={initialAssets} />
    </BookPage>
  );
}
