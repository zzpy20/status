import { runCheck } from "./checker.js";
import * as db from "./db.js";
import { renderStatusPage, renderDetailPage, renderAdminPage, renderIncidentsPage } from "./render.js";
import { handleAdminApi } from "./admin.js";
import { notifyAll } from "./notify.js";
import { formatBrisbaneTime } from "./time.js";
import { targetIdentifier } from "./identifier.js";

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
            const previous = await db.lastCheck(env.DB, target.id);
            const { isUp, latencyMs, reason } = await runCheck(target);
            await db.insertCheck(env.DB, target, isUp, latencyMs, reason);

            if (previous && previous.is_up !== (isUp ? 1 : 0)) {
                await notifyStateChange(env, target, isUp);
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
    const last = await db.lastCheck(env.DB, id);
    const isUp = last ? last.is_up === 1 : null;

    const [uptime24h, uptime7d, uptime30d, uptime365d, incidents24h, incidents7d, incidents30d, incidents365d, latency24h, latencySeries, stateSince] = await Promise.all([
        db.uptimeStats(env.DB, id, now - DAY),
        db.uptimeStats(env.DB, id, now - WEEK),
        db.uptimeStats(env.DB, id, now - MONTH),
        db.uptimeStats(env.DB, id, now - YEAR),
        db.incidents(env.DB, id, now - DAY),
        db.incidents(env.DB, id, now - WEEK),
        db.incidents(env.DB, id, now - MONTH),
        db.incidents(env.DB, id, now - YEAR),
        db.latencyStats(env.DB, id, now - DAY),
        db.latencySeries(env.DB, id, now - DAY),
        findStateSince(env, id, isUp),
    ]);

    return {
        id: t.id, name: t.name, type: t.type, host: t.host, port: t.port, config: t.config, tags: t.tags,
        is_up: isUp, checked_at: last ? last.checked_at : null, stateSince,
        uptime24h, uptime7d, uptime30d, uptime365d,
        incidents24h, incidents7d, incidents30d, incidents365d,
        latency24h, latencySeries,
    };
}

// notes are for the admin's own recall and never exposed on public routes
// (the status page, /api/status, /monitor/:id) -- only via /admin/api/*.
function stripNotes(rows) {
    return rows.map(({ notes, ...rest }) => rest);
}

export default {
    async scheduled(event, env, ctx) {
        ctx.waitUntil(runChecks(env));
    },

    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        if (url.pathname === "/") {
            const rows = stripNotes(await db.statusRows(env.DB));
            return new Response(renderStatusPage(rows), { headers: HTML_HEADERS });
        }

        if (url.pathname === "/api/status") {
            return Response.json(stripNotes(await db.statusRows(env.DB)));
        }

        if (url.pathname.startsWith("/monitor/")) {
            const id = Number(url.pathname.split("/")[2]);
            const data = await buildDetailData(env, id);
            if (!data) return new Response("Not found", { status: 404 });
            return new Response(renderDetailPage(data), { headers: HTML_HEADERS });
        }

        if (url.pathname === "/incidents") {
            const incidents = await db.allIncidents(env.DB);
            return new Response(renderIncidentsPage(incidents), { headers: HTML_HEADERS });
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
