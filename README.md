<div align="center">

# 📖 Narria

### From idea to published book.

An AI + human-assisted book-writing studio — not a chatbot. Narria turns an idea,
a memory, or a pile of notes into a structured, polished, publication-ready book
through **guided workflows**, never a blank prompt box.

</div>

---

## What it does

| Module | What it gives you |
|---|---|
| 🪄 **AI Interview** | A guided, one-question-at-a-time interview tailored to your book type. |
| 🧠 **Book Brain** | Your book's single source of truth — audience, tone, style, goals, key ideas, characters, rules. Every AI action honors it. |
| 🗂️ **Outline Generator** | A complete, editable table of contents — drag to reorder, add, remove, regenerate. |
| ✍️ **Chapter Workspace** | A focused 3-pane editor (chapters · manuscript · AI) with 11 guided actions including streaming *Continue writing*. |
| 🚀 **Publish Center** | Description, bio, subtitles, keywords, categories, back-cover & sales copy — plus **DOCX export**. |
| 🤖 **7 AI agents** | Book Planner, Chapter Writer, Editor, Critic, Research Assistant, Fact-Check, Metadata. |

The core principle: **every AI action is a named button**, and **every agent is fed
the Book Brain** so output stays in your voice.

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase (Postgres) · Anthropic
Claude (behind a swappable provider) · Tiptap · `docx`.

## Quickstart (zero setup)

```bash
pnpm install
pnpm dev      # → http://localhost:3000
```

It runs **with no Supabase and no API key** — data lives in an in-memory store and
AI runs on a deterministic mock provider. Add credentials to go live for real:

```bash
cp .env.example .env.local
# NEXT_PUBLIC_SUPABASE_URL / ANON / SERVICE_ROLE  → persist data (run supabase/migrations/0001_init.sql)
# ANTHROPIC_API_KEY                               → real Claude output
```

> Note: Turbopack **dev** can be slow/unstable in some environments. For a faithful
> production run, use the standalone build: `pnpm build && node .next/standalone/server.js`
> (copy `.next/static` + `public` into `.next/standalone/` first). Don't run `build`
> and `dev` at the same time.

## Architecture

```
app/                     # routes (dashboard, /books/[id]/{interview,brain,outline,chapters,publish}, /api/*)
components/              # ui primitives · layout · interview · brain · outline · editor · publish
lib/
  db/                   # Supabase client + repositories (+ in-memory fallback)
  ai/                   # AIProvider interface · mock & anthropic adapters · prompts · schemas · 7 agents
  actions/              # server actions (books, interview, brain, chapters, chapter-ai, outline, publish)
supabase/migrations/    # 0001_init.sql
```

- **Data** flows through repositories only (`lib/db/repositories/*`) — Supabase when
  configured, an in-memory store otherwise.
- **AI** flows through `lib/ai` — swap Anthropic for any OpenAI-compatible backend by
  adding one provider implementation. Per-agent models are env-overridable.

## Deploy

Dockerized (multi-stage standalone) for **Coolify**, targeting **narria.dotbooks.store**.
See **[DEPLOY.md](DEPLOY.md)** for the Docker Compose / Dockerfile recipe and Supabase setup.

```bash
docker compose up --build   # local production test → http://localhost:3000
```

## Scripts

```bash
pnpm dev      # dev server
pnpm build    # production build (standalone)
pnpm start    # serve the build
pnpm lint     # eslint
```
