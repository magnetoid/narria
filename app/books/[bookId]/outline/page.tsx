import { BookPage, SectionHeader } from "@/components/layout/book-page";
import { EmptyState } from "@/components/ui/empty-state";
import { ListTree } from "lucide-react";

export const dynamic = "force-dynamic";

// Replaced by the full Outline Generator in Phase 5.
export default function OutlinePage() {
  return (
    <BookPage>
      <SectionHeader
        title="Outline"
        description="Generate a table of contents, then edit, add, remove, and reorder chapters."
      />
      <EmptyState
        icon={<ListTree className="size-6" />}
        title="Outline generator"
        description="This section comes online next — it turns your Book Brain into a complete, editable table of contents."
      />
    </BookPage>
  );
}
