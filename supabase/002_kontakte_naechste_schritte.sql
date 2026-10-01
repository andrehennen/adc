-- ADC Dashboard – Erweiterung 2: Kontaktdaten + bearbeitbare „Nächste Schritte“
-- Einmalig im Supabase SQL Editor ausführen (nach schema.sql).

create extension if not exists pgcrypto with schema extensions;

-- Kontaktdaten: NICHT öffentlich lesbar, nur über get_contacts mit Mitglieder-Code.
-- Wer einen Eintrag anlegt, bekommt einen geheimen Schlüssel im Browser; nur damit lässt er sich ändern/löschen.
create table if not exists public.contacts (
  name       text not null check (char_length(name) between 2 and 60),
  name_key   text generated always as (lower(trim(name))) stored unique,
  email      text check (email is null or (char_length(email) <= 120 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  phone      text check (phone is null or phone ~ '^\+?[0-9 ()/-]{6,25}$'),
  token_hash text not null,
  updated_at timestamptz not null default now(),
  check (email is not null or phone is not null)
);
alter table public.contacts enable row level security;  -- keine Policy = kein direkter Zugriff
revoke all on public.contacts from anon, authenticated;

-- Bearbeitete „Nächste Schritte“: öffentlich lesbar (stehen ohnehin auf der Seite).
-- base = Text aus dem Code zum Zeitpunkt der Bearbeitung. Ändert Claude den Text im Code, gilt wieder der Code.
create table if not exists public.step_edits (
  id         bigint generated always as identity primary key,
  ticket     text not null check (char_length(ticket) between 1 and 80),
  body       text not null check (char_length(body) between 3 and 3000),
  base       text,
  name       text not null check (char_length(name) between 2 and 60),
  created_at timestamptz not null default now()
);
create index if not exists step_edits_ticket on public.step_edits (ticket, created_at desc);
alter table public.step_edits enable row level security;
drop policy if exists "read step_edits" on public.step_edits;
create policy "read step_edits" on public.step_edits for select using (true);
grant select on public.step_edits to anon;

-- Funktionen ---------------------------------------------------------------

create or replace function public.save_contact(p_code text, p_name text, p_email text, p_phone text, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform private.check_code(p_code);
  if p_token is null or char_length(p_token) < 16 then raise exception 'Ungültiger Schlüssel'; end if;
  insert into public.contacts as c (name, email, phone, token_hash)
    values (trim(p_name), nullif(trim(p_email), ''), nullif(trim(p_phone), ''),
            encode(extensions.digest(p_token, 'sha256'), 'hex'))
  on conflict (name_key) do update
    set name = excluded.name, email = excluded.email, phone = excluded.phone, updated_at = now()
    where c.token_hash = excluded.token_hash;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'Für diesen Namen sind schon Kontaktdaten von einem anderen Gerät gespeichert. Bitte André fragen.';
  end if;
end $$;

create or replace function public.delete_contact(p_code text, p_name text, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_code(p_code);
  delete from public.contacts
    where name_key = lower(trim(p_name)) and token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
end $$;

create or replace function public.get_contacts(p_code text) returns table (name text, email text, phone text)
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_code(p_code);
  return query select c.name, c.email, c.phone from public.contacts c order by c.name;
end $$;

create or replace function public.set_next_steps(p_code text, p_ticket text, p_name text, p_body text, p_base text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_code(p_code);
  insert into public.step_edits (ticket, body, base, name) values (trim(p_ticket), trim(p_body), p_base, trim(p_name));
end $$;

grant execute on function public.save_contact(text,text,text,text,text), public.delete_contact(text,text,text),
  public.get_contacts(text), public.set_next_steps(text,text,text,text,text) to anon;
