-- ADC Dashboard – Speicher für Vorschläge, Mitmachende und Kommentare
-- Einmalig im Supabase SQL Editor ausführen.
-- Lesen: öffentlich. Schreiben: nur über die RPC-Funktionen unten, mit Mitglieder-Code.
-- Den Code ändern: update private.settings set value = 'NEUER-CODE' where key = 'write_code';

create schema if not exists private;

create table if not exists private.settings (
  key   text primary key,
  value text not null
);
-- >>> Hier den Mitglieder-Code eintragen <<<
insert into private.settings (key, value) values ('write_code', 'HIER-CODE-EINTRAGEN')
  on conflict (key) do nothing;

-- Tabellen ---------------------------------------------------------------

create table if not exists public.helpers (
  id         bigint generated always as identity primary key,
  ticket     text not null check (char_length(ticket) between 1 and 80),
  name       text not null check (char_length(name) between 2 and 60),
  created_at timestamptz not null default now()
);
create unique index if not exists helpers_ticket_name on public.helpers (ticket, lower(name));

create table if not exists public.comments (
  id         bigint generated always as identity primary key,
  ticket     text not null check (char_length(ticket) between 1 and 80),
  name       text not null check (char_length(name) between 2 and 60),
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists comments_ticket on public.comments (ticket, created_at);

create table if not exists public.suggestions (
  id         bigint generated always as identity primary key,
  name       text not null check (char_length(name) between 2 and 60),
  title      text not null check (char_length(title) between 3 and 140),
  body       text check (char_length(body) <= 2000),
  created_at timestamptz not null default now()
);

-- Row Level Security: alle dürfen lesen, niemand direkt schreiben ---------

alter table public.helpers     enable row level security;
alter table public.comments    enable row level security;
alter table public.suggestions enable row level security;

drop policy if exists "read helpers" on public.helpers;
drop policy if exists "read comments" on public.comments;
drop policy if exists "read suggestions" on public.suggestions;
create policy "read helpers"     on public.helpers     for select using (true);
create policy "read comments"    on public.comments    for select using (true);
create policy "read suggestions" on public.suggestions for select using (true);

-- Schreib-Funktionen (prüfen den Code serverseitig) -----------------------

create or replace function private.check_code(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_code is null or p_code <> (select value from private.settings where key = 'write_code') then
    raise exception 'Falscher Mitglieder-Code' using errcode = '28000';
  end if;
end $$;

create or replace function public.verify_code(p_code text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_code(p_code);
  return true;
end $$;

create or replace function public.add_helper(p_code text, p_ticket text, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_code(p_code);
  insert into public.helpers (ticket, name) values (trim(p_ticket), trim(p_name))
    on conflict do nothing;
end $$;

create or replace function public.remove_helper(p_code text, p_ticket text, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_code(p_code);
  delete from public.helpers where ticket = trim(p_ticket) and lower(name) = lower(trim(p_name));
end $$;

create or replace function public.add_comment(p_code text, p_ticket text, p_name text, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_code(p_code);
  insert into public.comments (ticket, name, body) values (trim(p_ticket), trim(p_name), trim(p_body));
end $$;

create or replace function public.add_suggestion(p_code text, p_name text, p_title text, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_code(p_code);
  insert into public.suggestions (name, title, body) values (trim(p_name), trim(p_title), nullif(trim(p_body), ''));
end $$;

revoke all on function private.check_code(text) from public, anon, authenticated;
grant usage on schema public to anon;
grant select on public.helpers, public.comments, public.suggestions to anon;
grant execute on function public.verify_code(text), public.add_helper(text,text,text),
  public.remove_helper(text,text,text), public.add_comment(text,text,text,text),
  public.add_suggestion(text,text,text,text) to anon;
