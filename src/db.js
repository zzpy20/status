const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

// Groups consecutive is_up=0 rows (in chronological order) into incidents.
// A lone failed check is treated as noise, same as confirmedIsUp() below --
// an incident is only confirmed once a second consecutive failure follows,
// at which point its "start" is backdated to that first failed check (it
// really was down from then, the second check just confirmed it wasn't a
// blip). An incident's "end" is the timestamp it was next confirmed back up
// (or "now" if still ongoing) -- using the last down check's own timestamp
// would understate an incident's duration by up to one check interval. Each
// incident's "reason" is the fail_reason of the check that started it --
// what triggered the outage, not every reason seen during it if it changed.
//
// No longer used on any live read path -- runChecks() (index.js) now calls
// openIncident()/closeIncident() directly at the moment a transition is
// confirmed, and reads go through recentIncidents()/allIncidents() further
// down, both backed by the resulting `incidents` table instead of replaying
// raw checks through this state machine on every request. Kept exported
// because it's the proven-correct reference implementation of the debounce
// logic, reused by the one-off historical backfill in admin.js -- see
// docs/incidents/2026-09-06-d1-quota-exhaustion.md.
export function groupIncidents(rows) {
    const out = [];
    let current = null;
    let pendingFail = null; // first failed check of a streak, not yet confirmed
    for (const row of rows) {
        if (row.is_up === 0) {
            if (current) {
                current.end = row.checked_at;
            } else if (pendingFail) {
                current = { start: pendingFail.checked_at, end: row.checked_at, reason: pendingFail.reason };
                pendingFail = null;
            } else {
                pendingFail = { checked_at: row.checked_at, reason: row.fail_reason };
            }
        } else {
            if (current) {
                current.end = row.checked_at;
                out.push(current);
                current = null;
            }
            pendingFail = null;
        }
    }
    if (current) {
        current.end = Date.now();
        current.ongoing = true;
        out.push(current);
    }

    const totalDownMs = out.reduce((sum, i) => sum + (i.end - i.start), 0);
    return { list: out, count: out.length, totalDownMs };
}

function parseTarget(row) {
    if (!row) return row;
    let config = {};
    try { config = row.config ? JSON.parse(row.config) : {}; } catch { config = {}; }
    return { ...row, config };
}

// Shared by the public status page/API and the admin UI, so both always
// show the same real up/down state -- the admin list previously only knew
// about paused/not-paused and never looked at actual check results.
export async function statusRows(db) {
    const now = Date.now();
    const targets = await listTargets(db);
    return Promise.all(targets.map(async (t) => {
        const recent = await recentChecks(db, t.id);
        const last = recent[0] ?? null;
        const uptime24h = await uptimeStats(db, t.id, now - DAY);
        const uptime7d = await uptimeStatsFast(db, t.id, now - WEEK);
        // Last *confirmed* incident, not just the last lone failed check --
        // otherwise a single blip that never became a real incident still
        // shows up here, contradicting the incidents list on the detail page.
        // Reads the incidents table directly (see lastIncidentEnd below),
        // not a windowed scan of raw checks -- that table is tiny and
        // indexed by construction (one row per real incident, not one per
        // check), so there's no cost trade-off in showing the *true* most
        // recent incident here instead of only ones within an arbitrary
        // window. See docs/incidents/2026-09-06-d1-quota-exhaustion.md.
        const lastDown = await lastIncidentEnd(db, t.id);
        return {
            id: t.id,
            name: t.name,
            type: t.type,
            host: t.host,
            port: t.port,
            config: t.config,
            paused: t.paused,
            pinned: t.pinned,
            tags: t.tags,
            notes: t.notes,
            is_up: confirmedIsUp(recent),
            checked_at: last ? last.checked_at : null,
            uptime_24h: uptime24h.pct,
            uptime_7d: uptime7d.pct,
            last_down: lastDown,
        };
    }));
}

export async function listTargets(db, { includePaused = true } = {}) {
    const sql = includePaused
        ? "SELECT * FROM targets ORDER BY pinned DESC, id"
        : "SELECT * FROM targets WHERE paused = 0 ORDER BY pinned DESC, id";
    const { results } = await db.prepare(sql).all();
    return results.map(parseTarget);
}

