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

// Color tokens and component styles lifted from GitHub's Primer design
// system (light + dark), rather than an ad hoc palette.
const BASE_STYLE = `
    :root {
        color-scheme: light dark;
        --fg-default: #1f2328; --fg-muted: #656d76;
        --canvas-default: #ffffff; --canvas-subtle: #f6f8fa;
        --border-default: #d0d7de; --border-muted: #d8dee4;
        --accent-fg: #0969da;
        --success-fg: #1a7f37; --success-emphasis: #1f883d; --success-hover: #1a7f37;
        --danger-fg: #cf222e; --danger-emphasis: #da3633;
        --neutral-emphasis: #6e7781;
        --btn-bg: #f6f8fa; --btn-border: rgba(31,35,40,0.15); --btn-hover-bg: #f3f4f6;
        --shadow: 0 1px 0 rgba(31,35,40,0.04);
    }
    :root[data-theme="dark"] {
        --fg-default: #e6edf3; --fg-muted: #848d97;
        --canvas-default: #0d1117; --canvas-subtle: #161b22;
        --border-default: #30363d; --border-muted: #21262d;
        --accent-fg: #2f81f7;
        --success-fg: #3fb950; --success-emphasis: #238636; --success-hover: #2ea043;
        --danger-fg: #f85149; --danger-emphasis: #da3633;
        --neutral-emphasis: #6e7781;
        --btn-bg: #21262d; --btn-border: rgba(240,246,252,0.1); --btn-hover-bg: #30363d;
        --shadow: none;
    }
    @media (prefers-color-scheme: dark) {
        :root {
            --fg-default: #e6edf3; --fg-muted: #848d97;
            --canvas-default: #0d1117; --canvas-subtle: #161b22;
            --border-default: #30363d; --border-muted: #21262d;
            --accent-fg: #2f81f7;
            --success-fg: #3fb950; --success-emphasis: #238636; --success-hover: #2ea043;
            --danger-fg: #f85149; --danger-emphasis: #da3633;
            --btn-bg: #21262d; --btn-border: rgba(240,246,252,0.1); --btn-hover-bg: #30363d;
            --shadow: none;
        }
    }
    :root[data-theme="light"] {
        --fg-default: #1f2328; --fg-muted: #656d76;
        --canvas-default: #ffffff; --canvas-subtle: #f6f8fa;
        --border-default: #d0d7de; --border-muted: #d8dee4;
        --accent-fg: #0969da;
        --success-fg: #1a7f37; --success-emphasis: #1f883d; --success-hover: #1a7f37;
        --danger-fg: #cf222e; --danger-emphasis: #da3633;
        --btn-bg: #f6f8fa; --btn-border: rgba(31,35,40,0.15); --btn-hover-bg: #f3f4f6;
        --shadow: 0 1px 0 rgba(31,35,40,0.04);
    }

    * { box-sizing: border-box; }
    body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        font-size: 14px; line-height: 1.5;
        background: var(--canvas-subtle); color: var(--fg-default);
        margin: 0; padding: 32px 16px;
    }
    a { color: var(--accent-fg); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .wrap { max-width: 920px; margin: 0 auto; }

    h1.page-title { font-size: 20px; font-weight: 600; margin: 0 0 16px; }
    h2.section-title { font-size: 14px; font-weight: 600; color: var(--fg-muted); text-transform: uppercase; letter-spacing: 0.03em; margin: 32px 0 8px; }

    /* "Box" = GitHub's bordered list-container pattern */
    .Box { background: var(--canvas-default); border: 1px solid var(--border-default); border-radius: 6px; box-shadow: var(--shadow); }
    .Box-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--border-muted); }
    .Box-row:last-child { border-bottom: none; }
    .Box-header { padding: 12px 16px; border-bottom: 1px solid var(--border-muted); font-weight: 600; font-size: 14px; }

    table { border-collapse: collapse; width: 100%; }
    th, td { text-align: left; padding: 8px 16px; font-size: 14px; }
    thead th { color: var(--fg-muted); font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.02em; border-bottom: 1px solid var(--border-default); }
    tbody tr { border-bottom: 1px solid var(--border-muted); }
    tbody tr:last-child { border-bottom: none; }

    .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .dot.up { background: var(--success-emphasis); }
    .dot.down { background: var(--danger-emphasis); }
    .dot.paused { background: var(--neutral-emphasis); }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--fg-muted); font-size: 12px; }

    footer { text-align: center; color: var(--fg-muted); font-size: 12px; margin-top: 32px; }

    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin: 16px 0; }
    .card { background: var(--canvas-default); border: 1px solid var(--border-default); border-radius: 6px; padding: 16px; }
    .card .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.02em; color: var(--fg-muted); margin-bottom: 4px; }
    .card .value { font-size: 24px; font-weight: 600; line-height: 1.2; }

    button, input, select { font: inherit; font-size: 14px; }
    button {
        display: inline-flex; align-items: center; gap: 6px;
        background: var(--btn-bg); color: var(--fg-default);
        border: 1px solid var(--btn-border); border-radius: 6px;
        padding: 5px 12px; font-weight: 500; line-height: 20px;
        cursor: pointer; box-shadow: var(--shadow);
    }
    button:hover { background: var(--btn-hover-bg); }
    button.primary { background: var(--success-emphasis); border-color: rgba(31,35,40,0.15); color: #fff; }
    button.primary:hover { background: var(--success-hover); }
    button.danger { color: var(--danger-fg); }
    button.danger:hover { background: var(--danger-emphasis); border-color: rgba(31,35,40,0.15); color: #fff; }
    button.link { background: none; border: none; box-shadow: none; color: var(--accent-fg); padding: 5px 4px; }
    button.link:hover { text-decoration: underline; background: none; }
    button + button { margin-left: 4px; }

    input {
        background: var(--canvas-default); color: var(--fg-default);
        border: 1px solid var(--border-default); border-radius: 6px;
        padding: 5px 12px; line-height: 20px; width: 100%;
    }
    input:focus { border-color: var(--accent-fg); outline: none; box-shadow: 0 0 0 3px rgba(9,105,218,0.2); }

    .field { display: flex; flex-direction: column; gap: 4px; }
    .field label { font-size: 12px; font-weight: 600; color: var(--fg-muted); }
    .form-row { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
    .form-row .field { flex: 1 1 160px; }
    .form-row .field.port { flex: 0 0 90px; }
    .actions { display: flex; gap: 4px; margin-left: auto; flex-shrink: 0; }
    .grow { flex: 1 1 auto; min-width: 0; }
    .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;

function pageShell(title, bodyHtml) {
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${BASE_STYLE}</style>
</head>
<body>
    <div class="wrap">${bodyHtml}</div>
</body>
</html>`;
}

