# Incident: D1 daily row-read quota exhausted

**First occurrence:** 2026-09-06
**Recurrence:** 2026-09-07 (quota exceeded again, notified 2026-09-08 ~00:13 UTC)
**Recurrence:** 2026-09-08 (self-inflicted by debugging, see Round 3.5 -- no code change needed)
**Status:** Resolved 2026-09-09 with rollup tables (Round 4) replacing the read-heavy pattern
directly, not just bounding it further, and closed out (Round 5) by removing the
last unbounded raw-checks scan and cutting checks retention from 400 days to 7

## Impact

Cloudflare's D1 free tier caps an account at 5,000,000 rows read per day, **shared
across every D1 database on the account** (10 databases at the time of this
incident), not per-database. When this app exhausted that shared quota, every
other D1-backed project on the same account broke too — in particular
`links.1000600.xyz` (an unrelated bookmark manager), which started returning
`error code: 1101` on every request with no code change of its own.

## What happened, in order

### Round 1 — 2026-09-06

`allIncidents()` (`src/db.js`), which powers the public `/incidents` page,
called:

```js
incidents(db, t.id, 0)
```

`sinceMs = 0` — since epoch. Every view of `/incidents` did a full-history
scan of the `checks` table, per target, unauthenticated, uncached. As
`checks` grew (a row roughly every ~70s per target, from the `scheduled()`
cron), each view got more expensive, until the account read ~11M rows in a
single day and got locked out.

Confirmed via Cloudflare's D1 query insights: one normalized query —

```sql
SELECT is_up, checked_at, fail_reason FROM checks
WHERE target_id = ? AND checked_at > ? ORDER BY checked_at ASC
```

— was 76.6% of the database's runtime and 10.49M of the ~11M rows read that
day (167 calls, ~63,000 rows/call average).

**Fix shipped (commit `f752821`):**
- Bounded `allIncidents()`'s scan to `Date.now() - YEAR` instead of `0`.
- Deduped `buildDetailData()`'s four separate `incidents()` calls
  (day/week/month/year, each independently re-querying) into one raw-checks
  fetch for the widest window, with narrower windows grouped from that same
  result in memory.