export async function getTarget(db, id) {
    return parseTarget(await db.prepare("SELECT * FROM targets WHERE id = ?").bind(id).first());
}

export async function createTarget(db, { name, host, port, type, tags, notes, config }) {
    const { meta } = await db.prepare(
        "INSERT INTO targets (name, host, port, type, paused, tags, notes, config, created_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)"
    ).bind(name, host, port || 0, type || "port", tags || null, notes || null, config ? JSON.stringify(config) : null, Date.now()).run();
    return getTarget(db, meta.last_row_id);
}

export async function updateTarget(db, id, { name, host, port, type, tags, notes, config }) {
    await db.prepare(
        "UPDATE targets SET name = ?, host = ?, port = ?, type = ?, tags = ?, notes = ?, config = ? WHERE id = ?"
    ).bind(name, host, port || 0, type || "port", tags || null, notes || null, config ? JSON.stringify(config) : null, id).run();
    return getTarget(db, id);
}

export async function deleteTarget(db, id) {
    await db.batch([
        db.prepare("DELETE FROM checks WHERE target_id = ?").bind(id),
        db.prepare("DELETE FROM daily_stats WHERE target_id = ?").bind(id),
        db.prepare("DELETE FROM incidents WHERE target_id = ?").bind(id),
        db.prepare("DELETE FROM targets WHERE id = ?").bind(id),
    ]);
}

// Wipes check history for one target (uptime %, incidents, latency stats
// are all computed from `checks`/`daily_stats`/`incidents`, so this alone
// is a full "start fresh") without touching the target's own
// config/tags/notes. Must clear all three tables together -- leaving
// daily_stats or incidents behind after wiping checks would show stale
// aggregated stats that raw history no longer backs up.
export async function resetTarget(db, id) {
    await db.batch([
        db.prepare("DELETE FROM checks WHERE target_id = ?").bind(id),
        db.prepare("DELETE FROM daily_stats WHERE target_id = ?").bind(id),
        db.prepare("DELETE FROM incidents WHERE target_id = ?").bind(id),
    ]);
}

export async function setPaused(db, id, paused) {
    await db.prepare("UPDATE targets SET paused = ? WHERE id = ?").bind(paused ? 1 : 0, id).run();
    return getTarget(db, id);
}

export async function setPinned(db, id, pinned) {
    await db.prepare("UPDATE targets SET pinned = ? WHERE id = ?").bind(pinned ? 1 : 0, id).run();
    return getTarget(db, id);
}

