# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
pnpm dev                  # dev server → http://localhost:3000
pnpm build                # production build (output: "standalone")
pnpm start                # serve the build
pnpm lint                 # eslint
pnpm exec tsc --noEmit    # type-check (CI runs this; there is no `typecheck` script)
docker compose up --build # local production test → http://localhost:3000
```

CI (`.github/workflows/ci.yml`) runs lint → `tsc --noEmit` → build. There is no test suite.

Turbopack dev can be slow/unstable here. For a faithful production run, use the standalone
build: `pnpm build && node .next/standalone/server.js` (copy `.next/static` + `public` into
`.next/standalone/` first). Don't run `build` and `dev` at the same time.

## Zero-setup principle

The app boots and works end-to-end with **no Supabase and no API key**. This is load-bearing —
the production build must never require secrets, and CI builds with neither. Two fallbacks make it true:

- **No Supabase** → repositories fall back to `lib/db/memory-store.ts` (process-local, resets on restart).
- **No `ANTHROPIC_API_KEY`** → `getProvider()` returns `MockProvider`, which produces deterministic,
  schema-valid output.

Any new feature must keep working in both configurations.

## Architecture

Two seams carry the design; go through them rather than around them.

### AI (`lib/ai/`)

Everything funnels through the `ai` facade in [lib/ai/index.ts](lib/ai/index.ts) — `ai.text()`,
`ai.structured()`, `ai.stream()`. The facade resolves the model, picks the provider, and writes the
generation audit log. Never call the Anthropic SDK directly from an agent or action.

- [lib/ai/provider.ts](lib/ai/provider.ts) — the `AIProvider` interface; add one implementation to swap backends.
- [lib/ai/providers/](lib/ai/providers/) — `anthropic.ts` (real) and `mock.ts` (deterministic).
- [lib/ai/prompts.ts](lib/ai/prompts.ts) — all prompt construction; every system prompt embeds `brainContext()`.
- [lib/ai/agents/](lib/ai/agents/) — the 7 agents (`bookPlanner`, `chapterWriter`, `editor`, `critic`,
  `researchAssistant`, `factCheck`, `metadata`). Thin: build prompt → call `ai.*`.
- [lib/ai/schemas.ts](lib/ai/schemas.ts) — Zod schemas for structured output.

**`meta.input` is not optional.** The mock provider has no model — it builds its response by reading
`meta.input` (`book`, `brain`, `chapter`, `qa`, …) and `meta.kind`. If you add an AI call and omit
`meta.input`, the real provider works and the mock silently degrades to generic filler. Add the
corresponding builder branch in `mock.ts` alongside any new `kind`.

Model selection is per-agent and env-overridable via `modelFor()`: `NARRIA_MODEL_WRITER`
(chapterWriter), `NARRIA_MODEL_METADATA` (metadata), `NARRIA_MODEL_DEFAULT` (everything else).

### Data (`lib/db/`)

UI and actions touch **repositories only** ([lib/db/repositories/](lib/db/repositories/)) — never
`getDb()` directly. Each repository function checks `getDb()` and delegates to the `mem*` equivalent
when it returns null. Adding a repository function means adding both halves.

- `getDb()` returns null when unconfigured; `requireDb()` throws a user-facing message — use it only
  for mutations that genuinely cannot degrade.
- The Supabase client uses the **service role key and bypasses RLS**. There is no auth yet: every row
  carries `DEV_USER_ID` (`lib/constants.ts`), a single implicit workspace user.
- Schema lives in [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql); run it by
  hand in the SQL editor. Row shapes are mirrored in [lib/db/types.ts](lib/db/types.ts) — keep the two
  in sync manually (no codegen).
- The memory store backs its maps on `globalThis` because Next production builds can hand each route
  its own module instance, which would otherwise split state across pages, actions, and API routes.

### `lib/constants.ts` is the product spec

`BOOK_TYPES`, `CHAPTER_AI_ACTIONS`, `PUBLISH_ASSETS`, and `BOOK_NAV` are data, and the UI renders
from them. Adding a chapter AI action or publish asset is mostly a constants edit plus a prompt
branch — not new components. `BookType.fiction` is the switch that toggles characters/world and the
narrative slant of the interview and prompts.

### Server actions vs. API routes

Server actions ([lib/actions/](lib/actions/)) handle everything **except streaming**. Streaming
`Continue writing` goes through [app/api/ai/continue/route.ts](app/api/ai/continue/route.ts)
(`runtime = "nodejs"`, `dynamic = "force-dynamic"`), which returns a plain-text `ReadableStream`.
DOCX export is [app/api/export/[bookId]/route.ts](app/api/export/[bookId]/route.ts).

Server-only modules (`lib/ai/index.ts`, `lib/db/client.ts`, agents, repositories) import
`"server-only"` — preserve that when adding files there.

## Conventions

- Package manager is **pnpm** (`packageManager` is pinned). Native builds must be listed under
  `pnpm.onlyBuiltDependencies` or the Docker build breaks.
- Tailwind v4 (PostCSS plugin, no `tailwind.config`); tokens live in [app/globals.css](app/globals.css).
- Icons are named by string in constants (`icon: "PenLine"`) and mapped to lucide-react in
  [components/icon.tsx](components/icon.tsx).
- Comments in this codebase explain *why* (the constraint), not *what*. Match that.
