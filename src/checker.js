import { connect } from "cloudflare:sockets";

export async function checkPort(host, port, timeoutMs = 5000) {
    const start = Date.now();
    const socket = connect({ hostname: host, port });
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs));
    try {
        await Promise.race([socket.opened, timeout]);
        return { isUp: true, latencyMs: Date.now() - start };
    } catch {
        return { isUp: false, latencyMs: null };
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
        let isUp = expectedStatus ? res.status === Number(expectedStatus) : res.ok;
        if (isUp && keyword) {
            const body = await res.text();
            isUp = body.includes(keyword);
        }
        return { isUp, latencyMs };
    } catch {
        return { isUp: false, latencyMs: null };
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
        if (!res.ok) return { isUp: false, latencyMs };
        const data = await res.json();
        const answers = (data.Answer || []).map((a) => a.data);
        let isUp = answers.length > 0;
        if (isUp && expectedValue) isUp = answers.some((v) => v.includes(expectedValue));
        return { isUp, latencyMs };
    } catch {
        return { isUp: false, latencyMs: null };
    } finally {
        clearTimeout(timeoutId);
    }
}

export async function runCheck(target) {
    const config = target.config || {};
    if (target.type === "http") return checkHttp(target.host, config);
    if (target.type === "dns") return checkDns(target.host, config);
    return checkPort(target.host, target.port);
}
