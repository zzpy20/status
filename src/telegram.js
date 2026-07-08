// Replaces ntfy.sh: ntfy's free tier turned out to rate-limit by source IP
// regardless of authentication, and Cloudflare Workers share egress IPs
// across huge numbers of unrelated users/services also publishing to
// ntfy.sh anonymously -- that shared quota was already exhausted, silently,
// well before our own usage would ever hit a real limit. Telegram's Bot API
// has generous per-bot limits that aren't shared with random third parties.
export async function sendTelegram(env, text) {
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
        return { sent: false, reason: "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set" };
    }
    try {
        const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => "");
            console.error(`telegram send failed: ${res.status} ${res.statusText} -- ${body}`);
            return { sent: false, reason: `${res.status} ${res.statusText}` };
        }
        return { sent: true };
    } catch (err) {
        console.error("telegram send threw:", err.stack || err.message || String(err));
        return { sent: false, reason: err.message || String(err) };
    }
}
