# Deploying Narria (Coolify + Docker + Supabase)

Narria ships as a single Dockerized Next.js app. Target deployment: **Coolify**, domain
**https://narria.dotbooks.store**, data on **Supabase**.

> The app runs fully on the built-in **mock AI provider** with no API key, so it boots and
> is demoable even before Supabase/Anthropic are wired. Add credentials to go live for real.

---

## 1. DNS

Point the domain at your Coolify server:

```
narria.dotbooks.store   A      <coolify-server-ip>
# or CNAME to the server hostname
```

## 2. Supabase (pick one)

**Option A — self-hosted on Coolify (everything in Docker, recommended):**
1. Coolify → **+ New** → **Service** → **Supabase**. Deploy it.
2. From the service's env, copy: API URL, `anon` key, `service_role` key.

**Option B — Supabase Cloud:** create a project at supabase.com and copy the same three
values from **Project Settings → API**.

> The app uses `@supabase/supabase-js`, which needs the full Supabase stack
> (PostgREST/GoTrue), not a bare Postgres — so use a real Supabase instance (A or B).

### Run the schema
Open the Supabase **SQL Editor** (or Studio for self-hosted) and run
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).

## 3. Deploy the app on Coolify

1. Coolify → **+ New** → **Application** → **Public/Private Repository** →
   `https://github.com/magnetoid/narria`.
2. **Build Pack: Dockerfile** (the repo's `Dockerfile`). Port **3000**.
3. **Domain:** `https://narria.dotbooks.store` — Coolify provisions Let's Encrypt SSL.
4. **Health check path:** `/api/health`.
5. **Environment variables** (from [`.env.example`](.env.example)):
   - `NEXT_PUBLIC_SITE_URL=https://narria.dotbooks.store`
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY` (optional — omit to stay on the mock provider)
   - Optional model overrides: `NARRIA_MODEL_DEFAULT`, `NARRIA_MODEL_WRITER`, `NARRIA_MODEL_METADATA`
6. **Deploy.** Coolify builds the image and serves it behind its proxy with SSL.

Auto-deploy: enable Coolify's GitHub webhook so pushes to `main` redeploy.

---

## Local production test

```bash
cp .env.example .env.local   # fill in (or leave AI blank for mock)
docker compose up --build    # → http://localhost:3000
```

## Notes
- The image is a multi-stage build using Next.js `output: "standalone"` (small runtime image, non-root user).
- No secrets are needed at build time; all credentials are read at runtime.
- `/api/health` returns `{ "status": "ok" }` for liveness checks.
