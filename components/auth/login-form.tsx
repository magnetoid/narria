"use client";

import { useState, useTransition } from "react";
import { Mail, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { signInWithMagicLink, signInWithOAuth } from "@/lib/auth/actions";

const PROVIDERS = [
  { id: "google", label: "Continue with Google" },
  { id: "github", label: "Continue with GitHub" },
] as const;

export function LoginForm({ initialError }: { initialError?: string }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [pending, startTransition] = useTransition();

  function sendLink() {
    if (!email.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await signInWithMagicLink(email);
      if ("error" in res) setError(res.error);
      else setSent(true);
    });
  }

  function oauth(provider: (typeof PROVIDERS)[number]["id"]) {
    setError(null);
    startTransition(async () => {
      // Resolves only on failure — success redirects to the provider.
      const res = await signInWithOAuth(provider);
      if (res?.error) setError(res.error);
    });
  }

  if (sent) {
    return (
      <div className="text-center">
        <span className="mx-auto grid size-11 place-items-center rounded-full bg-sage/10 text-sage">
          <Check className="size-5" />
        </span>
        <h2 className="mt-4 font-serif text-xl font-semibold text-ink">
          Check your email
        </h2>
        <p className="mt-2 text-pretty text-sm text-muted">
          We sent a sign-in link to <span className="text-ink">{email}</span>. It
          opens Narria right where you left off.
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-4"
          onClick={() => setSent(false)}
        >
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-2">
        {PROVIDERS.map((p) => (
          <Button
            key={p.id}
            variant="secondary"
            className="w-full"
            disabled={pending}
            onClick={() => oauth(p.id)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs text-muted">or</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <Label htmlFor="email">Email</Label>
      <p className="mb-2 text-xs text-muted">
        We&rsquo;ll send a link — no password to remember.
      </p>
      <Input
        id="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        onKeyDown={(e) => e.key === "Enter" && sendLink()}
      />

      {error && (
        <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <Button
        className="mt-4 w-full"
        disabled={pending || !email.trim()}
        onClick={sendLink}
      >
        {pending ? <Spinner /> : <Mail className="size-4" />}
        Send sign-in link
      </Button>
    </div>
  );
}
