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
