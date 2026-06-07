import * as React from "react";
import { SiteHeader } from "./site-header";
import { cn } from "@/lib/utils";

/** Top-level shell for dashboard-style pages (header + centered content). */
export function AppShell({
  action,
  children,
  className,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader action={action} />
      <main className={cn("mx-auto w-full max-w-6xl flex-1 px-5 py-10", className)}>
        {children}
      </main>
    </div>
  );
}
