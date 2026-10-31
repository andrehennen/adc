-- ADC Dashboard – Erweiterung 11: Status und Verantwortliche online ändern
-- Wie bei den Nächsten Schritten: Die neueste Änderung gilt nur, solange base_status/base_owner
-- noch dem Stand im Code (data.js) entsprechen. Ändert Claude Status oder Owner im Code, gilt wieder der Code.
-- Lesen öffentlich, Schreiben nur mit Mitglieder-Code. Einmalig im Supabase SQL Editor ausführen.

create table if not exists public.ticket_edits (
  id          bigint generated always as identity primary key,
  ticket      text not null check (char_length(ticket) between 1 and 80),
  status      text not null check (status in ('idea','planned','active','done')),
  owner       text not null default '' check (char_length(owner) <= 200),
  base_status text not null check (char_length(base_status) <= 20),
  base_owner  text not null default '' check (char_length(base_owner) <= 200),
  name        text not null check (char_length(name) between 2 and 60),
  created_at  timestamptz not null default now()
);
create index if not exists ticket_edits_ticket on public.ticket_edits (ticket, created_at desc);
alter table public.ticket_edits enable row level security;
drop policy if exists "read ticket_edits" on public.ticket_edits;
create policy "read ticket_edits" on public.ticket_edits for select using (true);
revoke all on public.ticket_edits from anon, authenticated;
grant select on public.ticket_edits to anon;

create or replace function public.set_ticket_meta(p_code text, p_ticket text, p_name text,
  p_status text, p_owner text, p_base_status text, p_base_owner text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_code(p_code);
  insert into public.ticket_edits (ticket, status, owner, base_status, base_owner, name)
  values (trim(p_ticket), p_status, coalesce(trim(p_owner), ''), coalesce(p_base_status, ''), coalesce(p_base_owner, ''), left(trim(p_name), 60));
end $$;

revoke all on function public.set_ticket_meta(text,text,text,text,text,text,text) from public;
grant execute on function public.set_ticket_meta(text,text,text,text,text,text,text) to anon;
