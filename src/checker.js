import { connect } from "cloudflare:sockets";

export async function checkPort(host, port, timeoutMs = 5000) {
    const start = Date.now();
    const socket = connect({ hostname: host, port });
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutMs));
    try {
        await Promise.race([socket.opened, timeout]);
        return { isUp: true, latencyMs: Date.now() - start };
    } catch (err) {
        return { isUp: false, latencyMs: null, reason: err.message || "Connection failed" };
    } finally {
        try { socket.close(); } catch {}
    }
}

export async function checkHttp(url, { expectedStatus, keyword } = {}, timeoutMs = 8000) {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
        const latencyMs = Date.now() - start;

        if (expectedStatus) {
            if (res.status !== Number(expectedStatus)) {
                return { isUp: false, latencyMs, reason: `Expected status ${expectedStatus}, got ${res.status}` };
            }
        } else if (!res.ok) {
            return { isUp: false, latencyMs, reason: `HTTP ${res.status} ${res.statusText}` };
        }

        if (keyword) {
            const body = await res.text();
            if (!body.includes(keyword)) {
                return { isUp: false, latencyMs, reason: "Keyword not found in response" };
            }
        }
        return { isUp: true, latencyMs };
    } catch (err) {
        const reason = err.name === "AbortError" ? "Timeout" : (err.message || "Request failed");
        return { isUp: false, latencyMs: null, reason };
    } finally {
        clearTimeout(timeoutId);
    }
}

// DNS-over-HTTPS via Cloudflare's own resolver -- no raw DNS protocol needed,
// which the Workers runtime doesn't expose anyway.
export async function checkDns(hostname, { recordType = "A", expectedValue } = {}, timeoutMs = 5000) {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${encodeURIComponent(recordType)}`;
        const res = await fetch(url, { headers: { Accept: "application/dns-json" }, signal: controller.signal });
        const latencyMs = Date.now() - start;
        if (!res.ok) return { isUp: false, latencyMs, reason: `DNS query failed (${res.status})` };

        const data = await res.json();
        const answers = (data.Answer || []).map((a) => a.data);
        if (!answers.length) return { isUp: false, latencyMs, reason: `No ${recordType} records found` };

        if (expectedValue && !answers.some((v) => v.includes(expectedValue))) {
            return { isUp: false, latencyMs, reason: `Resolved value doesn't match expected '${expectedValue}'` };
        }
        return { isUp: true, latencyMs };
    } catch (err) {
        const reason = err.name === "AbortError" ? "Timeout" : (err.message || "Request failed");
        return { isUp: false, latencyMs: null, reason };
    } finally {
        clearTimeout(timeoutId);
    }
}

export const DEFAULT_GRACE_MINUTES = 5;

// How often (in cron minutes) a heartbeat monitor is evaluated: about half
// its grace period, 1-30 min. Its state can only change when a push arrives
// or the grace runs out, so checking every minute just burns D1 writes
// (~3.7 rows per check: checks row + its index + the daily_stats upsert).
// grace 3 -> every 1 min, 5 -> 2, 90 / 1560 / 10800 -> 30. See
// docs/incidents/2026-09-06-d1-quota-exhaustion.md for why writes matter.
export function heartbeatIntervalMinutes(target) {
    const grace = Number(target.config && target.config.graceMinutes) || DEFAULT_GRACE_MINUTES;
    return Math.min(30, Math.max(1, Math.floor(grace / 2)));
}

// Heartbeat: the target pushes to /push/:token; this just judges freshness.
// Returns null when the target has never pushed, so runChecks() records
// nothing and it stays "Pending first check" instead of alerting on a
// monitor whose client hasn't been set up yet.
export function checkHeartbeat(target, now = Date.now()) {
    if (target.last_push_at == null) return null;
    const graceMinutes = Number(target.config && target.config.graceMinutes) || DEFAULT_GRACE_MINUTES;
    const ageMs = now - target.last_push_at;
    if (ageMs <= graceMinutes * 60 * 1000) return { isUp: true, latencyMs: null };
    return { isUp: false, latencyMs: null, reason: `No heartbeat for ${Math.floor(ageMs / 60000)} min` };
}

export async function runCheck(target) {
    const config = target.config || {};
    if (target.type === "heartbeat") return checkHeartbeat(target);
    if (target.type === "http") return checkHttp(target.host, config);
    if (target.type === "dns") return checkDns(target.host, config);
    return checkPort(target.host, target.port);
}
