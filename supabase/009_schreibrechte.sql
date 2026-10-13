-- ADC Dashboard – Erweiterung 9: Ungenutzte Schreibrechte der öffentlichen Rollen entziehen.
-- Geschrieben wird ausschließlich über die Funktionen mit Mitglieder-Code (security definer);
-- direkte Schreibzugriffe blocken bisher nur die Zeilenregeln (RLS). Das hier ist die zweite Sicherung.
-- Einmalig im Supabase SQL Editor ausführen. Ändert keine Daten, Lesen bleibt wie bisher.

revoke insert, update, delete, truncate, references, trigger
  on public.helpers, public.comments, public.suggestions, public.step_edits, public.tickets, public.votes
  from anon, authenticated;

-- Kontaktdaten sind nur über get_contacts (mit Code) lesbar
revoke all on public.contacts from anon, authenticated;

-- Kontrolle (bitte das Ergebnis an Claude schicken): Es dürfen nur noch SELECT-Rechte übrig sein, bei contacts keine.
select table_name as tabelle, grantee as rolle, string_agg(privilege_type, ', ' order by privilege_type) as rechte
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
group by 1, 2 order by 1, 2;
