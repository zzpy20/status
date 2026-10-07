-- idx_checks_target_time (target, checked_at) is dead weight: every read
-- query against `checks` filters by target_id, never by the legacy `target`
-- TEXT column (grepped src/db.js -- confirmed no query uses it). It's been
-- redundant with idx_checks_target_id_time since target_id was backfilled
-- (migration 0002). D1 bills index maintenance as rows written on every
-- insert, so this index was costing one extra billed write per check for no
-- read benefit -- see docs/incidents/2026-09-06-d1-quota-exhaustion.md,
-- Round 10/11.
DROP INDEX IF EXISTS idx_checks_target_time;
