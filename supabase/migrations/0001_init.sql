-- Narria — initial schema
-- Run in the Supabase SQL editor (cloud) or Studio (self-hosted).
--
-- Auth is deferred for the MVP: every row carries user_id (a single implicit
-- workspace user) so real Supabase Auth + RLS can be layered on later without a
-- migration. Server code uses the service-role key, which bypasses RLS, so RLS is
-- intentionally left disabled here. ENABLE RLS + per-user policies before exposing
-- the anon key to browsers or adding multi-user auth.

create extension if not exists pgcrypto;

-- Shared updated_at trigger
create or replace function narria_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ── books ──────────────────────────────────────────────────────────────────────
create table if not exists books (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  title        text not null default 'Untitled',
  subtitle     text,
  book_type    text not null default 'other',
  status       text not null default 'draft',
  cover_emoji  text not null default '📖',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists books_user_id_idx on books (user_id, updated_at desc);

drop trigger if exists books_set_updated_at on books;
create trigger books_set_updated_at before update on books
  for each row execute function narria_set_updated_at();

-- ── book_brain (1:1 with book) ─────────────────────────────────────────────────
create table if not exists book_brain (
  id                 uuid primary key default gen_random_uuid(),
  book_id            uuid not null unique references books (id) on delete cascade,
  user_id            uuid not null,
  audience           text,
  tone               text,
  writing_style      text,
  author_background  text,
  author_goals       text,
  reader_takeaway    text,
  key_ideas          jsonb not null default '[]'::jsonb,
  style_rules        jsonb not null default '[]'::jsonb,
  characters         jsonb not null default '[]'::jsonb,
  research_notes     jsonb not null default '[]'::jsonb,
  interview          jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

drop trigger if exists book_brain_set_updated_at on book_brain;
create trigger book_brain_set_updated_at before update on book_brain
  for each row execute function narria_set_updated_at();

-- ── chapters ───────────────────────────────────────────────────────────────────
create table if not exists chapters (
  id                    uuid primary key default gen_random_uuid(),
  book_id               uuid not null references books (id) on delete cascade,
  user_id               uuid not null,
  order_index           int not null default 0,
  title                 text not null default 'Untitled chapter',
  goal                  text,
  summary               text,
  key_points            jsonb not null default '[]'::jsonb,
  estimated_word_count  int not null default 0,
  content               text not null default '',
  status                text not null default 'planned',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists chapters_book_order_idx on chapters (book_id, order_index);

drop trigger if exists chapters_set_updated_at on chapters;
create trigger chapters_set_updated_at before update on chapters
  for each row execute function narria_set_updated_at();

-- ── publish_assets (one row per kind per book) ─────────────────────────────────
create table if not exists publish_assets (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null references books (id) on delete cascade,
  user_id     uuid not null,
  kind        text not null,
  content     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (book_id, kind)
);
create index if not exists publish_assets_book_idx on publish_assets (book_id);

drop trigger if exists publish_assets_set_updated_at on publish_assets;
create trigger publish_assets_set_updated_at before update on publish_assets
  for each row execute function narria_set_updated_at();

-- ── ai_generations (audit log) ─────────────────────────────────────────────────
create table if not exists ai_generations (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid references books (id) on delete cascade,
  chapter_id  uuid references chapters (id) on delete set null,
  user_id     uuid not null,
  agent       text not null,
  action      text,
  model       text,
  input       jsonb,
  output      text,
  tokens      int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists ai_generations_book_idx on ai_generations (book_id, created_at desc);
