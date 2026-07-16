"use client";

import { useState, useTransition } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { signOut } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

/** Plain props only — the server wrapper (user-menu-slot) resolves the session. */
export function UserMenu({
  email,
  isDemo,
  className,
}: {
  email: string | null;
  isDemo: boolean;
  className?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (isDemo) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted",
          className,
        )}
        title="Add Supabase credentials to keep your books between restarts."
      >
        <span className="size-1.5 rounded-full bg-sage" />
        Demo workspace — data resets on restart
      </span>
    );
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      // Resolves only on failure — success redirects to /login.
      const res = await signOut();
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {email && (
        <span className="max-w-[12rem] truncate text-xs text-muted" title={email}>
          {email}
        </span>
      )}
      <Button variant="ghost" size="sm" disabled={pending} onClick={submit}>
        {pending ? <Spinner /> : <LogOut className="size-4" />}
        Sign out
      </Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
