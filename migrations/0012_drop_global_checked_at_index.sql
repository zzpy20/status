-- idx_checks_checked_at (migration 0007) existed solely to let
-- pruneOldChecks() delete by `checked_at < ?` with no target_id filter
-- without a full table scan. pruneOldChecks() now loops per target and
-- uses idx_checks_target_id_time instead (see src/db.js), so this index is
-- no longer read by anything -- grepped every checked_at comparison in the
-- codebase to confirm. D1 bills index maintenance as a write on every
-- check insert, so dropping it saves one more billed row-write per check.
-- See docs/incidents/2026-09-06-d1-quota-exhaustion.md, Round 12.
DROP INDEX IF EXISTS idx_checks_checked_at;
