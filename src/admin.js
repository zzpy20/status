import * as db from "./db.js";
import { notifyAll } from "./notify.js";
import { formatBrisbaneTime } from "./time.js";
import { targetIdentifier } from "./identifier.js";

function unauthorized() {
    return new Response("Unauthorized", { status: 401 });
}

function isAuthed(request, env) {
    if (!env.ADMIN_TOKEN) return false;
    const auth = request.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    return token === env.ADMIN_TOKEN;
}

async function sendTestNotify(env, target) {
    const monitorUrl = `${env.PUBLIC_BASE_URL || ""}/monitor/${target.id}`;
    const [telegram, email] = await notifyAll(env, {
        target, isUp: true, monitorUrl,
        text: `Test notification: ${target.name}\n${targetIdentifier(target)} -- test notification triggered from admin, ${formatBrisbaneTime()}`,
    });
    return { telegram, email };
}

// port is required only for 'port'-type targets -- http/dns send port: 0 as
// a sentinel (meaningless for those types), and 0 is falsy, so a plain
// `!body.port` check would wrongly reject every valid http/dns monitor.
function validateTargetBody(body) {
    if (!body.name || !body.host) return "name and host/URL/hostname are required";
    if ((body.type === "port" || !body.type) && !body.port) return "port is required for Port monitors";
    return null;
}

// Handles all /admin/api/* routes. Returns null if the path isn't one of ours,
// so index.js can fall through to a 404.
export async function handleAdminApi(request, env, url) {
    if (!isAuthed(request, env)) return unauthorized();

    const parts = url.pathname.replace(/^\/admin\/api\/?/, "").split("/").filter(Boolean);

    // /admin/api/targets
    if (parts.length === 1 && parts[0] === "targets") {
        if (request.method === "GET") {
            return Response.json(await db.statusRows(env.DB));
        }
        if (request.method === "POST") {
            const body = await request.json();
            const error = validateTargetBody(body);
            if (error) return Response.json({ error }, { status: 400 });
            return Response.json(await db.createTarget(env.DB, body), { status: 201 });
        }
    }

    // /admin/api/targets/:id ...
    if (parts.length >= 2 && parts[0] === "targets") {
        const id = Number(parts[1]);
        if (!Number.isInteger(id)) return Response.json({ error: "invalid id" }, { status: 400 });

        if (parts.length === 2) {
            if (request.method === "PUT") {
                const body = await request.json();
                const error = validateTargetBody(body);
                if (error) return Response.json({ error }, { status: 400 });
                return Response.json(await db.updateTarget(env.DB, id, body));
            }
            if (request.method === "DELETE") {
                await db.deleteTarget(env.DB, id);
                return new Response(null, { status: 204 });
            }
        }

        if (parts.length === 3 && request.method === "POST") {
            const target = await db.getTarget(env.DB, id);
            if (!target) return Response.json({ error: "not found" }, { status: 404 });

            if (parts[2] === "pause") return Response.json(await db.setPaused(env.DB, id, true));
            if (parts[2] === "resume") return Response.json(await db.setPaused(env.DB, id, false));
            if (parts[2] === "pin") return Response.json(await db.setPinned(env.DB, id, true));
            if (parts[2] === "unpin") return Response.json(await db.setPinned(env.DB, id, false));
            if (parts[2] === "reset") { await db.resetTarget(env.DB, id); return Response.json({ reset: true }); }
            if (parts[2] === "test-notify") return Response.json(await sendTestNotify(env, target));
        }
    }

    // One-off historical backfill for the `incidents` table (see migration
    // 0008 and docs/incidents/2026-09-06-d1-quota-exhaustion.md). daily_stats
    // could be backfilled with a plain SQL GROUP BY (done directly in the
    // migration), but incident boundaries depend on the 2-consecutive-
    // failures debounce state machine, which isn't a plain aggregate --
    // so this replays db.groupIncidents() (the same function the app used
    // to call on every page view) once, here, against full raw history per
    // target, and bulk-writes the result. Safe to re-run: always wipes and
    // rebuilds rather than incrementing, so it can't double-count. Not
    // wired into any schedule or public route -- admin-auth-gated and
    // meant to be triggered by hand, once, after 0008 ships (or again if
    // `incidents` and raw `checks` history are ever suspected to have
    // drifted apart).
    if (parts.length === 1 && parts[0] === "rebuild-incidents" && request.method === "POST") {
        await env.DB.prepare("DELETE FROM incidents").run();
        const targets = await db.listTargets(env.DB);
        const summary = [];
        for (const t of targets) {
            const rows = [];
            let cursor = 0;
            for (;;) {
                const { results } = await env.DB.prepare(
                    `SELECT is_up, checked_at, fail_reason FROM checks
                     WHERE target_id = ? AND checked_at > ? ORDER BY checked_at ASC LIMIT ?`
                ).bind(t.id, cursor, 20000).all();
                if (!results.length) break;
                rows.push(...results);
                cursor = results[results.length - 1].checked_at;
                if (results.length < 20000) break;
            }
            const { list } = db.groupIncidents(rows);
            if (list.length) {
                await env.DB.batch(list.map((inc) =>
                    env.DB.prepare(
                        "INSERT INTO incidents (target_id, start_at, end_at, reason) VALUES (?, ?, ?, ?)"
                    ).bind(t.id, inc.start, inc.ongoing ? null : inc.end, inc.reason || null)
                ));
            }
            summary.push({ target: t.name, checksScanned: rows.length, incidentsWritten: list.length });
        }
        return Response.json({ ok: true, summary });
    }

    return null;
}
