import * as React from "react";
import { Logo } from "./logo";
import { cn } from "@/lib/utils";

export function SiteHeader({
  action,
  className,
}: {
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b border-line/70 bg-paper/85 backdrop-blur-md",
        className,
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
        <Logo />
        {action ? <div className="flex items-center gap-2">{action}</div> : null}
      </div>
    </header>
  );
}