Filed and closed as [zzpy20/status#1](https://github.com/zzpy20/status/issues/1).

### Round 2 — 2026-09-07 (the fix from round 1 wasn't enough)

The account exceeded the same quota again the very next UTC day. Root cause
of *this* recurrence: **the round-1 fix was a no-op the moment it shipped.**

`checks` was only ~2 months old on 2026-09-06 (oldest row: 2026-07-06,
confirmed via `SELECT MIN(checked_at) FROM checks`). Bounding a query to "the
last year" does nothing when the entire table is younger than a year —
`checked_at > (now - YEAR)` matched every single row, identical to the
original `sinceMs = 0` bug. The fix looked correct in code review but wasn't
actually bounded in practice.

Confirmed via `wrangler d1 insights status-uptime --time-period=2d`: the same
query shape read **4.87M rows over 2 days**, averaging ~71,600 rows/call
across 68 calls — worse per-call than round 1, because `buildDetailData()`'s
dedup fix (correctly) collapsed its four windows into always-the-widest
(year) fetch, and `statusRows()` — the *most-visited* route (`/` and
`/api/status`) — was still scanning the same effectively-unbounded window on
every single homepage view.

Direct measurement at time of the second fix:
- 8 targets, 585,507 total rows in `checks`, spanning ~62 days.
- A single `statusRows()` render (loops all targets) cost ~585K rows — i.e.
  nearly the *entire table* in one homepage load. At the account's shared
  5M/day budget, well under 10 homepage views alone could exhaust it.

**Fix shipped (commit range ending `09af6d8c`):**

1. **Actually-bounded time windows**, sized to be meaningfully smaller than
   the table's current *and future* size rather than nominally smaller than
   an arbitrary constant:
   - `statusRows()`'s "last confirmed incident" lookup: `YEAR` → `WEEK`.
     This is the highest-frequency route (backs `/` and `/api/status`), so
     it gets the smallest window.
   - `allIncidents()` (the `/incidents` page): `YEAR` → `MONTH`.
2. **Removed a second redundant full-year scan**: `buildDetailData()` was
   still calling `db.uptimeStats(env.DB, id, now - YEAR)` as a *separate* DB
   round trip even after the round-1 dedup, duplicating data already fetched
   via `rawChecksSince()` for the year-window incidents computation.
   `uptime365d` is now derived from that same in-memory result.
3. **Edge caching** (`withEdgeCache()` in `src/index.js`), defense in depth
   against traffic volume rather than per-call cost: `/`, `/api/status`,
   `/monitor/:id`, and `/incidents` now cache their computed response on
   Cloudflare's Cache API for 20 seconds — shorter than the 1-minute check
   interval, so it can't show stale data in any way that matters. This is
   deliberately *not* the same thing as the browser-caching bug referenced in
   `HTML_HEADERS`'s comment (`no-store` bit us twice before): the client
   always receives `Cache-Control: no-store`, so nothing is cached in the
   browser — only Cloudflare's edge, and only for 20 seconds. A debug
   `X-Edge-Cache: HIT|MISS` header was added and used to directly verify the
   behavior (first request MISS, immediate follow-ups HIT) before considering
   this fixed.

## Why this took two rounds

The round-1 fix addressed the most *obviously* wrong thing (`sinceMs = 0`,
an unmistakable bug) but didn't question whether the replacement bound
(`YEAR`) was actually a bound *given the table's real state*. "Recently
uncapped" and "capped at a number larger than the current data" produce
identical behavior — the fix needs to move the cap below the *current*
size, not just add a number where there wasn't one. This wasn't caught
before shipping round 1 because the fix wasn't measured against the actual
table size, just checked for logical correctness.

## Round 3 — retention policy (2026-09-08, same day as round 2)

The bounded queries (WEEK/MONTH) stay cheap regardless of total table size —
that's the whole point of bounding by time instead of needing a cleanup job.
But two things still scaled with the table's total size, unbounded, forever:

- `buildDetailData()`'s deliberate, labeled 365-day uptime/incidents stat
  (correctly not time-bounded down — it's supposed to show a full year), so
  its cost would keep growing until the table passed a year old and then
  stabilize around ~4M+ rows — high but bounded, protected by the 20s edge
  cache, but still a permanently-rising number until it hit that ceiling.
- `checks` itself, growing forever with no cleanup, at roughly one row per
  target per check interval (~9,400 rows/day account-wide as of this
  writing). Nothing was actively wrong yet, but "grows forever" is exactly
  the shape of thing that turns into a future version of this same incident,
  the moment anything reads it without a sufficiently tight bound.

**Fix shipped:**

- **`pruneOldChecks(db, beforeMs, batchSize = 5000)`** (`src/db.js`): deletes
  rows older than a cutoff in batches, via
  `DELETE FROM checks WHERE id IN (SELECT id FROM checks WHERE checked_at <
  ? LIMIT ?)`, looping until a batch comes back under `batchSize`. Batched
  rather than one unbounded `DELETE`, so even a large backlog can't itself
  become a rows-written/read spike in one shot — the same failure shape
  this whole incident already demonstrated once.
- **Migration `0007_checks_retention_index.sql`**: adds
  `idx_checks_checked_at`. The existing `idx_checks_target_id_time` has
  `target_id` as its leading column, so a plain `checked_at < ?` predicate
  with no `target_id` filter can't use it — without this new index, the
  retention delete itself would fall back to a full table scan. Applied to
  the remote DB (one-time cost: ~585K rows read to build it, same order of
  magnitude as a single pre-fix homepage view) before deploying the code
  that depends on it.
- **Retention window: 400 days** (`CHECKS_RETENTION_MS` in `src/index.js`)
  — a year plus a month of margin, so it never conflicts with the
  legitimate 365-day stat. Confirmed via direct query against the live table
  that 0 rows currently match (oldest row is ~62 days old), so the first
  real prune won't run until roughly mid-2027 and even then only trims the
  small daily overflow, not a backlog.
- **Runs once a day, not on a new cron trigger.** This Cloudflare account is
  already at the free plan's 5-cron-trigger cap (see
  `Shenzhen-Reality/README.md`), the same constraint that's why
  `dns-drift-sync.js` lives inside this Worker's cron instead of its own.
  `scheduled()`'s existing `*/1 * * * *` trigger now also checks
  `event.scheduledTime` and only calls `pruneOldChecks()` on the one
  minute-tick per day where the UTC hour is 3 and the minute is 0.

## Round 3.5 — the quota was exceeded a 4th time (2026-09-08), self-inflicted

Hours after round 3 shipped, the account hit the same quota again
(Cloudflare's notification arrived 2026-09-09 ~00:13 UTC, for the exceedance
during the 2026-09-08 UTC day). Investigated via `wrangler d1 insights
status-uptime --time-period=1d`: **4,992,867 rows read that day, right at
the ceiling** -- but the breakdown showed this was overwhelmingly
self-inflicted by the debugging process itself, not a remaining application
bug:

- Two manual `SELECT COUNT(*)/MIN(checked_at)/MAX(checked_at) FROM checks`
  diagnostic queries (run while sizing the retention window for round 3):
  **1,756,521 rows** -- 35% of the entire day's budget, from 3 commands.
- The round-3 fix's own bounded queries (now WEEK/MONTH-scale, not
  effectively-unbounded YEAR-scale): ~2.8M rows from legitimate application
  traffic -- consistent with the per-call cost already having dropped
  ~82% (71,600 -> 12,847 avg rows/call), just multiplied by a lot of
  verification requests during the same session.

