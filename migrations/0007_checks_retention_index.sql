-- Supports pruneOldChecks() (see src/db.js): a plain `DELETE FROM checks
-- WHERE checked_at < ?` with no target_id filter can't use
-- idx_checks_target_id_time (target_id is its leading column), so without
-- this it would full-table-scan on every retention run -- the exact class
-- of bug this table's unbounded growth already caused once (see
-- docs/incidents/2026-09-06-d1-quota-exhaustion.md).
CREATE INDEX IF NOT EXISTS idx_checks_checked_at ON checks (checked_at);
