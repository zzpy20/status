CREATE TABLE IF NOT EXISTS checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    is_up INTEGER NOT NULL,
    checked_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_checks_target_time ON checks (target, checked_at);
