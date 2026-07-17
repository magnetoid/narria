-- Narria — deepen RLS to cover the book_id graph
-- Run in the Supabase SQL editor (cloud) or Studio (self-hosted), after 0003.
--
-- 0003's insert/update policies on book_brain, chapters, and publish_assets check
-- only `user_id = auth.uid()` — they never verify that the book_id named in the
-- row actually belongs to that user. Concretely: user A can INSERT a row that
-- carries A's own user_id but names B's book_id, and the insert policy has no
-- opinion on that, so it succeeds. If B has no book_brain row yet, A has just
-- claimed B's book_id (book_brain.book_id is unique); every later upsertBrain()
-- by B then hits a 23505 conflict forever — a permanent denial-of-service on B's
-- book, reachable with zero read access to anything of B's. Same shape on
-- chapters and publish_assets. No SELECT policy is affected by this migration: a
-- bare user_id check there cannot leak another tenant's rows, only insert/update
-- can misattribute one.
--
-- assertOwnsBook() in lib/db/repositories/books.ts already blocks all three paths
-- in app code today, so none of this is exploitable through the UI or actions —
-- but it was exploitable by anything that talks to Postgres with a valid user JWT
-- and skips the app layer, and the whole point of RLS here is that the database,
-- not app code, is the tenancy backstop. This migration closes that gap. It does
-- NOT replace assertOwnsBook() or the repositories' explicit filters: the memory
-- store has no RLS at all, so those remain the only tenancy check on that path.
--
-- (select auth.uid()) rather than a bare auth.uid(): see 0003 — the planner caches
-- it once per statement (InitPlan) instead of evaluating it per row.
--
-- The added exists() is a primary-key lookup on books (id is its PK, so this is an
-- index scan, not a sequential one). Worth calling out because chapters autosave
-- on a roughly 1s debounce while a user types, making chapters_update_own the
-- hottest write path in the app — this check is deliberately cheap on that path.

-- ── book_brain ────────────────────────────────────────────────────────────────
drop policy if exists "book_brain_insert_own" on book_brain;
create policy "book_brain_insert_own" on book_brain
  for insert with check (
    user_id = (select auth.uid())
    and exists (select 1 from books b where b.id = book_id and b.user_id = (select auth.uid()))
  );

drop policy if exists "book_brain_update_own" on book_brain;
create policy "book_brain_update_own" on book_brain
  for update using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from books b where b.id = book_id and b.user_id = (select auth.uid()))
  );

-- ── chapters ──────────────────────────────────────────────────────────────────
drop policy if exists "chapters_insert_own" on chapters;
create policy "chapters_insert_own" on chapters
  for insert with check (
    user_id = (select auth.uid())
    and exists (select 1 from books b where b.id = book_id and b.user_id = (select auth.uid()))
  );

drop policy if exists "chapters_update_own" on chapters;
create policy "chapters_update_own" on chapters
  for update using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from books b where b.id = book_id and b.user_id = (select auth.uid()))
  );

-- ── publish_assets ────────────────────────────────────────────────────────────
drop policy if exists "publish_assets_insert_own" on publish_assets;
create policy "publish_assets_insert_own" on publish_assets
  for insert with check (
    user_id = (select auth.uid())
    and exists (select 1 from books b where b.id = book_id and b.user_id = (select auth.uid()))
  );

drop policy if exists "publish_assets_update_own" on publish_assets;
create policy "publish_assets_update_own" on publish_assets
  for update using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from books b where b.id = book_id and b.user_id = (select auth.uid()))
  );