// checkedAt is passed in (rather than computed here with Date.now()) so
// runChecks() can use the exact same timestamp for the checks row, the
// daily_stats bucket, and -- when this check confirms an incident starting
// or ending -- the incidents row, instead of three slightly different
// Date.now() calls racing each other.
export async function insertCheck(db, target, isUp, latencyMs, reason, checkedAt) {
    const day = Math.floor(checkedAt / DAY) * DAY;
    const upCount = isUp ? 1 : 0;
    const downCount = isUp ? 0 : 1;
    const latencySum = latencyMs ?? 0;
    const latencyCount = latencyMs != null ? 1 : 0;
    // Batched (one D1 round trip, atomic) rather than two separate awaits --
    // the checks row and its daily_stats bucket should never end up
    // inconsistent with each other.
    await db.batch([
        db.prepare(
            "INSERT INTO checks (target, target_id, host, port, is_up, latency_ms, fail_reason, checked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(target.name, target.id, target.host, target.port, isUp ? 1 : 0, latencyMs, isUp ? null : (reason || null), checkedAt),
        db.prepare(
            `INSERT INTO daily_stats (target_id, day, up_count, down_count, latency_sum, latency_count, latency_min, latency_max)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(target_id, day) DO UPDATE SET
                up_count = up_count + excluded.up_count,
                down_count = down_count + excluded.down_count,
                latency_sum = latency_sum + excluded.latency_sum,
                latency_count = latency_count + excluded.latency_count,
                latency_min = MIN(COALESCE(latency_min, excluded.latency_min), COALESCE(excluded.latency_min, latency_min)),
                latency_max = MAX(COALESCE(latency_max, excluded.latency_max), COALESCE(excluded.latency_max, latency_max))`
        ).bind(target.id, day, upCount, downCount, latencySum, latencyCount, latencyMs, latencyMs),
    ]);
}

// Opens a new incident row -- called once, at the exact moment runChecks()
// confirms a down transition (the 2nd consecutive failed check), not
// reconstructed later by replaying raw checks. Also stamps
// targets.state_since with the same timestamp -- this *is* the moment the
// target entered its current (down) state, so findStateSince()'s old
// unbounded raw-checks scan for that answer is no longer needed at all;
// see migration 0009.
export async function openIncident(db, targetId, startAt, reason) {
    await db.batch([
        db.prepare(
            "INSERT INTO incidents (target_id, start_at, end_at, reason) VALUES (?, ?, NULL, ?)"
        ).bind(targetId, startAt, reason || null),
        db.prepare("UPDATE targets SET state_since = ? WHERE id = ?").bind(startAt, targetId),
    ]);
}

// Closes this target's open incident (if any) -- called once, at the exact
// moment runChecks() confirms recovery. `end_at IS NULL` is what
// idx_incidents_open exists for. Also stamps targets.state_since -- see
// openIncident() above.
export async function closeIncident(db, targetId, endAt) {
    await db.batch([
        db.prepare(
            "UPDATE incidents SET end_at = ? WHERE target_id = ? AND end_at IS NULL"
        ).bind(endAt, targetId),
        db.prepare("UPDATE targets SET state_since = ? WHERE id = ?").bind(endAt, targetId),
    ]);
}

// Deletes checks older than `beforeMs`, in batches -- a single unbounded
// DELETE over however many hundred thousand rows have aged out since the
// last run would itself be a spike in rows written/read, the same failure
// shape as the incident this exists to prevent. `checked_at < ?` doesn't
// match idx_checks_target_id_time's leading column (target_id), so this
// relies on idx_checks_checked_at (migration 0007) to stay an index range
// scan instead of a full table scan. Called once a day -- see
// scheduled() in index.js -- not on every check.
// maxTotal caps how much a single invocation will ever delete. Ordinary
// daily overflow (a day's worth of checks aging past the retention window)
// is tiny -- this cap exists for the case where the retention window
// itself just got shrunk a lot (as it did, 400 days -> 7, once daily_stats/
// incidents/state_since stopped needing raw history to back them -- see
// docs/incidents/2026-09-06-d1-quota-exhaustion.md), leaving a large
// backlog. D1's free tier caps rows *written* at 100K/day same as it caps
// rows read at 5M/day; deleting hundreds of thousands of backlogged rows in
// one run would trade one quota exhaustion for another. Capped well under
// that (leaving headroom for the day's normal check inserts), a large
// backlog just works itself down gradually across however many days it
// takes instead of all at once.
export async function pruneOldChecks(db, beforeMs, batchSize = 5000, maxTotal = 50000) {
    let totalDeleted = 0;
    while (totalDeleted < maxTotal) {
        const limit = Math.min(batchSize, maxTotal - totalDeleted);
        const { meta } = await db.prepare(
            "DELETE FROM checks WHERE id IN (SELECT id FROM checks WHERE checked_at < ? LIMIT ?)"
        ).bind(beforeMs, limit).run();
        totalDeleted += meta.changes;
        if (meta.changes < limit) break; // fewer matching rows than asked for -- fully caught up
    }
    return totalDeleted;
}

// Most recent checks first (limit 2 by default), for debounced state below.
export async function recentChecks(db, targetId, limit = 2) {
    const { results } = await db.prepare(
        "SELECT * FROM checks WHERE target_id = ? ORDER BY checked_at DESC LIMIT ?"
    ).bind(targetId, limit).all();
    return results;
}

// A single failed check is common noise (a transient network blip) and
// isn't treated as "down" -- two consecutive failures are required to
// confirm it. Recovery is immediate: one successful check is enough,
// since there's no ambiguity about whether the target is reachable again.
// `rows` must be most-recent-first, e.g. from recentChecks().
export function confirmedIsUp(rows) {
    if (!rows.length) return null;
    if (rows[0].is_up === 1) return true;
    return !(rows[1] && rows[1].is_up === 0);
}

// Raw, exact -- reads `checks` directly. Only ever called with a DAY (or
// shorter) window, where that's cheap (~1,200 rows/target) and precision
// actually matters (this is "right now", not a period stat).
export async function uptimeStats(db, targetId, sinceMs) {
    const row = await db.prepare(
        `SELECT SUM(is_up) * 100.0 / COUNT(*) AS pct, COUNT(*) AS samples
         FROM checks WHERE target_id = ? AND checked_at > ?`
    ).bind(targetId, sinceMs).first();
    return { pct: row?.pct ?? null, samples: row?.samples ?? 0 };
}

// Rollup-backed equivalent of uptimeStats(), for windows (WEEK/MONTH/YEAR)
// where scanning raw checks would cost thousands to hundreds of thousands
// of rows. Sums daily_stats for every *complete* day in range, plus a raw
// scan of just today's (partial, still-accumulating) checks so the result
// stays accurate up to the last few minutes. This rounds the window's start
// down to a whole day (so "last 7 days" might actually cover a few hours
// more than exactly 168h) -- inconsequential for a percentage stat, and a
// deliberate trade for turning an O(days-in-window x checks/day) scan into
// O(days-in-window) rollup rows + O(checks today). See
// docs/incidents/2026-09-06-d1-quota-exhaustion.md.
export async function uptimeStatsFast(db, targetId, sinceMs) {
    const dayStart = Math.floor(sinceMs / DAY) * DAY;
    const todayStart = Math.floor(Date.now() / DAY) * DAY;
    const [rollup, today] = await Promise.all([
        db.prepare(
            `SELECT SUM(up_count) AS up, SUM(up_count + down_count) AS total
             FROM daily_stats WHERE target_id = ? AND day >= ? AND day < ?`
        ).bind(targetId, dayStart, todayStart).first(),
        db.prepare(
            `SELECT SUM(is_up) AS up, COUNT(*) AS total
             FROM checks WHERE target_id = ? AND checked_at >= ?`
        ).bind(targetId, todayStart).first(),
    ]);
    const up = (rollup?.up || 0) + (today?.up || 0);
    const total = (rollup?.total || 0) + (today?.total || 0);
    return { pct: total ? (up * 100.0 / total) : null, samples: total };
}

// Raw, exact -- same reasoning as uptimeStats() above: only used for the
// DAY window, where it's already cheap.
export async function latencyStats(db, targetId, sinceMs) {
    return db.prepare(
        `SELECT AVG(latency_ms) AS avg, MIN(latency_ms) AS min, MAX(latency_ms) AS max
         FROM checks WHERE target_id = ? AND checked_at > ? AND latency_ms IS NOT NULL`
    ).bind(targetId, sinceMs).first();
}

// Rollup-backed equivalent of latencyStats() -- same day-rounding trade-off
// as uptimeStatsFast() above.
export async function latencyStatsFast(db, targetId, sinceMs) {
    const dayStart = Math.floor(sinceMs / DAY) * DAY;
    const todayStart = Math.floor(Date.now() / DAY) * DAY;
    const [rollup, today] = await Promise.all([
        db.prepare(
            `SELECT SUM(latency_sum) AS sum, SUM(latency_count) AS count, MIN(latency_min) AS min, MAX(latency_max) AS max
             FROM daily_stats WHERE target_id = ? AND day >= ? AND day < ?`
        ).bind(targetId, dayStart, todayStart).first(),
        db.prepare(
            `SELECT SUM(latency_ms) AS sum, COUNT(latency_ms) AS count, MIN(latency_ms) AS min, MAX(latency_ms) AS max
             FROM checks WHERE target_id = ? AND checked_at >= ? AND latency_ms IS NOT NULL`
        ).bind(targetId, todayStart).first(),
    ]);
    const sum = (rollup?.sum || 0) + (today?.sum || 0);
    const count = (rollup?.count || 0) + (today?.count || 0);
    const mins = [rollup?.min, today?.min].filter((v) => v != null);
    const maxs = [rollup?.max, today?.max].filter((v) => v != null);
    return {
        avg: count ? (sum / count) : null,
        min: mins.length ? Math.min(...mins) : null,
        max: maxs.length ? Math.max(...maxs) : null,
    };
}

export async function latencySeries(db, targetId, sinceMs, limit = 100) {
    const { results } = await db.prepare(
        `SELECT checked_at, latency_ms FROM checks
         WHERE target_id = ? AND checked_at > ? AND latency_ms IS NOT NULL
         ORDER BY checked_at DESC LIMIT ?`
    ).bind(targetId, sinceMs, limit).all();
    return results.reverse();
}

// --- Below: a single-fetch alternative to uptimeStats()/latencyStats()/
// latencySeries()/uptimeStatsFast()/latencyStatsFast(), for buildDetailData()
// (index.js) specifically. That one page view needs "last 24h" stats AND
// the "today so far" portion of three separate rollup windows (week/month/
// year) AND a latency chart -- which, called independently, meant re-
// scanning essentially the same raw rows in `checks` up to 6 times per
// view. `now - DAY` is always a superset of "today" (today start is never
// more than 24h in the past), so recentRawChecks() fetches that one range
// once and everything below derives its answer from the same in-memory
// array instead of a fresh query. See
// docs/incidents/2026-09-06-d1-quota-exhaustion.md.
export async function recentRawChecks(db, targetId, sinceMs) {
    const { results } = await db.prepare(
        `SELECT is_up, checked_at, latency_ms FROM checks
         WHERE target_id = ? AND checked_at > ? ORDER BY checked_at ASC`
    ).bind(targetId, sinceMs).all();
    return results;
}

export function uptimeFromRows(rows) {
    if (!rows.length) return { pct: null, samples: 0 };
    const up = rows.reduce((sum, r) => sum + r.is_up, 0);
    return { pct: up * 100.0 / rows.length, samples: rows.length };
}

export function latencyFromRows(rows) {
    const withLatency = rows.filter((r) => r.latency_ms != null);
    if (!withLatency.length) return { avg: null, min: null, max: null };
    const sum = withLatency.reduce((s, r) => s + r.latency_ms, 0);
    return {
        avg: sum / withLatency.length,
        min: Math.min(...withLatency.map((r) => r.latency_ms)),
        max: Math.max(...withLatency.map((r) => r.latency_ms)),
    };
}

export function latencySeriesFromRows(rows, limit = 100) {
    return rows
        .filter((r) => r.latency_ms != null)
        .slice(-limit)
        .map((r) => ({ checked_at: r.checked_at, latency_ms: r.latency_ms }));
}

// uptimeStatsFast()/latencyStatsFast() above, but given today's raw rows
// (already fetched by the caller via recentRawChecks()) instead of running
// their own "today" query. Still queries daily_stats for the complete-days
// portion -- that's a different table/range per window (week/month/year),
// so it can't be folded into the single raw fetch the same way.
// rows may span further back than "today" (e.g. buildDetailData passes the
// full `now - DAY` fetch, not a pre-filtered slice) -- filtered to
// `>= todayStart` here rather than trusted from the caller, so this can't
// silently double-count yesterday's tail against the rollup sum below,
// which already includes all of yesterday as a complete day.
export async function uptimeStatsFastFromRows(db, targetId, sinceMs, rows) {
    const dayStart = Math.floor(sinceMs / DAY) * DAY;
    const todayStart = Math.floor(Date.now() / DAY) * DAY;
    const todayRows = rows.filter((r) => r.checked_at >= todayStart);
    const rollup = await db.prepare(
        `SELECT SUM(up_count) AS up, SUM(up_count + down_count) AS total
         FROM daily_stats WHERE target_id = ? AND day >= ? AND day < ?`
    ).bind(targetId, dayStart, todayStart).first();
    const todayUp = todayRows.reduce((sum, r) => sum + r.is_up, 0);
    const up = (rollup?.up || 0) + todayUp;
    const total = (rollup?.total || 0) + todayRows.length;
    return { pct: total ? (up * 100.0 / total) : null, samples: total };
}

// Same "filter to today, not trusted from caller" reasoning as
// uptimeStatsFastFromRows() above.
export async function latencyStatsFastFromRows(db, targetId, sinceMs, rows) {
    const dayStart = Math.floor(sinceMs / DAY) * DAY;
    const todayStart = Math.floor(Date.now() / DAY) * DAY;
    const todayRows = rows.filter((r) => r.checked_at >= todayStart);
    const rollup = await db.prepare(
        `SELECT SUM(latency_sum) AS sum, SUM(latency_count) AS count, MIN(latency_min) AS min, MAX(latency_max) AS max
         FROM daily_stats WHERE target_id = ? AND day >= ? AND day < ?`
    ).bind(targetId, dayStart, todayStart).first();
    const todayWithLatency = todayRows.filter((r) => r.latency_ms != null);
    const todaySum = todayWithLatency.reduce((s, r) => s + r.latency_ms, 0);
    const sum = (rollup?.sum || 0) + todaySum;
    const count = (rollup?.count || 0) + todayWithLatency.length;
    const mins = [rollup?.min, ...todayWithLatency.map((r) => r.latency_ms)].filter((v) => v != null);
    const maxs = [rollup?.max, ...todayWithLatency.map((r) => r.latency_ms)].filter((v) => v != null);
    return {
        avg: count ? (sum / count) : null,
        min: mins.length ? Math.min(...mins) : null,
        max: maxs.length ? Math.max(...maxs) : null,
    };
}

// Incidents overlapping the window since sinceMs, for one target -- reads
// the incidents table directly instead of reconstructing from raw checks.
// That table has one row per actual incident (rare) rather than one per
// check (constant), so this is cheap and exact regardless of window length
// or how long the app has been running. An incident that started before
// the window but is still open (or ended after it) still counts as
// "overlapping" -- unlike the old raw-scan version, this shows its *true*
// start time rather than clamping it to the window boundary.
export async function recentIncidents(db, targetId, sinceMs) {
    const { results } = await db.prepare(
        `SELECT start_at, end_at, reason FROM incidents
         WHERE target_id = ? AND (end_at IS NULL OR end_at > ?)
         ORDER BY start_at ASC`
    ).bind(targetId, sinceMs).all();
    const now = Date.now();
    const list = results.map((r) => ({
        start: r.start_at,
        end: r.end_at ?? now,
        reason: r.reason,
        ongoing: r.end_at == null,
    }));
    const totalDownMs = list.reduce((sum, i) => sum + (i.end - i.start), 0);
    return { list, count: list.length, totalDownMs };
}

// The end time of this target's single most recent incident (open or
// closed), for the status list's "last down X ago" badge -- no window
// needed at all now that this is an indexed lookup against a table with one
// row per incident rather than a scan of raw checks.
export async function lastIncidentEnd(db, targetId) {
    const row = await db.prepare(
        `SELECT end_at FROM incidents WHERE target_id = ? ORDER BY start_at DESC LIMIT 1`
    ).bind(targetId).first();
    if (!row) return null;
    return row.end_at ?? Date.now();
}

// All incidents across every target, newest-first, for the global Incidents
// page. A single indexed query now (previously a per-target loop, each
// re-scanning raw checks -- see git history / the incident doc for that
// version and why it kept exhausting the D1 quota).
export async function allIncidents(db, limit = 200) {
    const { results } = await db.prepare(
        `SELECT i.target_id AS targetId, t.name AS targetName, i.start_at AS start, i.end_at AS end, i.reason AS reason
         FROM incidents i JOIN targets t ON t.id = i.target_id
         ORDER BY i.start_at DESC LIMIT ?`
    ).bind(limit).all();
    const now = Date.now();
    return results.map((r) => ({ ...r, ongoing: r.end == null, end: r.end ?? now }));
}
