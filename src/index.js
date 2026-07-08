import { connect } from "cloudflare:sockets";
import { TARGETS } from "./targets.js";
import { renderStatusPage } from "./render.js";

async function checkPort(host, port, timeoutMs = 5000) {
    const socket = connect({ hostname: host, port });
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs));
    try {
        await Promise.race([socket.opened, timeout]);
        return true;
    } catch {
        return false;
    } finally {
        try { socket.close(); } catch {}
    }
}

async function notifyStateChange(env, target, isUp) {
    if (!env.NTFY_TOPIC) return;
    const title = `${target.name}: ${isUp ? "back up" : "DOWN"}`;
    await fetch(`https://ntfy.sh/${env.NTFY_TOPIC}`, {
        method: "POST",
        headers: {
            Title: title,
            Priority: isUp ? "default" : "high",
        },
        body: `${target.host}:${target.port} -- ${new Date().toISOString()}`,
    }).catch(() => {});
}

async function runChecks(env) {
    const results = [];
    for (const target of TARGETS) {
        try {
            const previous = await env.DB.prepare(
                "SELECT is_up FROM checks WHERE target = ? ORDER BY checked_at DESC LIMIT 1"
            ).bind(target.name).first();

            const isUp = await checkPort(target.host, target.port);

            await env.DB.prepare(
                "INSERT INTO checks (target, host, port, is_up, checked_at) VALUES (?, ?, ?, ?, ?)"
            ).bind(target.name, target.host, target.port, isUp ? 1 : 0, Date.now()).run();

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
    const day = 24 * 60 * 60 * 1000;
    const week = 7 * day;

    const latest = await env.DB.prepare(
        `SELECT target, host, port, is_up, checked_at FROM checks c1
         WHERE checked_at = (SELECT MAX(checked_at) FROM checks c2 WHERE c2.target = c1.target)`
    ).all();

    const uptime24h = await env.DB.prepare(
        `SELECT target, SUM(is_up) * 100.0 / COUNT(*) AS pct FROM checks WHERE checked_at > ? GROUP BY target`
    ).bind(now - day).all();

    const uptime7d = await env.DB.prepare(
        `SELECT target, SUM(is_up) * 100.0 / COUNT(*) AS pct FROM checks WHERE checked_at > ? GROUP BY target`
    ).bind(now - week).all();

    const lastDown = await env.DB.prepare(
        `SELECT target, MAX(checked_at) AS last_down FROM checks WHERE is_up = 0 GROUP BY target`
    ).all();

    const uptime24hMap = Object.fromEntries(uptime24h.results.map((r) => [r.target, r.pct]));
    const uptime7dMap = Object.fromEntries(uptime7d.results.map((r) => [r.target, r.pct]));
    const lastDownMap = Object.fromEntries(lastDown.results.map((r) => [r.target, r.last_down]));
    const latestMap = Object.fromEntries(latest.results.map((r) => [r.target, r]));

    return TARGETS.map((t) => {
        const l = latestMap[t.name];
        return {
            name: t.name,
            host: t.host,
            port: t.port,
            is_up: l ? l.is_up === 1 : false,
            checked_at: l ? l.checked_at : null,
            uptime_24h: uptime24hMap[t.name] ?? null,
            uptime_7d: uptime7dMap[t.name] ?? null,
            last_down: lastDownMap[t.name] ?? null,
        };
    });
}

export default {
    async scheduled(event, env, ctx) {
        ctx.waitUntil(runChecks(env));
    },

    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        if (url.pathname === "/") {
            const rows = await buildStatusRows(env);
            return new Response(renderStatusPage(rows), {
                headers: { "content-type": "text/html; charset=utf-8" },
            });
        }
        if (url.pathname === "/api/status") {
            const rows = await buildStatusRows(env);
            return Response.json(rows);
        }
        return new Response("Not found", { status: 404 });
    },
};