No code change resulted from this round -- the fix already shipped was
correct; the lesson was procedural: **checking a table's actual size to
design a fix (as round 2's postmortem recommended) itself costs rows, and a
`COUNT(*)`/`MIN()`/`MAX()` over the full table is exactly as expensive as
the bug being fixed.** Worth using `wrangler d1 insights` (aggregated
analytics, doesn't consume the rows-read quota) over ad hoc `SELECT COUNT(*)`
diagnostics against the live table when sizing a fix, and expecting that any
live debugging against production D1 data during an active quota-sensitive
incident has a real cost that should be budgeted for, not assumed free.

## Round 4 — rollup tables (2026-09-09): fixing the actual design pattern

Rounds 1-3 bounded *how much* raw history each query could scan and *how
often* it could run, but left the underlying pattern unchanged: every page
view recomputed uptime %, latency stats, and incident lists from scratch by
scanning raw `checks` rows in the requested window. That cost is
proportional to how much history has accumulated, not to how much actually
changed -- a status page costs the same to render whether nothing happened
that week or ten things did. That's fine at small scale and gets
proportionally worse forever, which is why rounds 1-3 kept needing to
re-tighten the same knob.

**Fix:** two new tables, populated incrementally instead of recomputed on
read (migration `0008_rollups.sql`):

- **`daily_stats`** -- one row per (target, UTC day): `up_count`,
  `down_count`, `latency_sum/count/min/max`. `insertCheck()` upserts the
  current day's row on every check (batched with the `checks` insert, one
  D1 round trip, atomic). `uptimeStatsFast()`/`latencyStatsFast()` sum the
  rollup rows for every *complete* day in a window, plus a raw scan of just
  *today's* still-accumulating checks for up-to-the-minute accuracy. This
  rounds a window's start down to a whole UTC day (so "last 7 days" might
  actually cover a few hours more than exactly 168h) -- inconsequential for
  a percentage stat, in exchange for turning an O(days-in-window x
  checks/day) scan into O(days-in-window) rollup rows + O(checks today).
  Still used for the DAY window: `uptimeStats()`/`latencyStats()` keep
  reading raw `checks` directly there, since that's already cheap
  (~1,200 rows/target) and it's the one window where precision -- "right
  now", not a settled period -- actually matters.
- **`incidents`** -- one row per *actual incident* (a handful per target a
  year, not one row per check). `runChecks()` (`index.js`) now calls
  `db.openIncident()`/`db.closeIncident()` directly at the exact moment it
  confirms a state transition (the same debounce check it already ran for
  Telegram/email notifications), instead of every future page view
  reconstructing incident boundaries by replaying raw checks through
  `groupIncidents()`'s state machine. Verified the write-time logic exactly
  reproduces `groupIncidents()`'s existing semantics (down confirmed on the
  2nd consecutive failure, backdated to the 1st; recovery confirmed and
  closed on the 1st success) before relying on it as the sole source of
  truth. `recentIncidents()`/`lastIncidentEnd()`/`allIncidents()` now read
  this table directly -- cheap and exact for any window, indefinitely,
  regardless of how large `checks` ever gets.

