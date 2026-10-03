-- ADC Dashboard – Erweiterung 6: Kommentare löschen + Papierkorb (30 Tage, wiederherstellbar)
-- Einmalig im Supabase SQL Editor ausführen.

alter table public.comments add column if not exists deleted    boolean not null default false;
alter table public.comments add column if not exists deleted_by text;
alter table public.comments add column if not exists deleted_at timestamptz;
alter table public.tickets  add column if not exists deleted_by text;
alter table public.tickets  add column if not exists deleted_at timestamptz;

-- Bereits gelöschte Ideen bekommen ein Löschdatum, damit sie im Papierkorb erscheinen
update public.tickets set deleted_at = coalesce(updated_at, now()), deleted_by = coalesce(updated_by, 'Unbekannt')
  where deleted and deleted_at is null;

-- Gelöschte Kommentare sind öffentlich nicht mehr lesbar
drop policy if exists "read comments" on public.comments;
create policy "read comments" on public.comments for select using (not deleted);

-- Endgültiges Leeren nach 30 Tagen (läuft bei jedem Blick in den Papierkorb und bei jedem Löschen mit)
create or replace function private.purge_trash() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.comments where deleted and deleted_at < now() - interval '30 days';
  delete from public.comments c using public.tickets t
    where t.deleted and t.deleted_at < now() - interval '30 days' and c.ticket = 'neu-' || t.id;
  delete from public.votes v using public.tickets t
    where t.deleted and t.deleted_at < now() - interval '30 days' and v.ticket = 'neu-' || t.id;
  delete from public.helpers h using public.tickets t
    where t.deleted and t.deleted_at < now() - interval '30 days' and h.ticket = 'neu-' || t.id;
  delete from public.tickets where deleted and deleted_at < now() - interval '30 days';
end $$;
revoke all on function private.purge_trash() from public, anon, authenticated;

create or replace function public.delete_ticket(p_code text, p_name text, p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_code(p_code);
  update public.tickets set deleted = true, deleted_by = left(trim(p_name), 60), deleted_at = now()
    where id = p_id and not deleted;
  perform private.purge_trash();
end $$;

create or replace function public.restore_ticket(p_code text, p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_code(p_code);
  update public.tickets set deleted = false, deleted_by = null, deleted_at = null where id = p_id;
end $$;

create or replace function public.delete_comment(p_code text, p_name text, p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_code(p_code);
  update public.comments set deleted = true, deleted_by = left(trim(p_name), 60), deleted_at = now()
    where id = p_id and not deleted;
  perform private.purge_trash();
end $$;

create or replace function public.restore_comment(p_code text, p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_code(p_code);
  update public.comments set deleted = false, deleted_by = null, deleted_at = null where id = p_id;
end $$;

-- Papierkorb: nur mit Mitglieder-Code lesbar
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
      from public.comments c where c.deleted), '[]'::json)
  );
end $$;

grant execute on function public.restore_ticket(text,bigint), public.delete_comment(text,text,bigint),
  public.restore_comment(text,bigint), public.get_trash(text) to anon;
