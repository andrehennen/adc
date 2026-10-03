-- ADC Dashboard – Erweiterung 8: Gelöschte Kommentare physisch aus der öffentlichen Tabelle nehmen.
-- Grund: Die Leseregel (NOT deleted) griff bei public.comments nicht; gelöschte Kommentare blieben
-- über die API lesbar. Ab jetzt wandern sie in private.deleted_comments (von außen nicht erreichbar)
-- und kommen beim Wiederherstellen zurück. Einmalig im Supabase SQL Editor ausführen.

create table if not exists private.deleted_comments (
  id         bigint primary key,
  ticket     text not null,
  name       text not null,
  body       text not null,
  created_at timestamptz not null,
  deleted_by text,
  deleted_at timestamptz not null default now()
);

-- Bereits gelöschte Kommentare umziehen
insert into private.deleted_comments (id, ticket, name, body, created_at, deleted_by, deleted_at)
  select id, ticket, name, body, created_at, deleted_by, coalesce(deleted_at, now())
  from public.comments where deleted
  on conflict (id) do nothing;
delete from public.comments where deleted;

create or replace function public.delete_comment(p_code text, p_name text, p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_code(p_code);
  insert into private.deleted_comments (id, ticket, name, body, created_at, deleted_by)
    select id, ticket, name, body, created_at, left(trim(p_name), 60) from public.comments where id = p_id
    on conflict (id) do nothing;
  delete from public.comments where id = p_id;
  perform private.purge_trash();
end $$;

create or replace function public.restore_comment(p_code text, p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_code(p_code);
  insert into public.comments (id, ticket, name, body, created_at) overriding system value
    select id, ticket, name, body, created_at from private.deleted_comments where id = p_id
    on conflict (id) do nothing;
  delete from private.deleted_comments where id = p_id;
end $$;

create or replace function private.purge_trash() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from private.deleted_comments where deleted_at < now() - interval '30 days';
  delete from private.deleted_comments d using public.tickets t
    where t.deleted and t.deleted_at < now() - interval '30 days' and d.ticket = 'neu-' || t.id;
  delete from public.comments c using public.tickets t
    where t.deleted and t.deleted_at < now() - interval '30 days' and c.ticket = 'neu-' || t.id;
  delete from public.votes v using public.tickets t
    where t.deleted and t.deleted_at < now() - interval '30 days' and v.ticket = 'neu-' || t.id;
  delete from public.helpers h using public.tickets t
    where t.deleted and t.deleted_at < now() - interval '30 days' and h.ticket = 'neu-' || t.id;
  delete from public.tickets where deleted and deleted_at < now() - interval '30 days';
end $$;
revoke all on function private.purge_trash() from public, anon, authenticated;

create or replace function public.get_trash(p_code text) returns json
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_code(p_code);
  perform private.purge_trash();
  return json_build_object(
    'tickets', coalesce((select json_agg(json_build_object(
        'id', t.id, 'emoji', t.emoji, 'title', t.title, 'body', t.body, 'created_by', t.created_by,
        'deleted_by', t.deleted_by, 'deleted_at', t.deleted_at) order by t.deleted_at desc)
      from public.tickets t where t.deleted), '[]'::json),
    'comments', coalesce((select json_agg(json_build_object(
        'id', c.id, 'ticket', c.ticket, 'name', c.name, 'body', c.body, 'created_at', c.created_at,
        'deleted_by', c.deleted_by, 'deleted_at', c.deleted_at) order by c.deleted_at desc)
      from private.deleted_comments c), '[]'::json)
  );
end $$;

-- Diagnose (bitte das Ergebnis an Claude schicken): Welche Regeln gibt es auf den Tabellen?
select c.relname as tabelle, c.relrowsecurity as rls_an, p.policyname, p.cmd, p.roles, p.qual
from pg_class c
left join pg_policies p on p.schemaname = 'public' and p.tablename = c.relname
where c.relnamespace = 'public'::regnamespace and c.relname in ('comments', 'tickets')
order by 1, 3;
