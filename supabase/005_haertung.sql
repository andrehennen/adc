-- ADC Dashboard – Erweiterung 5: Härtung (Längenbegrenzungen für bisher unbegrenzte Felder).
-- Einmalig im Supabase SQL Editor ausführen. Ändert keine Daten.
alter table public.tickets    add constraint tickets_created_by_len check (char_length(created_by) between 2 and 60) not valid;
alter table public.tickets    add constraint tickets_updated_by_len check (updated_by is null or char_length(updated_by) <= 60) not valid;
alter table public.step_edits add constraint step_edits_base_len    check (base is null or char_length(base) <= 4000) not valid;
alter table public.helpers    add constraint helpers_ticket_fmt     check (ticket ~ '^[a-z0-9-]+$') not valid;
alter table public.comments   add constraint comments_ticket_fmt    check (ticket ~ '^[a-z0-9-]+$') not valid;
alter table public.votes      add constraint votes_ticket_fmt       check (ticket ~ '^[a-z0-9-]+$') not valid;
