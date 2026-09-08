# Incident: D1 daily row-read quota exhausted

**First occurrence:** 2026-09-06
**Recurrence:** 2026-09-07 (quota exceeded again, notified 2026-09-08 ~00:13 UTC)
**Status:** Resolved 2026-09-08 (deploy `09af6d8c`)

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

## Follow-ups still open

- **No retention policy.** `checks` is never pruned, so it grows forever.
  The bounded queries (WEEK/MONTH) stay cheap regardless of total table
  size — that's the point of bounding by time rather than needing a
  cleanup job. But `buildDetailData()`'s deliberate, labeled 365-day
  uptime/incidents stat is *not* time-bounded down (it's supposed to show a
  full year), so its cost will keep growing until the table is a year old
  (at which point it stabilizes around ~4M+ rows total, since older rows
  fall out of its own YEAR window) — high but bounded, and now protected by
  the 20s edge cache. Worth revisiting if that stat's cost becomes an issue
  once the table passes the 1-year mark.
- **Shared account-wide quota.** 5M rows/day is shared across all 10 D1
  databases on this account. A future project with the same class of bug
  would break every other project again, `status` included. Worth checking
  new D1-backed projects for unbounded time-window queries before they ship,
  or considering the D1 paid tier if this keeps being a risk.
