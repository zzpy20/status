const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

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
        const last = await lastCheck(db, t.id);
        const uptime24h = await uptimeStats(db, t.id, now - DAY);
        const uptime7d = await uptimeStats(db, t.id, now - WEEK);
        const lastDownRow = await db.prepare(
            "SELECT MAX(checked_at) AS last_down FROM checks WHERE target_id = ? AND is_up = 0"
        ).bind(t.id).first();
        return {
            id: t.id,
            name: t.name,
            type: t.type,
            host: t.host,
            port: t.port,
            config: t.config,
            paused: t.paused,
            tags: t.tags,
            notes: t.notes,
            is_up: last ? last.is_up === 1 : null,
            checked_at: last ? last.checked_at : null,
            uptime_24h: uptime24h.pct,
            uptime_7d: uptime7d.pct,
            last_down: lastDownRow?.last_down ?? null,
        };
    }));
}

export async function listTargets(db, { includePaused = true } = {}) {
    const sql = includePaused
        ? "SELECT * FROM targets ORDER BY id"
        : "SELECT * FROM targets WHERE paused = 0 ORDER BY id";
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
    await db.prepare("DELETE FROM checks WHERE target_id = ?").bind(id).run();
    await db.prepare("DELETE FROM targets WHERE id = ?").bind(id).run();
}

// Wipes check history for one target (uptime %, incidents, latency stats
// are all computed live from `checks`, so this alone is a full "start
// fresh") without touching the target's own config/tags/notes.
export async function resetTarget(db, id) {
    await db.prepare("DELETE FROM checks WHERE target_id = ?").bind(id).run();
}

export async function setPaused(db, id, paused) {
    await db.prepare("UPDATE targets SET paused = ? WHERE id = ?").bind(paused ? 1 : 0, id).run();
    return getTarget(db, id);
}

export async function insertCheck(db, target, isUp, latencyMs, reason) {
    await db.prepare(
        "INSERT INTO checks (target, target_id, host, port, is_up, latency_ms, fail_reason, checked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(target.name, target.id, target.host, target.port, isUp ? 1 : 0, latencyMs, isUp ? null : (reason || null), Date.now()).run();
}

export async function lastCheck(db, targetId) {
    return db.prepare(
        "SELECT * FROM checks WHERE target_id = ? ORDER BY checked_at DESC LIMIT 1"
    ).bind(targetId).first();
}

export async function uptimeStats(db, targetId, sinceMs) {
    const row = await db.prepare(
        `SELECT SUM(is_up) * 100.0 / COUNT(*) AS pct, COUNT(*) AS samples
         FROM checks WHERE target_id = ? AND checked_at > ?`
    ).bind(targetId, sinceMs).first();
    return { pct: row?.pct ?? null, samples: row?.samples ?? 0 };
}

export async function latencyStats(db, targetId, sinceMs) {
    return db.prepare(
        `SELECT AVG(latency_ms) AS avg, MIN(latency_ms) AS min, MAX(latency_ms) AS max
         FROM checks WHERE target_id = ? AND checked_at > ? AND latency_ms IS NOT NULL`
    ).bind(targetId, sinceMs).first();
}

export async function latencySeries(db, targetId, sinceMs, limit = 100) {
    const { results } = await db.prepare(
        `SELECT checked_at, latency_ms FROM checks
         WHERE target_id = ? AND checked_at > ? AND latency_ms IS NOT NULL
         ORDER BY checked_at DESC LIMIT ?`
    ).bind(targetId, sinceMs, limit).all();
    return results.reverse();
}

// Groups consecutive is_up=0 rows (in chronological order) into incidents.
// An incident's "end" is the timestamp it was next confirmed back up (or
// "now" if still ongoing) -- using the last down check's own timestamp would
// understate an incident's duration by up to one check interval. Each
// incident's "reason" is the fail_reason of the check that started it --
// what triggered the outage, not every reason seen during it if it changed.
export async function incidents(db, targetId, sinceMs) {
    const { results } = await db.prepare(
        `SELECT is_up, checked_at, fail_reason FROM checks
         WHERE target_id = ? AND checked_at > ? ORDER BY checked_at ASC`
    ).bind(targetId, sinceMs).all();

    const out = [];
    let current = null;
    for (const row of results) {
        if (row.is_up === 0) {
            if (!current) current = { start: row.checked_at, end: row.checked_at, reason: row.fail_reason };
        } else if (current) {
            current.end = row.checked_at;
            out.push(current);
            current = null;
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

// All incidents across every target, newest-first, for the global Incidents
// page. Reuses the per-target grouping above rather than a single complex
// SQL query -- fine at the scale this tool actually runs at.
export async function allIncidents(db, limit = 200) {
    const targets = await listTargets(db);
    const out = [];
    for (const t of targets) {
        const { list } = await incidents(db, t.id, 0);
        for (const inc of list) {
            out.push({ targetId: t.id, targetName: t.name, start: inc.start, end: inc.end, ongoing: !!inc.ongoing, reason: inc.reason });
        }
    }
    out.sort((a, b) => b.start - a.start);
    return out.slice(0, limit);
}
