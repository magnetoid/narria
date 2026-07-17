-- Narria — profiles (Supabase Auth)
-- Run in the Supabase SQL editor (cloud) or Studio (self-hosted), after 0001.
--
-- Adds the app-side mirror of auth.users. Rows in 0001 already carry user_id, so
-- real auth needs no backfill: a signed-in user's id simply becomes that user_id.
-- RLS here covers profiles only — the content tables stay service-role-only until
-- their own policies land.

create table if not exists profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text,
  display_name  text,
  plan          text not null default 'free',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at before update on profiles
  for each row execute function narria_set_updated_at();

-- ── Provision a profile for every new auth user ───────────────────────────────
-- security definer: the trigger runs as the auth service, which has no rights on
-- public.profiles otherwise. search_path is pinned to keep the definer rights from
-- resolving an attacker-supplied table name.
create or replace function narria_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function narria_handle_new_user();

-- ── RLS: a profile is readable and editable only by its owner ─────────────────
alter table profiles enable row level security;

drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_own" on profiles
  for select using (id = (select auth.uid()));

drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles
  for update using (id = (select auth.uid())) with check (id = (select auth.uid()));
