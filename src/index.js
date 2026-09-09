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

// checks has no automatic cleanup otherwise -- it grows forever at roughly
// one row per target per check interval. Originally set to 400 days
// (a year of margin past the legitimate 365d stat), back when that stat
// and findStateSince() both depended on raw history directly. Neither does
// anymore: daily_stats/incidents (migration 0008) and targets.state_since
// (migration 0009) durably retain everything those need, independent of
// how much raw history survives. What's left needing raw `checks` is only
// the DAY-window stats and the rollups' own "today" blending -- a handful
// of days is generous margin for that. See
// docs/incidents/2026-09-06-d1-quota-exhaustion.md.
const CHECKS_RETENTION_MS = WEEK;

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
            const checkedAt = Date.now();
            await db.insertCheck(env.DB, target, isUp, latencyMs, reason, checkedAt);

            const newConfirmed = db.confirmedIsUp([{ is_up: isUp ? 1 : 0 }, ...previousRows]);
            if (previousConfirmed !== null && previousConfirmed !== newConfirmed) {
                // Writes the incidents row directly, at the exact moment the
                // transition is confirmed -- the only place this ever needs
                // deciding, instead of every future page view re-deriving it
                // by replaying raw checks through the same debounce logic.
                // Matches groupIncidents()' semantics exactly: a down
                // incident's start is backdated to the *first* of the two
                // consecutive failures (previousRows[0], not this
                // confirming check), and recovery closes it at this check's
                // own timestamp. See
                // docs/incidents/2026-09-06-d1-quota-exhaustion.md.
                if (newConfirmed === false) {
                    const startAt = previousRows[0] ? previousRows[0].checked_at : checkedAt;
                    await db.openIncident(env.DB, target.id, startAt, reason);
                } else {
                    await db.closeIncident(env.DB, target.id, checkedAt);
                }
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

async function buildDetailData(env, id) {
    const t = await db.getTarget(env.DB, id);
    if (!t) return null;
    const now = Date.now();
    const recent = await db.recentChecks(env.DB, id);
    const last = recent[0] ?? null;
    const isUp = db.confirmedIsUp(recent);

    // uptime/latency for WEEK/MONTH/YEAR read the daily_stats rollup
    // (updated incrementally by insertCheck()) instead of rescanning raw
    // checks -- O(days-in-window) instead of O(checks-in-window). Incidents
    // for every window read the `incidents` table directly (one row per
    // actual incident, written once at the moment runChecks() confirms a
    // transition) instead of being reconstructed by replaying raw checks
    // through the debounce state machine on every page view. Both used to
    // be full-history-capable DB scans, repeated across four overlapping
    // windows, and were a major contributor to D1's account-wide daily
    // row-read quota getting exhausted -- see
    // docs/incidents/2026-09-06-d1-quota-exhaustion.md.
    const [
        uptime24h, uptime7d, uptime30d, uptime365d,
        incidents24h, incidents7d, incidents30d, incidents365d,
        latency24h, latency30d, latencySeries,
    ] = await Promise.all([
        db.uptimeStats(env.DB, id, now - DAY),
        db.uptimeStatsFast(env.DB, id, now - WEEK),
        db.uptimeStatsFast(env.DB, id, now - MONTH),
        db.uptimeStatsFast(env.DB, id, now - YEAR),
        db.recentIncidents(env.DB, id, now - DAY),
        db.recentIncidents(env.DB, id, now - WEEK),
        db.recentIncidents(env.DB, id, now - MONTH),
        db.recentIncidents(env.DB, id, now - YEAR),
        db.latencyStats(env.DB, id, now - DAY),
        db.latencyStatsFast(env.DB, id, now - MONTH),
        db.latencySeries(env.DB, id, now - DAY),
    ]);

    return {
        id: t.id, name: t.name, type: t.type, host: t.host, port: t.port, config: t.config, tags: t.tags,
        // Was findStateSince(), an unbounded raw-checks scan re-run on every
        // page view -- now a plain column, maintained incrementally by
        // openIncident()/closeIncident() at the moment a transition is
        // confirmed. See migration 0009.
        is_up: isUp, checked_at: last ? last.checked_at : null, stateSince: t.state_since ?? null,
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

        // Piggybacks on the existing every-minute trigger rather than adding
        // a second cron entry -- this Cloudflare account is already at the
        // free plan's 5-cron-trigger total (see
        // Shenzhen-Reality/README.md/ARCHITECTURE.md). Runs once a day, at
        // the single minute-tick this condition is true for, using
        // event.scheduledTime (not Date.now()) so it's tied to the tick
        // Cloudflare actually scheduled, not wall-clock skew.
        const tick = new Date(event.scheduledTime);
        if (tick.getUTCHours() === 3 && tick.getUTCMinutes() === 0) {
            ctx.waitUntil(
                db.pruneOldChecks(env.DB, event.scheduledTime - CHECKS_RETENTION_MS).then((deleted) => {
                    if (deleted) console.log(`pruned ${deleted} checks older than ${CHECKS_RETENTION_MS / DAY} days`);
                })
            );
        }
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
