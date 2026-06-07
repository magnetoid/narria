import { BookPage, SectionHeader } from "@/components/layout/book-page";
import { EmptyState } from "@/components/ui/empty-state";
import { Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

// Replaced by the Publish Center in Phase 7.
export default function PublishPage() {
  return (
    <BookPage>
      <SectionHeader
        title="Publish"
        description="Generate your description, blurb, keywords, and export your manuscript."
      />
      <EmptyState
        icon={<Sparkles className="size-6" />}
        title="Publish Center"
        description="Once you've written some chapters, this is where Narria helps you package and export your book."
      />
    </BookPage>
  );
}
