import * as db from "./db.js";
import { sendTelegram } from "./telegram.js";

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
    return sendTelegram(env, `Test notification: ${target.name}\n${target.host}:${target.port} -- test notification triggered from admin, ${new Date().toISOString()}`);
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
            if (!body.name || !body.host || !body.port) {
                return Response.json({ error: "name, host, port are required" }, { status: 400 });
            }
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
                if (!body.name || !body.host || !body.port) {
                    return Response.json({ error: "name, host, port are required" }, { status: 400 });
                }
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
            if (parts[2] === "test-notify") return Response.json(await sendTestNotify(env, target));
        }
    }

    return null;
}
