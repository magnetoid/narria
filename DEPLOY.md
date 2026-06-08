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

### Option A — Docker Compose (recommended)

1. Coolify → **+ New** → **Docker Compose** → **Public/Private Repository** →
   `https://github.com/magnetoid/narria`. Compose path: `docker-compose.yml`.
2. The compose builds the `web` service from the repo `Dockerfile`. Routing + SSL
   are driven by the `SERVICE_FQDN_WEB_3000` magic variable already set to
   `https://narria.dotbooks.store` — edit it in the compose or override the domain
   in the Coolify UI.
3. Set these **environment variables** in the Coolify UI (injected at runtime — no
   rebuild needed; from [`.env.example`](.env.example)):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY` (optional — omit to stay on the mock provider)
   - Optional: `NARRIA_MODEL_DEFAULT`, `NARRIA_MODEL_WRITER`, `NARRIA_MODEL_METADATA`
4. **Deploy.** Coolify builds the image, wires the proxy, and provisions Let's Encrypt SSL.
   Health check path `/api/health` is built into the compose.

### Option B — Dockerfile build pack

Coolify → **+ New** → **Application** → the repo → **Build Pack: Dockerfile**, port
**3000**, domain `https://narria.dotbooks.store`, health path `/api/health`, and the
same env vars as above.

Auto-deploy (either option): enable Coolify's GitHub webhook so pushes to `main` redeploy.

---

## Local production test

```bash
docker compose up --build    # → http://localhost:3000 (mock AI + in-memory store, zero config)
```

`docker-compose.override.yml` publishes the host port locally and is ignored by Coolify.
To exercise Supabase/Anthropic locally, export those vars (or add an `env_file`) before `up`.

## Notes
- The image is a multi-stage build using Next.js `output: "standalone"` (small runtime image, non-root user).
- No secrets are needed at build time; all credentials are read at runtime.
- `/api/health` returns `{ "status": "ok" }` for liveness checks.
