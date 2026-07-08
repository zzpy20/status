CREATE TABLE IF NOT EXISTS targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    paused INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);

ALTER TABLE checks ADD COLUMN target_id INTEGER;
ALTER TABLE checks ADD COLUMN latency_ms INTEGER;

INSERT INTO targets (name, host, port, paused, created_at)
VALUES
    ('Shenzhen - forward (443)', 'shenzhen.1000600.xyz', 443, 0, strftime('%s','now') * 1000),
    ('Shenzhen - reverse (8443)', 'shenzhen.1000600.xyz', 8443, 0, strftime('%s','now') * 1000),
    ('Singapore - forward (443)', 'singapore.1000600.xyz', 443, 0, strftime('%s','now') * 1000),
    ('Singapore - reverse (8443)', 'singapore.1000600.xyz', 8443, 0, strftime('%s','now') * 1000),
    ('Singapore - direct (8444)', 'singapore.1000600.xyz', 8444, 0, strftime('%s','now') * 1000);

UPDATE checks
SET target_id = (SELECT id FROM targets WHERE targets.name = checks.target)
WHERE target_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_checks_target_id_time ON checks (target_id, checked_at);
