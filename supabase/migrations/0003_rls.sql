-- Narria — row level security on the content tables
-- Run in the Supabase SQL editor (cloud) or Studio (self-hosted), after 0002.
--
-- 0001 left RLS off because every request used the service-role key, which bypasses
-- it: one forgotten .eq("user_id", …) was a cross-tenant read. Requests now carry
-- the signed-in user's JWT (lib/db/client.ts → getDb()), so the database decides
-- which rows a request may touch. The explicit owner filters in
-- lib/db/repositories/* stay — RLS is the backstop for a filter someone forgets,
-- not a licence to drop them.
--
-- ⚠ CLAIM YOUR ROWS BEFORE RUNNING THIS. Rows written before auth carry DEV_USER_ID
-- (lib/constants.ts), which is not a real auth.users id — once RLS is on, no one can
-- read them and they are invisible rather than deleted. Sign in, copy your id from
-- Authentication → Users, and run:
--
--   update books          set user_id = '<your-auth-uid>' where user_id = '00000000-0000-0000-0000-000000000001';
--   update book_brain     set user_id = '<your-auth-uid>' where user_id = '00000000-0000-0000-0000-000000000001';
--   update chapters       set user_id = '<your-auth-uid>' where user_id = '00000000-0000-0000-0000-000000000001';
--   update publish_assets set user_id = '<your-auth-uid>' where user_id = '00000000-0000-0000-0000-000000000001';
--   update ai_generations set user_id = '<your-auth-uid>' where user_id = '00000000-0000-0000-0000-000000000001';
--
-- No foreign key from user_id to auth.users here on purpose: any unclaimed
-- DEV_USER_ID row would violate it and the statement would fail. Add it once the
-- data above is claimed and the DEV_USER_ID rows are gone.
--
-- (select auth.uid()) rather than a bare auth.uid(): wrapping it in a subquery lets
-- the planner evaluate it once per statement via an InitPlan instead of once per row.

-- ── Indexes for the policy column ─────────────────────────────────────────────
-- Every policy below filters on user_id, so it is evaluated against every row the
-- planner considers. Unindexed, that is a sequential scan on each query.
-- books needs nothing here: books_user_id_idx (0001) is (user_id, updated_at desc),
-- which already leads with user_id and serves these policies.
create index if not exists book_brain_user_id_idx on book_brain (user_id);
create index if not exists chapters_user_id_idx on chapters (user_id);
create index if not exists publish_assets_user_id_idx on publish_assets (user_id);
create index if not exists ai_generations_user_id_idx on ai_generations (user_id);

-- ── books ─────────────────────────────────────────────────────────────────────
alter table books enable row level security;

drop policy if exists "books_select_own" on books;
create policy "books_select_own" on books
  for select using (user_id = (select auth.uid()));

drop policy if exists "books_insert_own" on books;
create policy "books_insert_own" on books
  for insert with check (user_id = (select auth.uid()));

drop policy if exists "books_update_own" on books;
create policy "books_update_own" on books
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "books_delete_own" on books;
create policy "books_delete_own" on books
  for delete using (user_id = (select auth.uid()));

-- ── book_brain ────────────────────────────────────────────────────────────────
alter table book_brain enable row level security;

drop policy if exists "book_brain_select_own" on book_brain;
create policy "book_brain_select_own" on book_brain
  for select using (user_id = (select auth.uid()));

drop policy if exists "book_brain_insert_own" on book_brain;
create policy "book_brain_insert_own" on book_brain
  for insert with check (user_id = (select auth.uid()));

-- upsertBrain() conflicts on book_id alone, so an upsert aimed at someone else's
-- book resolves to their existing row rather than inserting a new one. The check
-- below (user_id = auth.uid()) does NOT by itself stop that from reassigning the
-- row's user_id to the caller: it is satisfied by the caller's own identity no
-- matter whose book_id they named, so on its own this policy is not what turns
-- the upsert into a no-op — assertOwnsBook() in app code is what currently blocks
-- it. 0004_rls_book_graph.sql adds the guarantee at the database level: an
-- exists() against books that requires the named book_id to already belong to the
-- caller, so a row's user_id can only ever be reassigned by someone who owns the
-- book it points at.
drop policy if exists "book_brain_update_own" on book_brain;
create policy "book_brain_update_own" on book_brain
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "book_brain_delete_own" on book_brain;
create policy "book_brain_delete_own" on book_brain
  for delete using (user_id = (select auth.uid()));

-- ── chapters ──────────────────────────────────────────────────────────────────
alter table chapters enable row level security;

drop policy if exists "chapters_select_own" on chapters;
create policy "chapters_select_own" on chapters
  for select using (user_id = (select auth.uid()));

drop policy if exists "chapters_insert_own" on chapters;
create policy "chapters_insert_own" on chapters
  for insert with check (user_id = (select auth.uid()));

drop policy if exists "chapters_update_own" on chapters;
create policy "chapters_update_own" on chapters
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "chapters_delete_own" on chapters;
create policy "chapters_delete_own" on chapters
  for delete using (user_id = (select auth.uid()));

-- ── publish_assets ────────────────────────────────────────────────────────────
alter table publish_assets enable row level security;

drop policy if exists "publish_assets_select_own" on publish_assets;
create policy "publish_assets_select_own" on publish_assets
  for select using (user_id = (select auth.uid()));

drop policy if exists "publish_assets_insert_own" on publish_assets;
create policy "publish_assets_insert_own" on publish_assets
  for insert with check (user_id = (select auth.uid()));

drop policy if exists "publish_assets_update_own" on publish_assets;
create policy "publish_assets_update_own" on publish_assets
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "publish_assets_delete_own" on publish_assets;
create policy "publish_assets_delete_own" on publish_assets
  for delete using (user_id = (select auth.uid()));

-- ── ai_generations (audit log) ────────────────────────────────────────────────
-- Read-only to its subject, deliberately. Writes come from logGeneration() on the
-- service-role client, which bypasses RLS: an audit trail a user can write is not
-- one, and later tasks add columns (usage, cost) a user must not be able to forge.
-- No insert/update/delete policy means exactly that — RLS denies by default.
alter table ai_generations enable row level security;

drop policy if exists "ai_generations_select_own" on ai_generations;
create policy "ai_generations_select_own" on ai_generations
  for select using (user_id = (select auth.uid()));
