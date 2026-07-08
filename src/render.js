function timeAgo(ms) {
    if (ms == null) return "never";
    const s = Math.floor((Date.now() - ms) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
}

function pct(n) {
    if (n == null) return "—";
    return `${n.toFixed(2)}%`;
}

export function renderStatusPage(rows) {
    const items = rows.map((r) => `
        <tr>
            <td><span class="dot ${r.is_up ? "up" : "down"}"></span></td>
            <td>${r.name}</td>
            <td class="mono">${r.host}:${r.port}</td>
            <td>${r.is_up ? "Up" : "Down"} &middot; ${timeAgo(r.checked_at)}</td>
            <td>${pct(r.uptime_24h)}</td>
            <td>${pct(r.uptime_7d)}</td>
            <td>${timeAgo(r.last_down)}</td>
        </tr>`).join("");

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>status</title>
<style>
    :root { color-scheme: dark light; }
    body { font-family: -apple-system, system-ui, sans-serif; background: #0b0d10; color: #e6e6e6; margin: 0; padding: 2rem 1rem; }
    @media (prefers-color-scheme: light) { body { background: #f7f7f8; color: #17181a; } }
    h1 { font-size: 1.1rem; font-weight: 600; color: #9aa0a6; margin: 0 0 1.5rem; }
    table { border-collapse: collapse; width: 100%; max-width: 900px; margin: 0 auto; }
    th, td { text-align: left; padding: 0.6rem 0.8rem; font-size: 0.9rem; }
    thead th { color: #9aa0a6; font-weight: 500; font-size: 0.75rem; text-transform: uppercase; border-bottom: 1px solid #2a2d31; }
    @media (prefers-color-scheme: light) { thead th { border-bottom: 1px solid #dcdde0; } }
    tbody tr { border-bottom: 1px solid #1b1d20; }
    @media (prefers-color-scheme: light) { tbody tr { border-bottom: 1px solid #eceded; } }
    .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; }
    .dot.up { background: #2ecc71; }
    .dot.down { background: #e74c3c; }
    .mono { font-family: ui-monospace, monospace; color: #9aa0a6; }
    footer { text-align: center; color: #5f6368; font-size: 0.75rem; margin-top: 2rem; }
</style>
</head>
<body>
    <div style="max-width: 900px; margin: 0 auto;">
        <h1>Status</h1>
        <table>
            <thead>
                <tr><th></th><th>Target</th><th>Host</th><th>State</th><th>24h</th><th>7d</th><th>Last down</th></tr>
            </thead>
            <tbody>${items}</tbody>
        </table>
        <footer>Checked every minute via Cloudflare Workers Cron Triggers + D1</footer>
    </div>
</body>
</html>`;
}
