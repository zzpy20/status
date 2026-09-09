-- Dedup table for the proactive D1 usage monitor (src/usage-monitor.js):
-- ensures at most one Telegram alert per UTC day even though the check
-- itself runs every 15 minutes. One row per day an alert was ever sent --
-- trivial size (365/year), no retention policy needed.
CREATE TABLE IF NOT EXISTS usage_alerts (
    date TEXT PRIMARY KEY,
    alerted_at INTEGER NOT NULL
);