**Backfill:** `daily_stats` was backfilled with a single SQL
`INSERT ... SELECT ... GROUP BY` in the migration itself (one full read of
`checks` -- unavoidable for a from-source rebuild, but one-time). Hit one
snag applying it: `checked_at`'s `target_id` is nullable, and 50 legacy
checks (pre-dating migration 0002's target_id backfill) had `target_id IS
NULL`, which violated `daily_stats.target_id`'s `NOT NULL` constraint --
migration failed and rolled back cleanly (D1 migrations run as a
transaction), fixed by excluding `target_id IS NULL` rows, then reapplied
successfully. `incidents` couldn't be backfilled with plain SQL (the
debounce state machine isn't a GROUP BY), so a temporary admin-auth-gated
`POST /admin/api/rebuild-incidents` endpoint replays `groupIncidents()`
against full raw history once per target and bulk-writes the result;
left in place (not removed) as a documented, safe-to-rerun utility --
always wipes and rebuilds rather than incrementing, so it can't
double-count if triggered again.

**Also fixed while touching this:** `resetTarget()`/`deleteTarget()` only
cleared `checks`, which would have left stale `daily_stats`/`incidents`
rows behind after a reset -- now clear all three tables together.

**Verified, not assumed:** after deploying, compared `wrangler d1 insights`
call counts immediately before and after a batch of test requests. The old
expensive query (`SELECT is_up, checked_at, fail_reason FROM checks
WHERE...`, the one that cost ~71,600 rows/call at its worst) had **zero new
calls** from any of the four public routes -- confirming it's fully
replaced on every live read path, not just supplemented. The backfill wrote
38 real historical incidents across 8 targets (587K raw checks scanned to
produce them), matching spot-checks against individual monitor pages.

**Remaining headroom, not yet acted on:** `CHECKS_RETENTION_MS` (400 days,
round 3) was sized around raw `checks` needing to back the legitimate
365-day stat directly. That's no longer true -- `daily_stats` and
`incidents` now retain that history durably and independently of raw
`checks`. Raw history is only still needed for `findStateSince()` (how long
a target's been in its current state, unbounded lookback) and the last
~1-2 days for the rollup functions' "today" blending. Retention could
likely be shortened substantially without losing anything the app
currently surfaces, except `findStateSince()` would report "unknown"
instead of a true (very old) transition time for a target that's been
stable longer than the retention window -- a real but narrow trade-off,
not evaluated further here.

## Round 5 — closing the last gap: `state_since` + a write-quota guard (2026-09-09)

Round 4 left one function still doing an unbounded raw-checks scan:
`findStateSince()` ("stable since X"), which looked for the most recent
opposite-state check with no time bound at all. It was the reason
`CHECKS_RETENTION_MS` was kept at 400 days -- shrinking retention further
would have made it start reporting "unknown" for any long-stable target.

**Fix:** `targets.state_since` (migration `0009_state_since.sql`), updated
by `openIncident()`/`closeIncident()` at the exact same moment they already
write -- the instant a transition is confirmed *is* the answer to "since
when", so no separate scan is needed at all. Backfilled in the same
`rebuild-incidents` pass (it already computes each target's incident list;
`state_since` is just that list's last boundary -- its start if still
ongoing, else its end). `findStateSince()` deleted outright.

With that gap closed, nothing in the live app depends on raw `checks` older
than about a day (the DAY-window stats, and the rollup functions' "today"
blending). `CHECKS_RETENTION_MS`: 400 days -> `WEEK`, a >50x reduction,
with no loss -- not even the narrow edge case Round 4 flagged.

**Caught before it shipped, not after:** shrinking retention that much in
one step meant the very next scheduled prune would try to delete the
~520,000-row backlog (everything older than a week, out of ~587K total) in
a single run. `pruneOldChecks()` had no cap on total deletions per
invocation -- only on delete-loop batch size (5,000) -- so it would have
kept looping until fully caught up, trying to delete ~10x D1's free-tier
100,000-rows-written daily cap in one shot. Same failure shape as this
entire incident chain, just on the write side instead of the read side.
Added a `maxTotal` cap (50,000/invocation, well under the write quota,
leaving room for the day's normal check inserts) before deploying the
retention change -- a large backlog now works itself down over ~11 nights
instead of all at once. Deployed the migration, code, and this guard
together; verified all four public routes still return 200 and that
`state_since` renders correctly (a real backfilled value, e.g. "since 45d
ago", and a graceful blank for a target that's never had a confirmed
incident) before considering it done.

## Round 6 — hardening the sibling project + a proactive alert (2026-09-09)

Everything above fixed `status` itself. Two things were still true afterward:
`links-db` (a completely unrelated project, `my-links-app`) shares this same
account-wide quota and had the *same shape* of bug -- unbounded full-table
scans on page-load-frequency routes, just cheap today because its table is
small; and Cloudflare has **no built-in proactive alert for D1 usage at
all** (checked directly in the dashboard's Notifications settings --
"Usage Based Billing" alerts only cover R2 Storage). Every one of the
rounds above was discovered the same way: after the fact, via Cloudflare's
"you're now blocked" email.

**`my-links-app` hardening** (that repo's own commit, not this one):
`public-worker` (the public read-only view) ran its DB query unconditionally
for *every* request, any path, unauthenticated -- fixed to only run for
`GET /`, plus the same short edge-cache pattern used here. `worker` (the
admin app): `/tags`, `/tags-admin`, `/collections-data` all scan the whole
`links` table with no `LIMIT` on every page load -- same shape as this
incident's root cause, currently cheap only because that table is small.
Added the same edge-cache pattern (session-aware, since two of the three
vary by an `unlocked` cookie -- a cached response from one lock state can't
leak into the other), removed `/collections-data`'s per-request
`CREATE TABLE`/`ALTER TABLE` (confirmed live that both already exist), and
clamped `GET /links`'s previously-uncapped `perPage` parameter.

**Proactive D1 usage monitor** (`src/usage-monitor.js`, migration
`0010_usage_alerts.sql`): queries Cloudflare's GraphQL Analytics API
(`d1AnalyticsAdaptiveGroups`) every 15 minutes -- piggybacked on the
existing cron via the same `% 15 === 0` gate pattern as the other jobs, not
a new trigger -- for today's account-wide `rowsRead`/`rowsWritten` across
every D1 database on the account. Sends one Telegram alert per UTC day
(deduped via a tiny `usage_alerts` table) if either crosses 70% of the
free-tier cap, naming the top databases by usage so the alert is
immediately actionable. This call itself doesn't touch D1 at all -- it's a
separate Analytics API, doesn't consume any of the quota it's watching.

Required a new, narrowly-scoped Cloudflare API token (`D1_USAGE_TOKEN`
secret) -- Account Analytics: Read only, nothing else -- created via the
dashboard. (First attempt at capturing the token value from a screenshot
was subtly wrong on ambiguous characters and came back "Invalid API
Token"; rolled it and re-captured via the page's DOM text instead of
visual reading, which resolved it.)

**Verified, not assumed:** used the GraphQL API directly via `curl` first
to confirm the query shape and available fields before writing any Worker
code against it. After deploying, confirmed the real `scheduled()` handler
executed the check at the correct `:45` tick with no exceptions (via
`wrangler tail`), and cross-checked its computed usage against a direct
query at the same moment (69.4% read quota used, correctly under the 70%
alert threshold -- consistent with no alert firing). Kept the read-only
`GET /admin/api/check-d1-usage` debug endpoint as a permanent small utility
rather than removing it, since it's genuinely useful for checking current
usage by hand.

## Round 7 — deduping the redundant "today" scan (2026-09-09)

While explaining the app's data model in plain terms (how many rows a
50-100 target deployment would read/write per day), found that
`buildDetailData()` (`/monitor/:id`) was still re-scanning essentially the
same raw `checks` rows up to 6 times per page view: `uptimeStats`/
`latencyStats` (24h), `latencySeries` (chart), and -- inside
`uptimeStatsFast`/`latencyStatsFast` -- a fresh "today so far" query for
*each* of the week/month/year windows, none of them sharing results with
each other. An oversight left over from the Round 4 rollup rewrite, which
deduped the *incidents* side of this same problem but not the *uptime/
latency* side.

**Fix:** `recentRawChecks()` fetches `checked_at > now - DAY` once (this
range is always a superset of "today so far", since today's start is never
more than 24h in the past). `uptimeFromRows()`/`latencyFromRows()`/
`latencySeriesFromRows()` derive the 24h stats and chart from that same
array in memory. `uptimeStatsFastFromRows()`/`latencyStatsFastFromRows()`
take it too, filtering internally to just today's slice before combining
with each window's `daily_stats` rollup sum -- filtered *inside* the
function rather than trusted from the caller, so passing the wider
`now - DAY` array in can't silently double-count yesterday's tail against
the rollup (which already includes all of yesterday as a complete day) --
caught and fixed before deploying, not after.

Cuts `buildDetailData()` from up to 6 raw-checks scans per page view down
to 1. Verified: rendered figures on `/monitor/1` (uptime %, incident
counts, "since Nd ago") matched the exact values recorded before this
change byte-for-byte, and `wrangler tail` showed zero exceptions on a
fresh request -- stronger evidence than `wrangler d1 insights`, whose
discovery of brand-new query shapes lagged past waiting.

**Why this came up now:** answering "would 50-100 targets blow the
quota?" honestly required doing the write-volume math (~2 rows written
per target per check -- linear in target count, crosses the 100K/day
write cap around 35 targets checked every minute) and re-examining the
read side for exactly this kind of per-view redundancy, rather than just
asserting the app was scale-proof.

## Round 8 — the write-quota monitor fired for real, and a wrong tool led to a wrong answer first (2026-09-10)

The Round 6 usage monitor sent its first real alert: 71% of the account's
100K/day write cap used by 13:31 UTC. Investigating it surfaced a
methodology mistake worth recording, not just the underlying cause.

**The mistake:** asked "what's driving the write count high" the prior
day, and answered it using `wrangler d1 insights --time-period=1d`,
assuming that meant "today, since midnight UTC." It doesn't -- it's a
*rolling* 24-hour window. Extrapolating a partial calendar day's total as
if the tool's number were also partial (dividing by hours-elapsed,
multiplying by 24) roughly doubled an already-complete number, producing
confidently wrong numbers to the user. Caught by cross-checking against
the authoritative source (the same GraphQL `d1AnalyticsAdaptiveGroups`
query `usage-monitor.js` itself uses, filtered by calendar `date`, which
*is* aligned with the quota's actual UTC-midnight reset) and against
`COUNT(*)` ground truth queried directly from `checks` for the real
calendar day. Lesson: `wrangler d1 insights`'s time windows are rolling,
not calendar-aligned, and don't match what the quota itself resets against
-- useful for relative/exploratory comparisons, not for answering "how
much of today's quota is used."

**The actual cause, confirmed against ground truth:** 3,256 checks
recorded so far that calendar day (indexed `COUNT(*)` query, unambiguous)
-- entirely normal, matching the 4 currently-active targets at a ~1/minute
cadence. That's only ~19,500 of the expected write cost. The other ~50,000
was `pruneOldChecks()`'s nightly run hitting its 50,000-row cap -- expected
and by design, but a reminder that the Round 5 retention cut (400 days ->
7) left a real backlog (`checks`' oldest row was still 2026-07-14, 58 days
old) that takes multiple nights of capped deletion to clear, and each of
those nights runs close to the daily write cap until it does.

**Decision:** rather than let the backlog clear passively over the
original ~11-night estimate, or delete it all in one shot (worked out to
roughly 5x a single day's entire write budget, checked before proposing it
-- see the ground-truth count above), raised `pruneOldChecks()`'s nightly
cap from 50,000 to 65,000 (`src/db.js`). At ~35,000/day measured organic
writes, that totals exactly the 100K/day cap -- deliberately tight, not
comfortable margin, traded for finishing in ~8 nights instead of ~11, with
the Round 6 monitor as the safety net if organic writes run higher than
measured on any given day. Should be lowered back toward 50,000 (or
lower) once `checks`' oldest row is within the 7-day retention window
again -- at that point there's no more backlog to clear and 65,000/night
of headroom is just unnecessary risk for no benefit.

## Follow-ups still open

- **`pruneOldChecks()`'s 65,000/night cap (Round 8) should be lowered back
  down once the backlog clears** -- check `SELECT MIN(checked_at) FROM
  checks` periodically; once it's within ~7 days of now, the elevated cap
  is no longer buying anything and is just unnecessary daily risk.
- **Shared account-wide quota.** 5M rows/day is shared across all 10 D1
  databases on this account. A future project with the same class of bug
  would break every other project again, `status` included -- mitigated
  but not eliminated by the Round 6 monitor (it warns at 70%, it doesn't
  prevent the underlying query from running). Worth checking new D1-backed
  projects for unbounded time-window queries before they ship.
- **The D1 paid tier** ($5/month minimum -> 25 billion rows read + 50M
  written per month) was considered and deliberately deferred, not
  rejected -- it would retire this entire risk category outright, at a
  cost that's trivial next to the time this chain of incidents has taken
  to fix properly. Worth revisiting.
- **Write volume scales linearly with target count and check frequency,
  unaddressed.** At the current 1-check-per-minute cadence, each target
  writes ~2 rows/check (`checks` + `daily_stats`) -- ~23,000 writes/day
  account-wide at 8 targets (23% of the 100K/day free-tier write cap), but
  that crosses the cap entirely around **35 targets** checked every
  minute, with no other change. Unlike everything fixed in rounds 1-7,
  this isn't a bug -- it's a real, linear resource cost of the check
  frequency and target count you actually choose. Only relevant if
  `status` grows well past its current 8 targets; not touched, since it
  isn't a defect to fix, just a ceiling to know about (checking less
  often, e.g. every 5 minutes, raises it roughly 5x).
