-- ADC Dashboard – Erweiterung 7: Leseregel für Kommentare sauber neu setzen.
-- Grund: Gelöschte Kommentare waren weiter öffentlich lesbar; offenbar existierte noch eine alte Regel.
-- Entfernt ALLE Regeln auf public.comments und legt genau eine an: nur nicht gelöschte Kommentare sind lesbar.
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'comments' loop
    execute format('drop policy %I on public.comments', p.policyname);
  end loop;
end $$;
alter table public.comments enable row level security;
create policy "read comments" on public.comments for select using (not deleted);

-- Kontrolle: Es sollte genau eine Zeile mit qual = (NOT deleted) erscheinen
select policyname, cmd, qual from pg_policies where schemaname = 'public' and tablename = 'comments';
