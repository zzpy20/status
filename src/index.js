import { checkPort } from "./checker.js";
import * as db from "./db.js";
import { renderStatusPage, renderDetailPage, renderAdminPage } from "./render.js";
import { handleAdminApi } from "./admin.js";

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

async function notifyStateChange(env, target, isUp) {
    if (!env.NTFY_TOPIC) return;
    const title = `${target.name}: ${isUp ? "back up" : "DOWN"}`;
    await fetch(`https://ntfy.sh/${env.NTFY_TOPIC}`, {
        method: "POST",
        headers: { Title: title, Priority: isUp ? "default" : "high" },
        body: `${target.host}:${target.port} -- ${new Date().toISOString()}`,
    }).catch(() => {});
}

async function runChecks(env) {
    const targets = await db.listTargets(env.DB, { includePaused: false });
    const results = [];
    for (const target of targets) {
        try {
            const previous = await db.lastCheck(env.DB, target.id);
            const { isUp, latencyMs } = await checkPort(target.host, target.port);
            await db.insertCheck(env.DB, target, isUp, latencyMs);

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

async function buildStatusRows(env) {
    const now = Date.now();
    const targets = await db.listTargets(env.DB);
    return Promise.all(targets.map(async (t) => {
        const last = await db.lastCheck(env.DB, t.id);
        const uptime24h = await db.uptimeStats(env.DB, t.id, now - DAY);
        const uptime7d = await db.uptimeStats(env.DB, t.id, now - WEEK);
        const lastDownRow = await env.DB.prepare(
            "SELECT MAX(checked_at) AS last_down FROM checks WHERE target_id = ? AND is_up = 0"
        ).bind(t.id).first();
        return {
            id: t.id,
            name: t.name,
            host: t.host,
            port: t.port,
            paused: t.paused,
            is_up: last ? last.is_up === 1 : false,
            checked_at: last ? last.checked_at : null,
            uptime_24h: uptime24h.pct,
            uptime_7d: uptime7d.pct,
            last_down: lastDownRow?.last_down ?? null,
        };
    }));
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
    const isUp = last ? last.is_up === 1 : false;

    const [uptime24h, uptime7d, uptime30d, incidents24h, incidents7d, incidents30d, latency24h, latencySeries, stateSince] = await Promise.all([
        db.uptimeStats(env.DB, id, now - DAY),
        db.uptimeStats(env.DB, id, now - WEEK),
        db.uptimeStats(env.DB, id, now - MONTH),
        db.incidents(env.DB, id, now - DAY),
        db.incidents(env.DB, id, now - WEEK),
        db.incidents(env.DB, id, now - MONTH),
        db.latencyStats(env.DB, id, now - DAY),
        db.latencySeries(env.DB, id, now - DAY),
        findStateSince(env, id, isUp),
    ]);

    return {
        id: t.id, name: t.name, host: t.host, port: t.port,
        is_up: isUp, checked_at: last ? last.checked_at : null, stateSince,
        uptime24h, uptime7d, uptime30d,
        incidents24h, incidents7d, incidents30d,
        latency24h, latencySeries,
    };
}

export default {
    async scheduled(event, env, ctx) {
        ctx.waitUntil(runChecks(env));
    },

    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        if (url.pathname === "/") {
            const rows = await buildStatusRows(env);
            return new Response(renderStatusPage(rows), { headers: { "content-type": "text/html; charset=utf-8" } });
        }

        if (url.pathname === "/api/status") {
            return Response.json(await buildStatusRows(env));
        }

        if (url.pathname.startsWith("/monitor/")) {
            const id = Number(url.pathname.split("/")[2]);
            const data = await buildDetailData(env, id);
            if (!data) return new Response("Not found", { status: 404 });
            return new Response(renderDetailPage(data), { headers: { "content-type": "text/html; charset=utf-8" } });
        }

        if (url.pathname === "/admin") {
            return new Response(renderAdminPage(), { headers: { "content-type": "text/html; charset=utf-8" } });
        }

        if (url.pathname.startsWith("/admin/api/")) {
            const res = await handleAdminApi(request, env, url);
            if (res) return res;
        }

        return new Response("Not found", { status: 404 });
    },
};
