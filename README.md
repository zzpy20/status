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

- **`targets` table (D1)** -- what to monitor: `{ name, type, host, port, config, paused, tags, notes }`. Managed through the admin UI/API, not a source file.
- **Three monitor types:**
  - **Port (TCP)** -- uses the Workers `cloudflare:sockets` API (`connect()`) to attempt a raw TCP connection, with a timeout, timing how long the connection takes. The same check `nc -z` does locally -- tells you the port is open and accepting connections (and how fast), nothing about application-level health.
  - **HTTP** -- plain `fetch()` against a URL. "Up" means `res.ok` (2xx-3xx) by default; optionally require an exact status code, and/or that a keyword appears in the response body.
  - **DNS** -- resolves a hostname via DNS-over-HTTPS (Cloudflare's own resolver, `cloudflare-dns.com/dns-query`) -- no raw DNS protocol needed, which the Workers runtime doesn't expose anyway. "Up" means at least one record resolves; optionally require a specific value among the results (e.g. a specific IP for an A record).
  - Deliberately **not implemented**: Ping/ICMP and UDP monitoring -- the Workers sockets API is TCP-only, there's no raw ICMP/UDP access available at all. Also skipped: Cron/heartbeat monitoring (a fundamentally different "push" shape of check, not a poll) and structured API/JSON-assertion monitoring (real complexity for a need HTTP+keyword already covers).
  - `host` doubles as the primary identifier for every type (the URL for HTTP, the hostname for DNS, the TCP host for Port); `config` (JSON) holds only the few type-specific extra fields (`expectedStatus`/`keyword` for HTTP, `recordType`/`expectedValue` for DNS).
- **Cron Trigger** (`wrangler.toml`, `[triggers]`) -- runs the check on a schedule (default: every minute) via the Worker's `scheduled()` handler, skipping any paused targets. A target with zero check history yet (just added) shows as **Pending**, not Down/Up.
- **D1** -- every check (up or down, with latency) is logged as a row, so uptime percentages, incident history, and response times are computed from real data, not just "current state".
- **Status page** (`/`) -- current state, 24h/7d uptime %, time since last downtime, per target, with a search box (matches name/host/tag) and clickable tag pills. Also a `/api/status` JSON endpoint.
- **Incidents page** (`/incidents`) -- every incident across every monitor, newest-first (not time-windowed, unlike the per-monitor 24h view), with a "Root Cause" per incident (see below) and search-by-name. Public/read-only.
- **Per-monitor detail page** (`/monitor/:id`) -- current status and how long it's been in that state, 24h/7d/30d/365d uptime % with incident counts and total downtime per window, response-time average/min/max plus a simple chart, and a table of recent (24h) incidents. Public/read-only, same as the status page.
- **Root cause** -- each check that fails records a short reason (`"Timeout"`, `"HTTP 503 Service Unavailable"`, `"Keyword not found in response"`, `"No A records found"`, `"Resolved value doesn't match expected '1.2.3.4'"`, etc.), stored per-check and surfaced on the Incidents page as whichever reason started that incident.
- Deliberately **not implemented**, unlike UptimeRobot's full dashboard: Comments/Visibility columns on incidents, and separate Status pages/Maintenance/Team members/Integrations nav tabs -- those are multi-user/team features with nothing behind them for a single-person tool.
- **Reset** (admin only) -- wipes a single monitor's check history (uptime %, incidents, latency stats are all computed live from that history, so this alone is a full "start fresh") without touching its name/type/config/tags/notes. Useful after a known, expected outage (e.g. you deliberately power-cycled a server) that would otherwise permanently skew that monitor's stats.
- **Tags** -- short, public labels per monitor (comma-separated), shown as pills on every page and searchable/clickable to filter.
- **Notes** -- a free-text field for your own recall (what this monitor is for, context, etc.), supporting basic **bold**/*italic*/underline/~~strikethrough~~ via lightweight text markers (not raw HTML -- text is escaped first, so nothing typed here can inject real markup). **Admin-only: never exposed on the status page, `/api/status`, or `/monitor/:id`.**
- **Admin UI** (`/admin`) -- add and edit monitors via a modal (not inline row expansion), pause/resume, reset, delete, search, and send a test notification, all from one page. Protected by a bearer token.
- **Bulk actions** -- select monitors via checkboxes (or "select all") to add/remove tags, pause, reset, or delete several at once. Reuses the same per-target admin endpoints in a loop rather than separate bulk API routes -- fine at the scale this tool actually runs at. Reset/Delete/Pause each confirm the count and consequence before running.
- Responsive down to phone-width screens -- the row-based lists stack vertically and tables scroll horizontally below 640px, instead of squeezing everything into one line.
- **Admin API** (`/admin/api/*`) -- the same operations as the UI, as plain JSON endpoints, for scripting.
- **Telegram + email push notifications** -- on a state change (up→down or down→up) the Worker sends a Telegram message and a styled HTML email in parallel; each channel is independent (one failing doesn't block the other), and either can be left unconfigured to disable it.

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
   `migrations/0001_init.sql` creates the `checks` table. `0002_targets_and_latency.sql` adds the `targets` table (seeded with example rows -- edit/delete them from the admin UI after deploying) and latency tracking. `0003_tags_and_notes.sql` adds tags/notes. `0004_monitor_types.sql` adds the `type`/`config` columns for HTTP and DNS monitors. `0005_fail_reason.sql` adds the failure-reason column used on the Incidents page.

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

8. **(Optional) Enable email notifications too, via [Resend](https://resend.com):**
   - Sign up (free tier) and generate an API key.
   - Set your API key and destination email as secrets:
     ```bash
     echo "your-resend-api-key" | wrangler secret put RESEND_API_KEY
     echo "your-email@example.com" | wrangler secret put OWNER_EMAIL
     ```
   - (Optional) `RESEND_FROM` -- a custom "from" address, requires verifying a domain in Resend first. Defaults to Resend's sandbox sender (`onboarding@resend.dev`), which works without any domain verification.
   - Email addresses are validated strictly by Resend -- if you get a `422 ... non-ASCII characters` error, a stray invisible character snuck into `OWNER_EMAIL` during copy/paste; re-set it by typing it fresh.
   - Telegram and email are independent -- set up one, both, or neither.

That's it -- no server, no container, no always-on machine required.

## Notes / limitations

- **Port checks are TCP-only.** They confirm "does the port accept a connection," not "does the application behind it work correctly." HTTP checks fill that gap for websites/APIs; Port stays right for proxies, SSH, databases, etc.
- **D1 write volume.** Every check writes a row (by design, for full history) -- fine at the free tier's limits for a handful of targets checked every minute, but if monitoring many targets very frequently, consider checking less often or only writing on state change.
- **Silent notification failures are a real risk with any webhook-style integration.** Don't swallow errors with a bare `.catch(() => {})` on the notify call -- log the response status/body on failure, or a broken notification channel can go unnoticed indefinitely (this happened once already in this project, see the ntfy.sh note above).
- **Server-side validation must account for type-specific sentinels.** `port: 0` is a valid, intentional value for non-Port monitors (meaning "not applicable") -- a naive `!body.port` truthiness check rejects it, since `0` is falsy in JS. Hit this for real when HTTP monitors silently failed to save; fixed by checking `port` requiredness only when `type === "port"`.
- **A monitor with zero check history shows "Pending," not "Down."** Defaulting an unchecked target to "Down" is actively misleading -- looked like a bug (working site shown as down) until traced to just being the ~1-minute window before the first cron tick.
- **Single vantage point.** Checks always run from wherever Cloudflare schedules Cron Triggers (not distributed across regions the way a paid UptimeRobot plan is) -- fine for "is this reachable at all," not meant to detect region-specific network issues.
- **Admin auth is a single shared token**, not per-user accounts. Fine for personal use; if this ever needs multiple people with different access levels, that would need real auth (e.g. Cloudflare Access) instead.
- **Notification timestamps are hardcoded to `Australia/Brisbane`** (`src/time.js`) for this deployment. If you reuse this Worker for a project in a different timezone, change the `timeZone` there -- Brisbane specifically never observes daylight saving, so the "AEST" label is hardcoded too; a DST-observing timezone would need to compute the correct abbreviation instead of hardcoding one.
- **All HTML responses send `Cache-Control: no-store`.** Hit real stale-page confusion twice (a fix was live and verified server-side via `curl`, but a browser/mobile-Safari kept serving an old cached copy and it looked like the fix hadn't deployed) -- for a low-traffic personal admin tool there's no real cost to disabling caching outright.
- **Row selection for bulk actions doesn't persist across re-renders.** Typing in the search box or completing a bulk action re-renders the whole list and clears any checkboxes -- a deliberate simplicity tradeoff, not a bug, given this tool's actual scale (a handful to a few dozen monitors).
