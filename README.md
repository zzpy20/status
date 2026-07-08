# status

[English](README.md) | [中文](README_CN.md)

A minimal, self-hosted uptime monitor: a Cloudflare Worker checks a list of
TCP ports on a schedule, logs every result to D1, and serves a status page,
per-monitor detail pages, an admin UI/API for managing what's monitored, and
a push notification when something changes state. No external monitoring
service, no server to maintain -- runs entirely on Cloudflare's free tier.

Built as a generic tool, not tied to any one project: what's monitored is
stored in D1 (a `targets` table), managed entirely through the admin UI/API
-- no code changes or redeploys needed to add/edit/remove a monitor. Reuse
this same Worker for a different project just by adding different targets.

## Why this exists

Built as a self-hosted alternative to services like UptimeRobot, for a case
where the thing being monitored (proxy servers whose IPs occasionally drift)
needed TCP-level ("is this port actually accepting connections") checks, not
HTTP checks -- and where running the checker from a personal machine turned
out to be unreliable (a local VPN client could interfere with the checks).
Running the check on Cloudflare's edge instead of any particular machine
sidesteps that entirely.

## How it works

- **`targets` table (D1)** -- what to monitor: `{ name, host, port, paused }`. Managed through the admin UI/API, not a source file.
- **Cron Trigger** (`wrangler.toml`, `[triggers]`) -- runs the check on a schedule (default: every minute) via the Worker's `scheduled()` handler, skipping any paused targets.
- **TCP check** -- uses the Workers `cloudflare:sockets` API (`connect()`) to attempt a raw TCP connection to each target, with a timeout, timing how long the connection takes. This is the same check `nc -z` does locally -- it tells you the port is open and accepting connections (and how fast), nothing about HTTP/application-level health.
- **D1** -- every check (up or down, with latency) is logged as a row, so uptime percentages, incident history, and response times are computed from real data, not just "current state".
- **Status page** (`/`) -- current state, 24h/7d uptime %, time since last downtime, per target. Also a `/api/status` JSON endpoint.
- **Per-monitor detail page** (`/monitor/:id`) -- current status and how long it's been in that state, 24h/7d/30d uptime % with incident counts and total downtime per window, response-time average/min/max plus a simple chart, and a table of recent incidents. Public/read-only, same as the status page.
- **Admin UI** (`/admin`) -- add, edit, pause/resume, delete monitors, and send a test notification, all from one page. Protected by a bearer token.
- **Admin API** (`/admin/api/*`) -- the same operations as the UI, as plain JSON endpoints, for scripting.
- **Telegram push notifications** -- on a state change (up→down or down→up) the Worker sends a message via a Telegram bot.

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
   `migrations/0001_init.sql` creates the `checks` table. `migrations/0002_targets_and_latency.sql` adds the `targets` table (seeded with example rows -- edit/delete them from the admin UI after deploying) and latency tracking.

3. **Edit `wrangler.toml`:**
   - `[[routes]]` `pattern` -- the hostname you want the status page on (must be a hostname on a zone already in your Cloudflare account; `custom_domain = true` handles the DNS record automatically on deploy).
   - `[triggers]` `crons` -- how often to check (cron syntax; `*/1 * * * *` = every minute).

4. **Set the admin token** (required for `/admin` and `/admin/api/*` to work at all):
   ```bash
   echo "your-chosen-token" | wrangler secret put ADMIN_TOKEN
   ```
   Pick your own random-ish string -- generate it yourself and pipe it straight into `wrangler secret put` rather than passing it through anything that might log or echo it, since this token grants full control over what's monitored. Stored as a **secret**, never in `wrangler.toml` (this repo is public).

5. **Deploy:**
   ```bash
   wrangler deploy
   ```

6. **Manage monitors:** visit `https://<your-domain>/admin`, paste the admin token into the box (saved in the browser's `localStorage` from then on), and add/edit/pause/delete targets from there.

7. **(Optional) Enable push notifications on state change, via a Telegram bot:**
   - Message **@BotFather** on Telegram, send `/newbot`, follow the prompts -- it replies with a bot token.
   - Message **@userinfobot** to get your own numeric Telegram chat ID (not sensitive by itself -- useless without the bot token -- but still a personal identifier, so it's stored as a secret too rather than committed to this public repo).
   - Message your new bot at least once (Telegram requires this before a bot can message you back).
   - Set both as secrets:
     ```bash
     echo "your-bot-token" | wrangler secret put TELEGRAM_BOT_TOKEN
     echo "your-chat-id" | wrangler secret put TELEGRAM_CHAT_ID
     ```
   Leaving either unset disables notifications entirely (the code checks for both and no-ops); the same applies if `ADMIN_TOKEN` is left unset -- `/admin/api/*` just always returns 401.

   **Why Telegram and not ntfy.sh:** ntfy.sh was the original choice, but its free tier turned out to rate-limit publishing by source IP regardless of authentication -- and Cloudflare Workers share egress IPs across huge numbers of unrelated users/services also publishing to ntfy.sh, so that shared quota was already exhausted well before this app's own (very low) usage would ever hit a real limit. Every test run from a personal machine worked; every real notification sent from the deployed Worker silently failed with a 429, invisible until logged explicitly. Telegram's Bot API doesn't have this shared-quota problem.

That's it -- no server, no container, no always-on machine required.

## Notes / limitations

- **TCP-only.** This checks "does the port accept a connection," not "does the application behind it work correctly." Fine for proxies, SSH, databases, etc.; not a substitute for an HTTP/keyword check if you need to validate actual application responses.
- **D1 write volume.** Every check writes a row (by design, for full history) -- fine at the free tier's limits for a handful of targets checked every minute, but if monitoring many targets very frequently, consider checking less often or only writing on state change.
- **Silent notification failures are a real risk with any webhook-style integration.** Don't swallow errors with a bare `.catch(() => {})` on the notify call -- log the response status/body on failure, or a broken notification channel can go unnoticed indefinitely (this happened once already in this project, see the ntfy.sh note above).
- **Single vantage point.** Checks always run from wherever Cloudflare schedules Cron Triggers (not distributed across regions the way a paid UptimeRobot plan is) -- fine for "is this reachable at all," not meant to detect region-specific network issues.
- **Admin auth is a single shared token**, not per-user accounts. Fine for personal use; if this ever needs multiple people with different access levels, that would need real auth (e.g. Cloudflare Access) instead.
