-- Rollup tables so uptime/latency/incident reads no longer scale with the
-- total volume of raw checks ever recorded. Previously every page view
-- recomputed uptime %, latency stats, and incident lists by rescanning raw
-- `checks` rows for the requested window (up to a full year) -- correct,
-- but its cost grows forever as `checks` grows forever, which is what
-- exhausted the account's D1 quota twice. See
-- docs/incidents/2026-09-06-d1-quota-exhaustion.md.
--
-- daily_stats: one row per (target, UTC day), incrementally updated by
-- insertCheck() on every check -- so a "last 30 days" read sums ~30 tiny
-- rows instead of scanning ~36,000 raw ones.
CREATE TABLE IF NOT EXISTS daily_stats (
    target_id INTEGER NOT NULL,
    day INTEGER NOT NULL, -- UTC day bucket: floor(checked_at / 86400000) * 86400000
    up_count INTEGER NOT NULL DEFAULT 0,
    down_count INTEGER NOT NULL DEFAULT 0,
    latency_sum INTEGER NOT NULL DEFAULT 0,
    latency_count INTEGER NOT NULL DEFAULT 0,
    latency_min INTEGER,
    latency_max INTEGER,
    PRIMARY KEY (target_id, day)
);

-- incidents: one row per actual incident (naturally rare -- a handful per
-- target per year, not one row per check), written directly at the moment
-- runChecks() confirms a state transition, instead of being reconstructed
-- by replaying raw checks through the debounce state machine on every read.
-- end_at IS NULL means still ongoing.
CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_id INTEGER NOT NULL,
    start_at INTEGER NOT NULL,
    end_at INTEGER,
    reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_incidents_target_start ON incidents (target_id, start_at);
-- Speeds up closeIncident()'s "find this target's open incident" -- SQLite
-- partial indexes only cover matching rows, so this stays tiny (open
-- incidents are rare) regardless of how many closed ones accumulate.
CREATE INDEX IF NOT EXISTS idx_incidents_open ON incidents (target_id) WHERE end_at IS NULL;

-- One-time backfill of daily_stats from existing raw history, so historical
-- uptime/latency stats don't reset to zero. Pure SQL aggregation, so it's
-- safe to run as part of the migration -- costs one full read of `checks`
-- (a few hundred thousand rows as of this writing), a one-time expense in
-- exchange for permanently removing that cost from every future page view.
-- (incidents can't be backfilled this way -- the 2-consecutive-failures
-- debounce logic isn't a plain GROUP BY -- see the temporary backfill
-- endpoint used once after this migration, documented in the incident doc.)
INSERT INTO daily_stats (target_id, day, up_count, down_count, latency_sum, latency_count, latency_min, latency_max)
SELECT
    target_id,
    (checked_at / 86400000) * 86400000 AS day,
    SUM(is_up) AS up_count,
    SUM(1 - is_up) AS down_count,
    SUM(COALESCE(latency_ms, 0)) AS latency_sum,
    SUM(CASE WHEN latency_ms IS NOT NULL THEN 1 ELSE 0 END) AS latency_count,
    MIN(latency_ms) AS latency_min,
    MAX(latency_ms) AS latency_max
FROM checks
-- A handful of legacy rows (pre-dating migration 0002's target_id backfill,
-- or belonging to a since-renamed/deleted target) have target_id IS NULL --
-- confirmed via a direct count before writing this fix (50 rows, out of
-- 585K+). daily_stats.target_id is NOT NULL by design (it's half the
-- primary key), and these rows aren't attributable to any current target
-- regardless, so they're excluded rather than worked around.
WHERE target_id IS NOT NULL
GROUP BY target_id, day;
