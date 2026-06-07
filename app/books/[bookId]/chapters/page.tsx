import { BookPage, SectionHeader } from "@/components/layout/book-page";
import { EmptyState } from "@/components/ui/empty-state";
import { BookOpen } from "lucide-react";

export const dynamic = "force-dynamic";

// Replaced by the Chapter Workspace in Phase 6.
export default function ChaptersPage() {
  return (
    <BookPage>
      <SectionHeader
        title="Chapters"
        description="Write your manuscript with AI assistance, chapter by chapter."
      />
      <EmptyState
        icon={<BookOpen className="size-6" />}
        title="Chapter workspace"
        description="Build your outline first — your chapters will appear here, ready to write in a focused editor with guided AI actions."
      />
    </BookPage>
  );
}
