"use client";

import { useEffect, useRef, useState } from "react";
import { Check, RefreshCw, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ListEditor } from "@/components/ui/list-editor";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "@/components/icon";
import {
  PUBLISH_ASSETS,
  type PublishAsset,
  type PublishAssetKind,
} from "@/lib/constants";
import { generateAssetAction, saveAssetAction } from "@/lib/actions/publish";

type Content = { text?: string; items?: string[] };

export function PublishCenter({
  bookId,
  initialAssets,
}: {
  bookId: string;
  initialAssets: Partial<Record<PublishAssetKind, Content>>;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {PUBLISH_ASSETS.map((asset) => (
        <AssetCard
          key={asset.kind}
          bookId={bookId}
          asset={asset}
          initial={initialAssets[asset.kind]}
        />
      ))}
    </div>
  );
}

function AssetCard({
  bookId,
  asset,
  initial,
}: {
  bookId: string;
  asset: PublishAsset;
  initial?: Content;
}) {
  const [content, setContent] = useState<Content | null>(initial ?? null);
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function generate() {
    setError(null);
    setGenerating(true);
    const res = await generateAssetAction(bookId, asset.kind);
    setGenerating(false);
    if ("error" in res) setError(res.error);
    else setContent(res.content);
  }

  function update(next: Content) {
    setContent(next);
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await saveAssetAction(bookId, asset.kind, next);
      setStatus("error" in res ? "idle" : "saved");
    }, 1000);
  }

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const isEmpty =
    !content || (!content.text && (!content.items || content.items.length === 0));

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-2 p-5 pb-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
            <Icon name={asset.icon} className="size-4" />
          </span>
          <div>
            <h3 className="font-serif text-base font-semibold text-ink">
              {asset.label}
            </h3>
            <p className="text-xs text-muted">{asset.hint}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {status === "saved" && <Check className="size-3.5 text-sage" />}
          {!isEmpty && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={generate}
              disabled={generating}
              aria-label="Regenerate"
              title="Regenerate"
            >
              {generating ? <Spinner /> : <RefreshCw className="size-4" />}
            </Button>
          )}
        </div>
      </div>

      <CardContent className="flex-1">
        {isEmpty ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-line py-6 pl-4">
            <p className="text-sm text-muted">Not generated yet.</p>
            <Button size="sm" onClick={generate} disabled={generating}>
              {generating ? <Spinner /> : <Sparkles className="size-4" />}
              Generate
            </Button>
          </div>
        ) : asset.shape === "list" ? (
          <ListEditor
            items={content?.items ?? []}
            onChange={(items) => update({ items })}
            placeholder="Item"
            addLabel="Add"
          />
        ) : (
          <Textarea
            value={content?.text ?? ""}
            onChange={(e) => update({ text: e.target.value })}
            rows={6}
            className="text-sm"
          />
        )}
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </CardContent>
    </Card>
  );
}
