import * as React from "react";
import { cn } from "@/lib/utils";

/** Consistent content container for book section pages. */
export function BookPage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-10", className)}>
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-xl text-pretty text-sm text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  );
}
