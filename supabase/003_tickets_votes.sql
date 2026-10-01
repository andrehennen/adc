-- ADC Dashboard – Erweiterung 3: Online-Tickets + Upvotes
-- Einmalig im Supabase SQL Editor ausführen (nach schema.sql und 002).

-- Online-Tickets: alle mit Mitglieder-Code dürfen anlegen, bearbeiten und löschen.
-- Löschen ist ein „Papierkorb“ (deleted = true); endgültig löschen nur im Table Editor.
create table if not exists public.tickets (
  id         bigint generated always as identity primary key,
  s          text not null default 'hh' check (s in ('hh','jhv')),
  sektion    text check (sektion is null or char_length(sektion) <= 40),
  emoji      text not null default '💡' check (char_length(emoji) <= 16),
  title      text not null check (char_length(title) between 3 and 140),
  body       text check (char_length(body) <= 2000),
  x          text check (char_length(x) <= 3000),
  tags       text[] not null default '{}',
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz,
  deleted    boolean not null default false
);
alter table public.tickets enable row level security;
drop policy if exists "read tickets" on public.tickets;
create policy "read tickets" on public.tickets for select using (not deleted);
grant select on public.tickets to anon;

-- Upvotes: eine Stimme pro Person und Ticket. Namen sind öffentlich (wie bei „Machen mit“).
create table if not exists public.votes (
  id         bigint generated always as identity primary key,
  ticket     text not null check (char_length(ticket) between 1 and 80),
  name       text not null check (char_length(name) between 2 and 60),
  name_key   text generated always as (lower(trim(name))) stored,
  created_at timestamptz not null default now(),
  unique (ticket, name_key)
);
alter table public.votes enable row level security;
drop policy if exists "read votes" on public.votes;
create policy "read votes" on public.votes for select using (true);
grant select on public.votes to anon;

-- Funktionen ---------------------------------------------------------------

create or replace function private.clean_tags(p_tags text[]) returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(distinct t), '{}') from unnest(coalesce(p_tags, '{}')) t
  where t in ('events','network','members','jury');
$$;

create or replace function public.create_ticket(p_code text, p_name text, p_s text, p_sektion text, p_emoji text,
  p_title text, p_body text, p_x text, p_tags text[]) returns bigint
language plpgsql security definer set search_path = '' as $$
declare new_id bigint;
begin
  perform private.check_code(p_code);
  insert into public.tickets (s, sektion, emoji, title, body, x, tags, created_by)
  values (coalesce(nullif(p_s, ''), 'hh'), nullif(trim(p_sektion), ''), coalesce(nullif(trim(p_emoji), ''), '💡'),
          trim(p_title), nullif(trim(p_body), ''), nullif(trim(p_x), ''), private.clean_tags(p_tags), trim(p_name))
  returning id into new_id;
  return new_id;
end $$;

create or replace function public.update_ticket(p_code text, p_name text, p_id bigint, p_s text, p_sektion text, p_emoji text,
  p_title text, p_body text, p_x text, p_tags text[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_code(p_code);
  update public.tickets set
    s = coalesce(nullif(p_s, ''), 'hh'), sektion = nullif(trim(p_sektion), ''),
    emoji = coalesce(nullif(trim(p_emoji), ''), '💡'), title = trim(p_title),
    body = nullif(trim(p_body), ''), x = nullif(trim(p_x), ''), tags = private.clean_tags(p_tags),
    updated_by = trim(p_name), updated_at = now()
  where id = p_id and not deleted;
end $$;

create or replace function public.delete_ticket(p_code text, p_name text, p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_code(p_code);
  update public.tickets set deleted = true, updated_by = trim(p_name), updated_at = now() where id = p_id;
end $$;

create or replace function public.toggle_vote(p_code text, p_ticket text, p_name text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_code(p_code);
  delete from public.votes where ticket = trim(p_ticket) and name_key = lower(trim(p_name));
  if found then return false; end if;
  insert into public.votes (ticket, name) values (trim(p_ticket), trim(p_name));
  return true;
end $$;

revoke all on function private.clean_tags(text[]) from public, anon, authenticated;
grant execute on function
  public.create_ticket(text,text,text,text,text,text,text,text,text[]),
  public.update_ticket(text,text,bigint,text,text,text,text,text,text,text[]),
  public.delete_ticket(text,text,bigint),
  public.toggle_vote(text,text,text) to anon;

-- Bisherige Vorschläge werden zu Tickets (einmalig) --------------------------
insert into public.tickets (s, emoji, title, body, created_by, created_at)
select 'hh', '💡', s.title, s.body, s.name, s.created_at
from public.suggestions s
where not exists (select 1 from public.tickets t where t.title = s.title and t.created_by = s.name);
