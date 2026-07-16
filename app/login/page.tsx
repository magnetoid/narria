import { redirect } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import { LoginForm } from "@/components/auth/login-form";
import { isAuthConfigured } from "@/lib/auth/config";
import { SITE } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata = { title: `Sign in — ${SITE.name}` };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Unconfigured deployments have no accounts to sign in to — the demo workspace
  // is the whole app, so the login page must never stand in front of it.
  if (!isAuthConfigured()) redirect("/");

  const { error } = await searchParams;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <Logo href={null} />
          <h1 className="mt-6 text-balance font-serif text-3xl font-semibold leading-tight text-ink">
            {SITE.tagline}
          </h1>
          <p className="mt-2 text-pretty text-sm text-muted">
            Sign in to pick up your books where you left them.
          </p>
        </div>

        <div className="mt-8 rounded-xl border border-line bg-surface p-6 shadow-paper">
          <LoginForm initialError={error} />
        </div>
      </div>
    </main>
  );
}
