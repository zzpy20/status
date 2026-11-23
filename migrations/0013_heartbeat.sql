-- Heartbeat ("push") monitors: instead of this Worker polling the target,
-- the target calls GET/POST /push/:token on its own schedule, and each cron
-- tick checks whether the last push is fresher than config.graceMinutes.
-- Covers things a Cloudflare edge poll can't reach at all (Mac-local
-- services, cron jobs, anything behind NAT/Tailscale).
--
-- push_token: the secret in the push URL. A dedicated column (not part of
-- `config`) because config is returned on public routes (/api/status) and
-- this must never be -- see stripPrivate() in src/index.js. Unique index so
-- the push endpoint's lookup touches exactly one row, keeping D1 reads flat
-- no matter how often a client pushes.
-- last_push_at: ms epoch of the most recent push; NULL = never pushed, which
-- runChecks() treats as "pending" (no check row written) rather than down.
ALTER TABLE targets ADD COLUMN push_token TEXT;
ALTER TABLE targets ADD COLUMN last_push_at INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS idx_targets_push_token ON targets (push_token) WHERE push_token IS NOT NULL;
