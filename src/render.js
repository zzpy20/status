function timeAgo(ms) {
    if (ms == null) return "never";
    const s = Math.floor((Date.now() - ms) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
}

function duration(ms) {
    if (ms == null) return "—";
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
    return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}

function pct(n) {
    if (n == null) return "—";
    return `${n.toFixed(2)}%`;
}

function ms(n) {
    if (n == null) return "—";
    return `${Math.round(n)} ms`;
}

const BASE_STYLE = `
    :root { color-scheme: dark light; }
    body { font-family: -apple-system, system-ui, sans-serif; background: #0b0d10; color: #e6e6e6; margin: 0; padding: 2rem 1rem; }
    @media (prefers-color-scheme: light) { body { background: #f7f7f8; color: #17181a; } }
    a { color: inherit; }
    h1 { font-size: 1.1rem; font-weight: 600; color: #9aa0a6; margin: 0 0 1.5rem; }
    .wrap { max-width: 900px; margin: 0 auto; }
    table { border-collapse: collapse; width: 100%; }
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
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin: 1.5rem 0; }
    .card { background: rgba(255,255,255,0.03); border: 1px solid #2a2d31; border-radius: 8px; padding: 0.9rem 1rem; }
    @media (prefers-color-scheme: light) { .card { background: rgba(0,0,0,0.02); border-color: #dcdde0; } }
    .card .label { font-size: 0.7rem; text-transform: uppercase; color: #9aa0a6; margin-bottom: 0.3rem; }
    .card .value { font-size: 1.3rem; font-weight: 600; }
    button, input { font: inherit; }
    button { background: #2a2d31; color: #e6e6e6; border: none; border-radius: 6px; padding: 0.4rem 0.8rem; cursor: pointer; }
    button:hover { background: #3a3d41; }
    button.danger { background: #5a2020; }
    button.danger:hover { background: #7a2828; }
    input { background: #1b1d20; color: #e6e6e6; border: 1px solid #2a2d31; border-radius: 6px; padding: 0.4rem 0.6rem; }
`;

function pageShell(title, bodyHtml, extraStyle = "") {
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${BASE_STYLE}${extraStyle}</style>
</head>
<body>
    <div class="wrap">${bodyHtml}</div>
</body>
</html>`;
}

export function renderStatusPage(rows) {
    const items = rows.map((r) => `
        <tr>
            <td><span class="dot ${r.is_up ? "up" : "down"}"></span></td>
            <td><a href="/monitor/${r.id}">${r.name}</a></td>
            <td class="mono">${r.host}:${r.port}</td>
            <td>${r.is_up ? "Up" : "Down"} &middot; ${timeAgo(r.checked_at)}</td>
            <td>${pct(r.uptime_24h)}</td>
            <td>${pct(r.uptime_7d)}</td>
            <td>${timeAgo(r.last_down)}</td>
        </tr>`).join("");

    return pageShell("status", `
        <h1>Status</h1>
        <table>
            <thead>
                <tr><th></th><th>Target</th><th>Host</th><th>State</th><th>24h</th><th>7d</th><th>Last down</th></tr>
            </thead>
            <tbody>${items}</tbody>
        </table>
        <footer>Checked every minute via Cloudflare Workers Cron Triggers + D1 &middot; <a href="/admin">admin</a></footer>
    `);
}

function sparkline(series, width = 860, height = 120) {
    if (series.length < 2) return `<p class="mono" style="color:#5f6368">Not enough data yet for a chart.</p>`;
    const values = series.map((p) => p.latency_ms);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const stepX = width / (series.length - 1);
    const points = series.map((p, i) => {
        const x = i * stepX;
        const y = height - ((p.latency_ms - min) / range) * height;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");

    return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="none">
        <polyline points="${points}" fill="none" stroke="#2ecc71" stroke-width="2" />
    </svg>`;
}

export function renderDetailPage(m) {
    const incidentRows = m.incidents24h.list.slice().reverse().map((i) => `
        <tr>
            <td>${new Date(i.start).toLocaleString()}</td>
            <td>${i.ongoing ? "ongoing" : new Date(i.end).toLocaleString()}</td>
            <td>${duration(i.end - i.start)}</td>
        </tr>`).join("") || `<tr><td colspan="3" class="mono" style="color:#5f6368">No incidents in the last 24h.</td></tr>`;

    return pageShell(m.name, `
        <p><a href="/">&larr; Status</a></p>
        <h1 style="font-size: 1.4rem; color: inherit;">
            <span class="dot ${m.is_up ? "up" : "down"}"></span> ${m.name}
        </h1>
        <p class="mono" style="color:#9aa0a6">${m.host}:${m.port}</p>

        <div class="cards">
            <div class="card"><div class="label">Current status</div><div class="value" style="color: ${m.is_up ? "#2ecc71" : "#e74c3c"}">${m.is_up ? "Up" : "Down"}</div><div class="mono">${m.stateSince != null ? `since ${timeAgo(m.stateSince)}` : ""}</div></div>
            <div class="card"><div class="label">Last check</div><div class="value">${timeAgo(m.checked_at)}</div><div class="mono">checked every 1m</div></div>
            <div class="card"><div class="label">24h uptime</div><div class="value">${pct(m.uptime24h.pct)}</div><div class="mono">${m.incidents24h.count} incidents, ${duration(m.incidents24h.totalDownMs)} down</div></div>
            <div class="card"><div class="label">7d uptime</div><div class="value">${pct(m.uptime7d.pct)}</div><div class="mono">${m.incidents7d.count} incidents, ${duration(m.incidents7d.totalDownMs)} down</div></div>
            <div class="card"><div class="label">30d uptime</div><div class="value">${pct(m.uptime30d.pct)}</div><div class="mono">${m.incidents30d.count} incidents, ${duration(m.incidents30d.totalDownMs)} down</div></div>
        </div>

        <h1>Response time (last 24h)</h1>
        <div class="card">
            ${sparkline(m.latencySeries)}
            <div class="cards" style="margin-top:1rem">
                <div><div class="label">Average</div><div class="value">${ms(m.latency24h.avg)}</div></div>
                <div><div class="label">Minimum</div><div class="value">${ms(m.latency24h.min)}</div></div>
                <div><div class="label">Maximum</div><div class="value">${ms(m.latency24h.max)}</div></div>
            </div>
        </div>

        <h1 style="margin-top:2rem">Incidents (last 24h)</h1>
        <table>
            <thead><tr><th>Started</th><th>Ended</th><th>Duration</th></tr></thead>
            <tbody>${incidentRows}</tbody>
        </table>

        <footer><a href="/admin">admin</a></footer>
    `);
}

export function renderAdminPage() {
    return pageShell("admin", `
        <h1>Admin</h1>
        <div id="auth-box" class="card" style="margin-bottom:1.5rem; display:none">
            <div class="label">Admin token</div>
            <input id="token-input" type="password" placeholder="paste admin token" style="width:280px" />
            <button onclick="saveToken()">Save</button>
        </div>

        <table id="targets-table">
            <thead><tr><th></th><th>Name</th><th>Host</th><th>Port</th><th></th></tr></thead>
            <tbody id="targets-body"></tbody>
        </table>

        <h1 style="margin-top:2rem">Add monitor</h1>
        <div class="card">
            <input id="new-name" placeholder="Name" />
            <input id="new-host" placeholder="Host" />
            <input id="new-port" placeholder="Port" type="number" style="width:80px" />
            <button onclick="addTarget()">Add</button>
        </div>

        <footer><a href="/">&larr; Status page</a></footer>

        <script>
        const TOKEN_KEY = "status_admin_token";
        function getToken() { return localStorage.getItem(TOKEN_KEY) || ""; }
        function saveToken() {
            localStorage.setItem(TOKEN_KEY, document.getElementById("token-input").value.trim());
            document.getElementById("auth-box").style.display = "none";
            loadTargets();
        }
        async function api(path, options = {}) {
            const res = await fetch(path, {
                ...options,
                headers: { ...(options.headers || {}), Authorization: "Bearer " + getToken() },
            });
            if (res.status === 401) {
                localStorage.removeItem(TOKEN_KEY);
                document.getElementById("auth-box").style.display = "block";
                throw new Error("unauthorized");
            }
            if (res.status === 204) return null;
            return res.json();
        }
        function row(t) {
            return \`<tr data-id="\${t.id}">
                <td><span class="dot \${t.paused ? '' : 'up'}" style="background:\${t.paused ? '#5f6368' : '#2ecc71'}"></span></td>
                <td><input value="\${t.name}" data-field="name" /></td>
                <td><input value="\${t.host}" data-field="host" /></td>
                <td><input value="\${t.port}" data-field="port" type="number" style="width:80px" /></td>
                <td>
                    <button onclick="saveEdit(\${t.id})">Save</button>
                    <button onclick="togglePause(\${t.id}, \${t.paused})">\${t.paused ? 'Resume' : 'Pause'}</button>
                    <button onclick="testNotify(\${t.id})">Test notify</button>
                    <button class="danger" onclick="removeTarget(\${t.id})">Delete</button>
                </td>
            </tr>\`;
        }
        async function loadTargets() {
            try {
                const targets = await api("/admin/api/targets");
                document.getElementById("targets-body").innerHTML = targets.map(row).join("");
            } catch (e) {}
        }
        async function saveEdit(id) {
            const tr = document.querySelector(\`tr[data-id="\${id}"]\`);
            const body = {
                name: tr.querySelector('[data-field="name"]').value,
                host: tr.querySelector('[data-field="host"]').value,
                port: Number(tr.querySelector('[data-field="port"]').value),
            };
            await api(\`/admin/api/targets/\${id}\`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            loadTargets();
        }
        async function togglePause(id, paused) {
            await api(\`/admin/api/targets/\${id}/\${paused ? "resume" : "pause"}\`, { method: "POST" });
            loadTargets();
        }
        async function testNotify(id) {
            await api(\`/admin/api/targets/\${id}/test-notify\`, { method: "POST" });
            alert("Test notification sent (if NTFY_TOPIC is configured).");
        }
        async function removeTarget(id) {
            if (!confirm("Delete this monitor and all its history?")) return;
            await api(\`/admin/api/targets/\${id}\`, { method: "DELETE" });
            loadTargets();
        }
        async function addTarget() {
            const body = {
                name: document.getElementById("new-name").value,
                host: document.getElementById("new-host").value,
                port: Number(document.getElementById("new-port").value),
            };
            if (!body.name || !body.host || !body.port) return alert("name, host, and port are required");
            await api("/admin/api/targets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            document.getElementById("new-name").value = "";
            document.getElementById("new-host").value = "";
            document.getElementById("new-port").value = "";
            loadTargets();
        }
        if (!getToken()) document.getElementById("auth-box").style.display = "block";
        loadTargets();
        </script>
    `);
}
