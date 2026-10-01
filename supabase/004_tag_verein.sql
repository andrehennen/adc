-- ADC Dashboard – Erweiterung 4: neues Thema „verein“ (Verein & Struktur) für Online-Tickets erlauben.
-- Einmalig im Supabase SQL Editor ausführen.
create or replace function private.clean_tags(p_tags text[]) returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(distinct t), '{}') from unnest(coalesce(p_tags, '{}')) t
  where t in ('events','members','network','verein','jury');
$$;
