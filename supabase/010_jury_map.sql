-- ADC Dashboard – Erweiterung 10: Hamburg ADC Jury Map (/jury)
-- Orte, die Agenturen und Firmen für die Jurys 2027 anbieten. Lesen öffentlich, Schreiben nur mit Mitglieder-Code.
-- Einmalig im Supabase SQL Editor ausführen.

create table if not exists public.jury_locations (
  id         bigint generated always as identity primary key,
  ort        text not null check (char_length(ort) between 2 and 100),
  firma      text check (firma is null or char_length(firma) <= 100),
  adresse    text not null check (char_length(adresse) between 3 and 160),
  lat        double precision not null check (lat between 53.3 and 53.8),
  lng        double precision not null check (lng between 9.6 and 10.4),
  raeume     int check (raeume is null or raeume between 0 and 99),
  plaetze    int check (plaetze is null or plaetze between 0 and 999),
  internet   boolean,
  catering   text check (catering is null or catering in ('ja','teilweise','nein')),
  tage       text check (tage is null or char_length(tage) <= 200),
  jury       text check (jury is null or char_length(jury) <= 100),
  notiz      text check (notiz is null or char_length(notiz) <= 1000),
  created_by text not null check (char_length(created_by) between 2 and 60),
  created_at timestamptz not null default now(),
  updated_by text check (updated_by is null or char_length(updated_by) <= 60),
  updated_at timestamptz,
  deleted    boolean not null default false,
  deleted_by text check (deleted_by is null or char_length(deleted_by) <= 60),
  deleted_at timestamptz
);
alter table public.jury_locations enable row level security;
drop policy if exists "read jury_locations" on public.jury_locations;
create policy "read jury_locations" on public.jury_locations for select using (not deleted);
revoke all on public.jury_locations from anon, authenticated;
grant select on public.jury_locations to anon;

create or replace function public.save_jury_location(p_code text, p_name text, p_id bigint,
  p_ort text, p_firma text, p_adresse text, p_lat double precision, p_lng double precision,
  p_raeume int, p_plaetze int, p_internet boolean, p_catering text, p_tage text, p_jury text, p_notiz text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare new_id bigint;
begin
  perform private.check_code(p_code);
  if p_id is null then
    insert into public.jury_locations (ort, firma, adresse, lat, lng, raeume, plaetze, internet, catering, tage, jury, notiz, created_by)
    values (trim(p_ort), nullif(trim(p_firma), ''), trim(p_adresse), p_lat, p_lng, p_raeume, p_plaetze, p_internet,
            nullif(p_catering, ''), nullif(trim(p_tage), ''), nullif(trim(p_jury), ''), nullif(trim(p_notiz), ''), left(trim(p_name), 60))
    returning id into new_id;
    return new_id;
  end if;
  update public.jury_locations set
    ort = trim(p_ort), firma = nullif(trim(p_firma), ''), adresse = trim(p_adresse), lat = p_lat, lng = p_lng,
    raeume = p_raeume, plaetze = p_plaetze, internet = p_internet, catering = nullif(p_catering, ''),
    tage = nullif(trim(p_tage), ''), jury = nullif(trim(p_jury), ''), notiz = nullif(trim(p_notiz), ''),
    updated_by = left(trim(p_name), 60), updated_at = now()
  where id = p_id and not deleted;
  return p_id;
end $$;

-- Löschen = ausblenden (deleted = true). Wiederherstellen im Table Editor: deleted auf false setzen.
create or replace function public.delete_jury_location(p_code text, p_name text, p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_code(p_code);
  update public.jury_locations set deleted = true, deleted_by = left(trim(p_name), 60), deleted_at = now()
    where id = p_id and not deleted;
end $$;

revoke all on function public.save_jury_location(text,text,bigint,text,text,text,double precision,double precision,int,int,boolean,text,text,text,text),
  public.delete_jury_location(text,text,bigint) from public;
grant execute on function
  public.save_jury_location(text,text,bigint,text,text,text,double precision,double precision,int,int,boolean,text,text,text,text),
  public.delete_jury_location(text,text,bigint) to anon;
