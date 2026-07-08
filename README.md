# status

A minimal, self-hosted uptime monitor: a Cloudflare Worker checks a list of
TCP ports on a schedule, logs every result to D1, and serves a small status
page plus a push notification when something changes state. No external
monitoring service, no server to maintain -- runs entirely on Cloudflare's
free tier.

Built as a generic tool, not tied to any one project: everything specific to
what you're monitoring lives in one file (`src/targets.js`). Point it at a
different set of hosts/ports for a different project by editing that file
and redeploying -- nothing else needs to change.

## Why this exists

Built as a self-hosted alternative to services like UptimeRobot, for a case
where the thing being monitored (proxy servers whose IPs occasionally drift)
needed TCP-level ("is this port actually accepting connections") checks, not
HTTP checks -- and where running the checker from a personal machine turned
out to be unreliable (a local VPN client could interfere with the checks).
Running the check on Cloudflare's edge instead of any particular machine
sidesteps that entirely.

## How it works

- **`src/targets.js`** -- the list of `{ name, host, port }` entries to check. Edit this to monitor anything.
- **Cron Trigger** (`wrangler.toml`, `[triggers]`) -- runs the check on a schedule (default: every minute) via the Worker's `scheduled()` handler.
- **TCP check** -- uses the Workers `cloudflare:sockets` API (`connect()`) to attempt a raw TCP connection to each target, with a timeout. This is the same check `nc -z` does locally -- it tells you the port is open and accepting connections, nothing about HTTP/application-level health.
- **D1** -- every check (up or down) is logged as a row, so uptime percentages and history are computed from real data, not just "current state".
- **Status page** -- the Worker's `fetch()` handler serves an HTML page (and a `/api/status` JSON endpoint) showing current state, 24h/7d uptime %, and time since last downtime, per target.
- **ntfy.sh push notifications** -- on a state change (up→down or down→up) the Worker POSTs to an ntfy.sh topic. Set `NTFY_TOPIC` in `wrangler.toml` to enable; leave it empty to disable.

## Setup

Requires `wrangler` (`npm install -g wrangler` or use the one already on your machine) logged into your Cloudflare account.

1. **Create the D1 database:**
   ```bash
   wrangler d1 create status-uptime
   ```
   Copy the `database_id` it prints into `wrangler.toml`.

2. **Apply the schema:**
   ```bash
   wrangler d1 migrations apply status-uptime --remote
   ```

3. **Edit `src/targets.js`** with whatever you want to monitor.

4. **Edit `wrangler.toml`:**
   - `[[routes]]` `pattern` -- the hostname you want the status page on (must be a hostname on a zone already in your Cloudflare account; `custom_domain = true` handles the DNS record automatically on deploy).
   - `[triggers]` `crons` -- how often to check (cron syntax; `*/1 * * * *` = every minute).

5. **Deploy:**
   ```bash
   wrangler deploy
   ```

6. **(Optional) Enable push notifications on state change:**
   ```bash
   echo "your-topic-name" | wrangler secret put NTFY_TOPIC
   ```
   Set this as a **secret**, not a `wrangler.toml` var -- the topic string grants read/write access to your ntfy.sh notification channel, and this repo is public. Pick something unguessable (e.g. `myproject-<random hex>`). Leaving the secret unset disables notifications entirely (the code checks for it and no-ops).

That's it -- no server, no container, no always-on machine required.

## Notes / limitations

- **TCP-only.** This checks "does the port accept a connection," not "does the application behind it work correctly." Fine for proxies, SSH, databases, etc.; not a substitute for an HTTP/keyword check if you need to validate actual application responses.
- **D1 write volume.** Every check writes a row (by design, for full history) -- fine at the free tier's limits for a handful of targets checked every minute, but if monitoring many targets very frequently, consider checking less often or only writing on state change.
- **ntfy.sh topics are public by default.** Anyone who knows/guesses your topic string can read your notifications (or send fake ones). Use a long random topic name; self-host ntfy or use a paid plan for real access control if that matters for what you're monitoring.
