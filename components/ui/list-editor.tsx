"use client";

import { Plus, X } from "lucide-react";
import { Input } from "./input";
import { Button } from "./button";

export function ListEditor({
  items,
  onChange,
  placeholder,
  addLabel = "Add",
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  addLabel?: string;
}) {
  function update(i: number, val: string) {
    const next = [...items];
    next[i] = val;
    onChange(next);
  }
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={item}
            onChange={(e) => update(i, e.target.value)}
            placeholder={placeholder}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            aria-label="Remove"
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange([...items, ""])}>
        <Plus className="size-4" />
        {addLabel}
      </Button>
    </div>
  );
}
