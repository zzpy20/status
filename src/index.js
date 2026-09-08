import { runCheck } from "./checker.js";
import * as db from "./db.js";
import { renderStatusPage, renderDetailPage, renderAdminPage, renderIncidentsPage } from "./render.js";
import { handleAdminApi } from "./admin.js";
import { notifyAll } from "./notify.js";
import { formatBrisbaneTime } from "./time.js";
import { targetIdentifier } from "./identifier.js";
import { syncDnsAll } from "./dns-drift-sync.js";

// no-store on every HTML response -- this bit us twice already (Reset,
// then the detail-page nav fix) where a browser/mobile-Safari cached page
// looked like a real bug because the deployed fix wasn't actually loading.
const HTML_HEADERS = { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" };

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

async function notifyStateChange(env, target, isUp) {
    const monitorUrl = `${env.PUBLIC_BASE_URL || ""}/monitor/${target.id}`;
    await notifyAll(env, {
        target, isUp, monitorUrl,
        text: `${target.name}: ${isUp ? "back up" : "DOWN"}\n${targetIdentifier(target)} -- ${formatBrisbaneTime()}`,
    });
}

async function runChecks(env) {
    const targets = await db.listTargets(env.DB, { includePaused: false });
    const results = [];
    for (const target of targets) {
        try {
            const previousRows = await db.recentChecks(env.DB, target.id);
            const previousConfirmed = db.confirmedIsUp(previousRows);
            const { isUp, latencyMs, reason } = await runCheck(target);
            await db.insertCheck(env.DB, target, isUp, latencyMs, reason);

            const newConfirmed = db.confirmedIsUp([{ is_up: isUp ? 1 : 0 }, ...previousRows]);
            if (previousConfirmed !== null && previousConfirmed !== newConfirmed) {
                await notifyStateChange(env, target, newConfirmed);
            }
            results.push({ target: target.name, isUp, error: null });
        } catch (err) {
            console.error(`check failed for ${target.name}:`, err.stack || err.message || String(err));
            results.push({ target: target.name, isUp: null, error: err.message || String(err) });
        }
    }
    return results;
}

// Finds when the target entered its current up/down state, by scanning back
// from the latest check for the most recent transition.
async function findStateSince(env, targetId, currentIsUp) {
    const row = await env.DB.prepare(
        `SELECT checked_at FROM checks
         WHERE target_id = ? AND is_up = ?
         ORDER BY checked_at DESC LIMIT 1`
    ).bind(targetId, currentIsUp ? 0 : 1).first();
    if (!row) return null; // never in the other state within retained history
    const next = await env.DB.prepare(
        `SELECT checked_at FROM checks
         WHERE target_id = ? AND checked_at > ? AND is_up = ?
         ORDER BY checked_at ASC LIMIT 1`
    ).bind(targetId, row.checked_at, currentIsUp ? 1 : 0).first();
    return next ? next.checked_at : row.checked_at;
}

async function buildDetailData(env, id) {
    const t = await db.getTarget(env.DB, id);
    if (!t) return null;
    const now = Date.now();
    const recent = await db.recentChecks(env.DB, id);
    const last = recent[0] ?? null;
    const isUp = db.confirmedIsUp(recent);

    // Incidents for DAY/WEEK/MONTH/YEAR all overlap (each is a subset of
    // YEAR), so fetch the raw checks once for the widest window and group
    // each narrower window -- and derive uptime365d -- from that same
    // in-memory result instead of separately re-querying the DB for each.
    // This used to be 5 separate full-year-capable DB round trips per page
    // view (4x incidents() + uptimeStats(YEAR)); now it's 1. That repeated
    // rescanning was a major contributor to D1's account-wide daily
    // row-read quota getting exhausted -- see
    // docs/incidents/2026-09-06-d1-quota-exhaustion.md.
    const [uptime24h, uptime7d, uptime30d, yearRows, latency24h, latency30d, latencySeries, stateSince] = await Promise.all([
        db.uptimeStats(env.DB, id, now - DAY),
        db.uptimeStats(env.DB, id, now - WEEK),
        db.uptimeStats(env.DB, id, now - MONTH),
        db.rawChecksSince(env.DB, id, now - YEAR),
        db.latencyStats(env.DB, id, now - DAY),
        db.latencyStats(env.DB, id, now - MONTH),
        db.latencySeries(env.DB, id, now - DAY),
        findStateSince(env, id, isUp),
    ]);
    const incidents24h = db.incidentsFromRows(yearRows, now - DAY);
    const incidents7d = db.incidentsFromRows(yearRows, now - WEEK);
    const incidents30d = db.incidentsFromRows(yearRows, now - MONTH);
    const incidents365d = db.incidentsFromRows(yearRows, now - YEAR);
    const upCount365d = yearRows.reduce((sum, r) => sum + r.is_up, 0);
    const uptime365d = {
        pct: yearRows.length ? (upCount365d * 100.0 / yearRows.length) : null,
        samples: yearRows.length,
    };

    return {
        id: t.id, name: t.name, type: t.type, host: t.host, port: t.port, config: t.config, tags: t.tags,
        is_up: isUp, checked_at: last ? last.checked_at : null, stateSince,
        uptime24h, uptime7d, uptime30d, uptime365d,
        incidents24h, incidents7d, incidents30d, incidents365d,
        latency24h, latency30d, latencySeries,
    };
}

// notes are for the admin's own recall and never exposed on public routes
// (the status page, /api/status, /monitor/:id) -- only via /admin/api/*.
function stripNotes(rows) {
    return rows.map(({ notes, ...rest }) => rest);
}

// Edge-caches a computed response for a few seconds on Cloudflare's own
// Cache API -- separate from (and much shorter than) any browser cache, and
// the client still always gets `Cache-Control: no-store` so this can't
// reproduce the stale-browser-cache bug noted on HTML_HEADERS above. This
// exists purely to put a hard ceiling on how often the expensive per-target
// D1 queries behind `/`, `/api/status`, `/monitor/:id` and `/incidents` can
// re-run -- a burst of repeat views (a refreshing tab, a crawler, a
// health-checker polling this status page) previously re-triggered the full
// computation on every single request. checks only change once a minute
// (the scheduled() cron interval), so anything under that is free
// staleness. See docs/incidents/2026-09-06-d1-quota-exhaustion.md.
const EDGE_CACHE_TTL_SECONDS = 20;

async function withEdgeCache(request, ctx, compute) {
    const cache = caches.default;
    const cacheKey = new Request(request.url, { method: "GET" });
    const hit = await cache.match(cacheKey);
    if (hit) {
        const clientRes = new Response(hit.body, hit);
        clientRes.headers.set("cache-control", "no-store");
        clientRes.headers.set("x-edge-cache", "HIT");
        return clientRes;
    }
    const res = await compute();
    if (res.ok) {
        const cacheCopy = res.clone();
        cacheCopy.headers.set("cache-control", `public, max-age=${EDGE_CACHE_TTL_SECONDS}`);
        ctx.waitUntil(cache.put(cacheKey, cacheCopy));
    }
    res.headers.set("cache-control", "no-store");
    res.headers.set("x-edge-cache", "MISS");
    return res;
}

export default {
    async scheduled(event, env, ctx) {
        ctx.waitUntil(runChecks(env));
        ctx.waitUntil(syncDnsAll(env).then((results) => {
            for (const r of results) console.log(JSON.stringify(r));
        }));
    },

    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        if (url.pathname === "/") {
            return withEdgeCache(request, ctx, async () => {
                const rows = stripNotes(await db.statusRows(env.DB));
                return new Response(renderStatusPage(rows), { headers: HTML_HEADERS });
            });
        }

        if (url.pathname === "/api/status") {
            return withEdgeCache(request, ctx, async () =>
                Response.json(stripNotes(await db.statusRows(env.DB))));
        }

        if (url.pathname.startsWith("/monitor/")) {
            const id = Number(url.pathname.split("/")[2]);
            return withEdgeCache(request, ctx, async () => {
                const data = await buildDetailData(env, id);
                if (!data) return new Response("Not found", { status: 404 });
                return new Response(renderDetailPage(data), { headers: HTML_HEADERS });
            });
        }

        if (url.pathname === "/incidents") {
            return withEdgeCache(request, ctx, async () => {
                const incidents = await db.allIncidents(env.DB);
                return new Response(renderIncidentsPage(incidents), { headers: HTML_HEADERS });
            });
        }

        if (url.pathname === "/admin") {
            return new Response(renderAdminPage(), { headers: HTML_HEADERS });
        }

        if (url.pathname.startsWith("/admin/api/")) {
            const res = await handleAdminApi(request, env, url);
            if (res) return res;
        }

        return new Response("Not found", { status: 404 });
    },
};