export function renderStatusPage(rows) {
    const items = rows.map((r) => `
        <div class="Box-row">
            <span class="dot ${r.paused ? "paused" : r.is_up ? "up" : "down"}"></span>
            <div class="grow">
                <a href="/monitor/${r.id}"><strong>${r.name}</strong></a>
                <div class="mono">${r.host}:${r.port}</div>
            </div>
            <div style="min-width:110px">${r.paused ? "Paused" : r.is_up ? "Up" : "Down"} &middot; ${timeAgo(r.checked_at)}</div>
            <div style="min-width:70px">${pct(r.uptime_24h)} <span class="mono">24h</span></div>
            <div style="min-width:70px">${pct(r.uptime_7d)} <span class="mono">7d</span></div>
            <div style="min-width:90px" class="mono">down ${timeAgo(r.last_down)}</div>
        </div>`).join("");

    return pageShell("status", `
        <h1 class="page-title">Status</h1>
        <div class="Box">${items}</div>
        <footer>Checked every minute via Cloudflare Workers Cron Triggers + D1 &middot; <a href="/admin">admin</a></footer>
    `);
}

function sparkline(series, width = 860, height = 120) {
    if (series.length < 2) return `<p class="mono">Not enough data yet for a chart.</p>`;
    const values = series.map((p) => p.latency_ms);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const stepX = width / (series.length - 1);
    const points = series.map((p, i) => {
        const x = i * stepX;
        const y = height - ((p.latency_ms - min) / range) * (height - 8) - 4;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");

    return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="none">
        <polyline points="${points}" fill="none" stroke="var(--success-emphasis)" stroke-width="2" />
    </svg>`;
}

export function renderDetailPage(m) {
    const incidentRows = m.incidents24h.list.slice().reverse().map((i) => `
        <tr>
            <td>${new Date(i.start).toLocaleString()}</td>
            <td>${i.ongoing ? "ongoing" : new Date(i.end).toLocaleString()}</td>
            <td>${duration(i.end - i.start)}</td>
        </tr>`).join("") || `<tr><td colspan="3" class="mono">No incidents in the last 24h.</td></tr>`;

    return pageShell(m.name, `
        <p><a href="/">&larr; Status</a></p>
        <h1 class="page-title"><span class="dot ${m.is_up ? "up" : "down"}"></span> ${m.name}</h1>
        <p class="mono">${m.host}:${m.port}</p>

        <div class="cards">
            <div class="card"><div class="label">Current status</div><div class="value" style="color: var(${m.is_up ? "--success-fg" : "--danger-fg"})">${m.is_up ? "Up" : "Down"}</div><div class="mono">${m.stateSince != null ? `since ${timeAgo(m.stateSince)}` : ""}</div></div>
            <div class="card"><div class="label">Last check</div><div class="value">${timeAgo(m.checked_at)}</div><div class="mono">checked every 1m</div></div>
            <div class="card"><div class="label">24h uptime</div><div class="value">${pct(m.uptime24h.pct)}</div><div class="mono">${m.incidents24h.count} incidents, ${duration(m.incidents24h.totalDownMs)} down</div></div>
            <div class="card"><div class="label">7d uptime</div><div class="value">${pct(m.uptime7d.pct)}</div><div class="mono">${m.incidents7d.count} incidents, ${duration(m.incidents7d.totalDownMs)} down</div></div>
            <div class="card"><div class="label">30d uptime</div><div class="value">${pct(m.uptime30d.pct)}</div><div class="mono">${m.incidents30d.count} incidents, ${duration(m.incidents30d.totalDownMs)} down</div></div>
        </div>

        <h2 class="section-title">Response time (last 24h)</h2>
        <div class="card">
            ${sparkline(m.latencySeries)}
            <div class="cards" style="margin-top:8px; margin-bottom:0">
                <div><div class="label">Average</div><div class="value">${ms(m.latency24h.avg)}</div></div>
                <div><div class="label">Minimum</div><div class="value">${ms(m.latency24h.min)}</div></div>
                <div><div class="label">Maximum</div><div class="value">${ms(m.latency24h.max)}</div></div>
            </div>
        </div>

        <h2 class="section-title">Incidents (last 24h)</h2>
        <div class="Box">
            <table>
                <thead><tr><th>Started</th><th>Ended</th><th>Duration</th></tr></thead>
                <tbody>${incidentRows}</tbody>
            </table>
        </div>

        <footer><a href="/admin">admin</a></footer>
    `);
}

export function renderAdminPage() {
    return pageShell("admin", `
        <h1 class="page-title">Admin</h1>
        <div id="auth-box" class="Box" style="padding:16px; margin-bottom:24px; display:none">
            <div class="form-row">
                <div class="field grow">
                    <label>Admin token</label>
                    <input id="token-input" type="password" placeholder="paste admin token" />
                </div>
                <button class="primary" onclick="saveToken()">Save</button>
            </div>
        </div>

        <div class="Box" id="targets-box"></div>

        <h2 class="section-title">Add monitor</h2>
        <div class="Box" style="padding:16px">
            <div class="form-row">
                <div class="field grow"><label>Name</label><input id="new-name" placeholder="e.g. Shenzhen - forward (443)" /></div>
                <div class="field grow"><label>Host</label><input id="new-host" placeholder="e.g. shenzhen.1000600.xyz" /></div>
                <div class="field port"><label>Port</label><input id="new-port" placeholder="443" type="number" /></div>
                <button class="primary" onclick="addTarget()">Add monitor</button>
            </div>
        </div>

        <footer><a href="/">&larr; Status page</a></footer>

        <script>
        const TOKEN_KEY = "status_admin_token";
        let targets = [];
        let editingId = null;

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

        function viewRow(t) {
            return \`<div class="Box-row" data-id="\${t.id}">
                <span class="dot \${t.paused ? 'paused' : 'up'}"></span>
                <div class="grow">
                    <strong>\${t.name}</strong>
                    <div class="mono">\${t.host}:\${t.port}</div>
                </div>
                <div class="actions">
                    <button class="link" onclick="startEdit(\${t.id})">Edit</button>
                    <button onclick="togglePause(\${t.id}, \${t.paused})">\${t.paused ? 'Resume' : 'Pause'}</button>
                    <button onclick="testNotify(\${t.id})">Test notify</button>
                    <button class="danger" onclick="removeTarget(\${t.id})">Delete</button>
                </div>
            </div>\`;
        }

        function editRow(t) {
            return \`<div class="Box-row" data-id="\${t.id}">
                <div class="form-row grow">
                    <div class="field grow"><label>Name</label><input value="\${t.name}" data-field="name" /></div>
                    <div class="field grow"><label>Host</label><input value="\${t.host}" data-field="host" /></div>
                    <div class="field port"><label>Port</label><input value="\${t.port}" data-field="port" type="number" /></div>
                </div>
                <div class="actions">
                    <button class="primary" onclick="saveEdit(\${t.id})">Save</button>
                    <button onclick="cancelEdit()">Cancel</button>
                </div>
            </div>\`;
        }

        function renderTargets() {
            document.getElementById("targets-box").innerHTML =
                targets.map((t) => t.id === editingId ? editRow(t) : viewRow(t)).join("")
                || '<div class="Box-row mono">No monitors yet -- add one below.</div>';
        }

        async function loadTargets() {
            try {
                targets = await api("/admin/api/targets");
                renderTargets();
            } catch (e) {}
        }
        function startEdit(id) { editingId = id; renderTargets(); }
        function cancelEdit() { editingId = null; renderTargets(); }
        async function saveEdit(id) {
            const row = document.querySelector(\`[data-id="\${id}"]\`);
            const body = {
                name: row.querySelector('[data-field="name"]').value,
                host: row.querySelector('[data-field="host"]').value,
                port: Number(row.querySelector('[data-field="port"]').value),
            };
            await api(\`/admin/api/targets/\${id}\`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            editingId = null;
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
