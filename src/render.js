import { targetIdentifier } from "./identifier.js";
import { formatBrisbaneTime } from "./time.js";

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
    .wrap { max-width: 1200px; margin: 0 auto; }

    h1.page-title { font-size: 20px; font-weight: 600; margin: 0 0 16px; }
    h2.section-title { font-size: 14px; font-weight: 600; color: var(--fg-muted); text-transform: uppercase; letter-spacing: 0.03em; margin: 32px 0 8px; }

    /* "Box" = GitHub's bordered list-container pattern */
    .Box { background: var(--canvas-default); border: 1px solid var(--border-default); border-radius: 6px; box-shadow: var(--shadow); }
    .Box-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--border-muted); }
    .Box-row:last-child { border-bottom: none; }
    .Box-header { padding: 12px 16px; border-bottom: 1px solid var(--border-muted); font-weight: 600; font-size: 14px; }
    .Box-row.header-row { color: var(--fg-muted); font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.02em; border-bottom: 1px solid var(--border-default); }

    table { border-collapse: collapse; width: 100%; }
    th, td { text-align: left; padding: 14px 16px; font-size: 14px; }
    thead th { color: var(--fg-muted); font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.02em; border-bottom: 1px solid var(--border-default); padding: 10px 16px; }
    tbody tr { border-bottom: 1px solid var(--border-muted); }
    tbody tr:last-child { border-bottom: none; }
    .status-badge { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; }
    .status-badge.up { color: var(--success-fg); }
    .status-badge.down { color: var(--danger-fg); }

    .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .dot.up { background: var(--success-emphasis); }
    .dot.down { background: var(--danger-emphasis); }
    .dot.paused { background: var(--neutral-emphasis); }
    .dot.pending { background: #d4a72c; }
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

    .search-box { margin-bottom: 12px; }
    .toolbar-row { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; }
    .toolbar-row .search-box { flex: 1 1 auto; margin-bottom: 0; }

    .modal-backdrop {
        display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5);
        align-items: flex-start; justify-content: center; padding: 40px 16px; overflow-y: auto; z-index: 100;
    }
    .modal-backdrop.open { display: flex; }
    .modal { background: var(--canvas-default); border: 1px solid var(--border-default); border-radius: 8px; max-width: 640px; width: 100%; padding: 20px; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .modal-header h2 { font-size: 16px; font-weight: 600; margin: 0; }
    .tag-pill {
        display: inline-block; background: var(--btn-bg); border: 1px solid var(--btn-border);
        border-radius: 12px; padding: 1px 8px; font-size: 11px; color: var(--fg-muted);
        margin: 3px 4px 0 0; cursor: pointer;
    }
    .tag-pill:hover { background: var(--btn-hover-bg); }
    .notes-snippet { font-size: 12px; color: var(--fg-muted); margin-top: 3px; max-width: 420px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
    .notes-snippet:hover { color: var(--accent-fg); }
    .notes-full { font-size: 13px; line-height: 1.6; color: var(--fg-default); margin-top: 6px; padding: 10px 12px; background: var(--canvas-subtle); border: 1px solid var(--border-muted); border-radius: 6px; max-width: 600px; }
    .fmt-toolbar { display: flex; gap: 4px; margin-bottom: 4px; }
    .fmt-toolbar button { padding: 2px 10px; font-size: 12px; }
    textarea {
        background: var(--canvas-default); color: var(--fg-default);
        border: 1px solid var(--border-default); border-radius: 6px;
        padding: 5px 12px; line-height: 20px; width: 100%; font: inherit; font-size: 14px;
        resize: vertical; min-height: 38px;
    }
    textarea:focus { border-color: var(--accent-fg); outline: none; box-shadow: 0 0 0 3px rgba(9,105,218,0.2); }

    .Box { overflow-x: auto; }

    @media (max-width: 640px) {
        body { padding: 20px 12px; }
        .Box-row { flex-direction: column; align-items: flex-start; gap: 6px; }
        .Box-row .actions { margin-left: 0; flex-wrap: wrap; width: 100%; }
        .toolbar-row { flex-direction: column; align-items: stretch; }
        .toolbar-row button { width: 100%; }
        .form-row { flex-direction: column; align-items: stretch; }
        .form-row .field, .form-row .field.port { flex: 1 1 auto; }
        .modal { padding: 16px; }
        .cards { grid-template-columns: 1fr 1fr; }
        .header-row { display: none; }
    }
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

function navRow(active) {
    const items = [
        { key: "status", label: "Status", href: "/" },
        { key: "incidents", label: "Incidents", href: "/incidents" },
        { key: "admin", label: "Admin", href: "/admin" },
    ];
    return `<nav style="margin-bottom:20px">${items.map((i) =>
        i.key === active ? `<strong>${i.label}</strong>` : `<a href="${i.href}">${i.label}</a>`
    ).join(' <span class="mono">&middot;</span> ')}</nav>`;
}

function tagList(tagsString) {
    return (tagsString || "").split(",").map((t) => t.trim()).filter(Boolean);
}

function tagPillsHtml(tagsString, onclick) {
    const tags = tagList(tagsString);
    if (!tags.length) return "";
    return `<div>${tags.map((t) => `<span class="tag-pill" onclick="${onclick}('${t.replace(/'/g, "\\'")}')">${t}</span>`).join("")}</div>`;
}

function statusHtml(paused, isUp, checkedAt) {
    if (paused) return "Paused";
    if (isUp == null) return "Pending first check";
    return `<span class="status-badge ${isUp ? "up" : "down"}">${isUp ? "Up" : "Down"}</span> &middot; ${timeAgo(checkedAt)}`;
}

export function renderStatusPage(rows) {
    const headerRow = `
        <div class="Box-row header-row">
            <span style="width:8px"></span>
            <div class="grow">Monitor</div>
            <div style="min-width:110px">Status</div>
            <div style="min-width:70px">24h</div>
            <div style="min-width:70px">7d</div>
            <div style="min-width:90px">Last down</div>
        </div>`;
    const items = rows.map((r) => `
        <div class="Box-row" data-search="${(r.name + " " + r.host + " " + (r.tags || "")).toLowerCase()}">
            <span class="dot ${r.paused ? "paused" : r.is_up == null ? "pending" : r.is_up ? "up" : "down"}"></span>
            <div class="grow">
                <a href="/monitor/${r.id}"><strong>${r.name}</strong></a>
                <div class="mono">${targetIdentifier(r)}</div>
                ${tagPillsHtml(r.tags, "filterByTag")}
            </div>
            <div style="min-width:110px">${statusHtml(r.paused, r.is_up, r.checked_at)}</div>
            <div style="min-width:70px">${pct(r.uptime_24h)} <span class="mono">24h</span></div>
            <div style="min-width:70px">${pct(r.uptime_7d)} <span class="mono">7d</span></div>
            <div style="min-width:90px" class="mono">down ${timeAgo(r.last_down)}</div>
        </div>`).join("");

    return pageShell("status", `
        ${navRow("status")}
        <h1 class="page-title">Status</h1>
        <div class="search-box"><input id="search" placeholder="Search by name, host, or tag..." oninput="filterRows()"></div>
        <div class="Box" id="rows-box">${headerRow}${items}</div>
        <p id="no-results" class="mono" style="display:none">No monitors match your search.</p>
        <footer>Checked every minute via Cloudflare Workers Cron Triggers + D1</footer>
        <script>
        function filterRows() {
            const q = document.getElementById("search").value.trim().toLowerCase();
            const rows = document.querySelectorAll("#rows-box .Box-row:not(.header-row)");
            let visible = 0;
            rows.forEach((row) => {
                const match = !q || row.dataset.search.includes(q);
                row.style.display = match ? "" : "none";
                if (match) visible++;
            });
            document.getElementById("no-results").style.display = visible ? "none" : "block";
        }
        function filterByTag(tag) {
            document.getElementById("search").value = tag;
            filterRows();
        }
        const initialQ = new URLSearchParams(location.search).get("q");
        if (initialQ) { document.getElementById("search").value = initialQ; filterRows(); }
        </script>
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
            <td>${formatBrisbaneTime(new Date(i.start))}</td>
            <td>${i.ongoing ? "ongoing" : formatBrisbaneTime(new Date(i.end))}</td>
            <td>${duration(i.end - i.start)}</td>
        </tr>`).join("") || `<tr><td colspan="3" class="mono">No incidents in the last 24h.</td></tr>`;

    return pageShell(m.name, `
        ${navRow()}
        <h1 class="page-title"><span class="dot ${m.is_up == null ? "pending" : m.is_up ? "up" : "down"}"></span> ${m.name}</h1>
        <p class="mono">${targetIdentifier(m)}</p>
        ${tagPillsHtml(m.tags, "goToTag")}
        <script>function goToTag(tag) { location.href = "/?" + new URLSearchParams({ q: tag }); }</script>

        <div class="cards">
            <div class="card"><div class="label">Current status</div><div class="value" style="color: ${m.is_up == null ? "var(--fg-muted)" : `var(${m.is_up ? "--success-fg" : "--danger-fg"})`}">${m.is_up == null ? "Pending" : m.is_up ? "Up" : "Down"}</div><div class="mono">${m.stateSince != null ? `since ${timeAgo(m.stateSince)}` : ""}</div></div>
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
    `);
}

export function renderIncidentsPage(incidents) {
    const rows = incidents.map((inc) => `
        <tr data-search="${inc.targetName.toLowerCase()}">
            <td><span class="status-badge ${inc.ongoing ? "down" : "up"}"><span class="dot ${inc.ongoing ? "down" : "up"}"></span>${inc.ongoing ? "Ongoing" : "Resolved"}</span></td>
            <td><a href="/monitor/${inc.targetId}">${inc.targetName}</a></td>
            <td>${inc.reason || "—"}</td>
            <td>${formatBrisbaneTime(new Date(inc.start))}</td>
            <td>${inc.ongoing ? "—" : formatBrisbaneTime(new Date(inc.end))}</td>
            <td>${duration(inc.end - inc.start)}</td>
        </tr>`).join("") || `<tr><td colspan="6" class="mono">No incidents recorded yet.</td></tr>`;

    return pageShell("incidents", `
        ${navRow("incidents")}
        <h1 class="page-title">Incidents</h1>
        <div class="search-box"><input id="search" placeholder="Search by monitor name..." oninput="filterIncidentRows()"></div>
        <div class="Box">
            <table>
                <thead><tr><th>Status</th><th>Monitor</th><th>Root Cause</th><th>Started</th><th>Resolved</th><th>Duration</th></tr></thead>
                <tbody id="rows-body">${rows}</tbody>
            </table>
        </div>
        <p id="no-results" class="mono" style="display:none">No incidents match your search.</p>
        <footer>Showing the most recent ${incidents.length} incident${incidents.length === 1 ? "" : "s"} across all monitors</footer>
        <script>
        function filterIncidentRows() {
            const q = document.getElementById("search").value.trim().toLowerCase();
            const rows = document.querySelectorAll("#rows-body tr");
            let visible = 0;
            rows.forEach((row) => {
                const match = !q || (row.dataset.search || "").includes(q);
                row.style.display = match ? "" : "none";
                if (match) visible++;
            });
            document.getElementById("no-results").style.display = visible ? "none" : "block";
        }
        </script>
    `);
}

export function renderAdminPage() {
    return pageShell("admin", `
        ${navRow("admin")}
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

        <div class="toolbar-row">
            <div class="search-box"><input id="search" placeholder="Search by name, host, tag, or notes..." oninput="renderTargets()"></div>
            <button class="primary" onclick="openAddModal()">+ Add monitor</button>
        </div>
        <div class="Box" id="targets-box"></div>

        <div class="modal-backdrop" id="add-modal-backdrop" onclick="if (event.target === this) closeAddModal()">
        <div class="modal">
            <div class="modal-header">
                <h2>Add monitor</h2>
                <button class="link" onclick="closeAddModal()">Close</button>
            </div>
            <div class="form-row">
                <div class="field grow"><label>Name</label><input id="new-name" placeholder="e.g. Shenzhen - forward (443)" /></div>
                <div class="field" style="flex:0 0 140px">
                    <label>Type</label>
                    <select id="new-type" onchange="onTypeChange('new', this.value)">
                        <option value="port">Port (TCP)</option>
                        <option value="http">HTTP</option>
                        <option value="dns">DNS</option>
                    </select>
                </div>
            </div>
            <div id="new-fields-port" class="form-row" style="margin-top:8px">
                <div class="field grow"><label>Host</label><input id="new-port-host" placeholder="e.g. shenzhen.1000600.xyz" /></div>
                <div class="field port"><label>Port</label><input id="new-port-num" placeholder="443" type="number" /></div>
            </div>
            <div id="new-fields-http" class="form-row" style="margin-top:8px; display:none">
                <div class="field grow"><label>URL</label><input id="new-http-url" placeholder="https://example.com/health" /></div>
                <div class="field grow"><label>Expected status</label><input id="new-expectedStatus" placeholder="optional, e.g. 200" /></div>
                <div class="field grow"><label>Keyword</label><input id="new-keyword" placeholder="optional, text that must appear" /></div>
            </div>
            <div id="new-fields-dns" class="form-row" style="margin-top:8px; display:none">
                <div class="field grow"><label>Hostname</label><input id="new-dns-hostname" placeholder="example.com" /></div>
                <div class="field" style="flex:0 0 110px">
                    <label>Record type</label>
                    <select id="new-recordType"><option>A</option><option>AAAA</option><option>CNAME</option></select>
                </div>
                <div class="field grow"><label>Expected value</label><input id="new-expectedValue" placeholder="optional, e.g. 1.2.3.4" /></div>
            </div>
            <div class="form-row" style="margin-top:8px">
                <div class="field grow"><label>Tags</label><input id="new-tags" placeholder="comma-separated, e.g. singapore, production" /></div>
            </div>
            <div class="field" style="margin-top:8px">
                <label>Notes (admin-only, never public)</label>
                <div class="fmt-toolbar">
                    <button type="button" style="font-weight:700" onclick="wrapSelection('new-notes','**')">B</button>
                    <button type="button" style="font-style:italic" onclick="wrapSelection('new-notes','*')">I</button>
                    <button type="button" style="text-decoration:underline" onclick="wrapSelection('new-notes','__')">U</button>
                    <button type="button" style="text-decoration:line-through" onclick="wrapSelection('new-notes','~~')">S</button>
                </div>
                <textarea id="new-notes" rows="4" placeholder="what this is for -- bold/italic/underline/strikethrough via the buttons above"></textarea>
            </div>
            <div style="margin-top:16px"><button class="primary" onclick="addTarget()">Add monitor</button></div>
        </div>
        </div>

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
            if (!res.ok) {
                let message = res.status + " " + res.statusText;
                try {
                    const body = await res.json();
                    if (body && body.error) message = body.error;
                } catch {}
                alert("Error: " + message);
                throw new Error(message);
            }
            return res.json();
        }

        function timeAgo(t) {
            if (t == null) return "never";
            const s = Math.floor((Date.now() - t) / 1000);
            if (s < 60) return s + "s ago";
            if (s < 3600) return Math.floor(s / 60) + "m ago";
            if (s < 86400) return Math.floor(s / 3600) + "h ago";
            return Math.floor(s / 86400) + "d ago";
        }
        function tagPills(tagsString) {
            const tags = (tagsString || "").split(",").map((s) => s.trim()).filter(Boolean);
            if (!tags.length) return "";
            return '<div>' + tags.map((t) => \`<span class="tag-pill" onclick="filterByTag('\${t.replace(/'/g, "\\\\'")}')">\${t}</span>\`).join("") + '</div>';
        }
        function targetIdentifier(t) {
            if (t.type === "http") return t.host;
            if (t.type === "dns") return t.host + " (" + ((t.config && t.config.recordType) || "A") + " record)";
            return t.host + ":" + t.port;
        }

        // Notes are stored as plain text with lightweight markers (**bold**,
        // *italic*, __underline__, ~~strikethrough~~) rather than raw HTML --
        // escape first, then apply the markers, so pasted/typed text can never
        // inject real markup.
        function escapeHtml(s) {
            return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        }
        function renderNotesHtml(text) {
            let s = escapeHtml(text || "");
            s = s.replace(/\\*\\*(.+?)\\*\\*/g, "<strong>$1</strong>");
            s = s.replace(/\\*(.+?)\\*/g, "<em>$1</em>");
            s = s.replace(/__(.+?)__/g, "<u>$1</u>");
            s = s.replace(/~~(.+?)~~/g, "<del>$1</del>");
            return s.replace(/\\n/g, "<br>");
        }
        function wrapSelection(textareaId, marker) {
            const ta = document.getElementById(textareaId);
            const start = ta.selectionStart, end = ta.selectionEnd;
            const selected = ta.value.slice(start, end) || "text";
            ta.value = ta.value.slice(0, start) + marker + selected + marker + ta.value.slice(end);
            ta.focus();
            ta.selectionStart = start + marker.length;
            ta.selectionEnd = start + marker.length + selected.length;
        }
        function toggleNotes(id) {
            const el = document.getElementById("notes-full-" + id);
            if (el) el.style.display = el.style.display === "none" ? "block" : "none";
        }
        function viewRow(t) {
            const dotClass = t.paused ? "paused" : (t.is_up == null ? "pending" : (t.is_up ? "up" : "down"));
            const stateText = t.paused ? "Paused" : (t.is_up == null ? "Pending first check" :
                '<span class="status-badge ' + (t.is_up ? "up" : "down") + '">' + (t.is_up ? "Up" : "Down") + "</span> \\u00b7 " + timeAgo(t.checked_at));
            const notesPreview = (t.notes || "").replace(/\\s+/g, " ").slice(0, 100);
            return \`<div class="Box-row" data-id="\${t.id}">
                <span class="dot \${dotClass}"></span>
                <div class="grow">
                    <strong>\${t.name}</strong>
                    <div class="mono">\${targetIdentifier(t)}</div>
                    \${tagPills(t.tags)}
                    \${t.notes ? \`<div class="notes-snippet" onclick="toggleNotes(\${t.id})">\${notesPreview}\${t.notes.length > 100 ? "…" : ""}</div>
                    <div class="notes-full" id="notes-full-\${t.id}" style="display:none">\${renderNotesHtml(t.notes)}</div>\` : ""}
                </div>
                <div class="mono" style="min-width:130px">\${stateText}</div>
                <div class="actions">
                    <button class="link" onclick="startEdit(\${t.id})">Edit</button>
                    <button onclick="togglePause(\${t.id}, \${t.paused})">\${t.paused ? 'Resume' : 'Pause'}</button>
                    <button onclick="testNotify(\${t.id})">Test notify</button>
                    <button class="danger" onclick="resetTarget(\${t.id})">Reset</button>
                    <button class="danger" onclick="removeTarget(\${t.id})">Delete</button>
                </div>
            </div>\`;
        }

        function editRow(t) {
            const notesId = "edit-notes-" + t.id;
            const prefix = "edit-" + t.id;
            const type = t.type || "port";
            const cfg = t.config || {};
            const dispPort = type === "port" ? (t.host || "") : "";
            const dispHttp = type === "http" ? (t.host || "") : "";
            const dispDns = type === "dns" ? (t.host || "") : "";
            return \`<div class="Box-row" data-id="\${t.id}">
                <div class="grow">
                    <div class="form-row">
                        <div class="field grow"><label>Name</label><input value="\${t.name}" data-field="name" /></div>
                        <div class="field" style="flex:0 0 140px">
                            <label>Type</label>
                            <select data-field="type" onchange="onTypeChange('\${prefix}', this.value)">
                                <option value="port" \${type === "port" ? "selected" : ""}>Port (TCP)</option>
                                <option value="http" \${type === "http" ? "selected" : ""}>HTTP</option>
                                <option value="dns" \${type === "dns" ? "selected" : ""}>DNS</option>
                            </select>
                        </div>
                    </div>
                    <div id="\${prefix}-fields-port" class="form-row" style="margin-top:8px; display:\${type === "port" ? "" : "none"}">
                        <div class="field grow"><label>Host</label><input value="\${dispPort}" data-field="port-host" /></div>
                        <div class="field port"><label>Port</label><input value="\${type === "port" ? t.port : ""}" data-field="port-num" type="number" /></div>
                    </div>
                    <div id="\${prefix}-fields-http" class="form-row" style="margin-top:8px; display:\${type === "http" ? "" : "none"}">
                        <div class="field grow"><label>URL</label><input value="\${dispHttp}" data-field="http-url" /></div>
                        <div class="field grow"><label>Expected status</label><input value="\${cfg.expectedStatus || ""}" data-field="expectedStatus" placeholder="optional" /></div>
                        <div class="field grow"><label>Keyword</label><input value="\${cfg.keyword || ""}" data-field="keyword" placeholder="optional" /></div>
                    </div>
                    <div id="\${prefix}-fields-dns" class="form-row" style="margin-top:8px; display:\${type === "dns" ? "" : "none"}">
                        <div class="field grow"><label>Hostname</label><input value="\${dispDns}" data-field="dns-hostname" /></div>
                        <div class="field" style="flex:0 0 110px">
                            <label>Record type</label>
                            <select data-field="recordType">
                                <option \${(cfg.recordType || "A") === "A" ? "selected" : ""}>A</option>
                                <option \${cfg.recordType === "AAAA" ? "selected" : ""}>AAAA</option>
                                <option \${cfg.recordType === "CNAME" ? "selected" : ""}>CNAME</option>
                            </select>
                        </div>
                        <div class="field grow"><label>Expected value</label><input value="\${cfg.expectedValue || ""}" data-field="expectedValue" placeholder="optional" /></div>
                    </div>
                    <div class="form-row" style="margin-top:8px">
                        <div class="field grow"><label>Tags</label><input value="\${t.tags || ""}" data-field="tags" placeholder="comma-separated" /></div>
                    </div>
                    <div class="field" style="margin-top:8px">
                        <label>Notes</label>
                        <div class="fmt-toolbar">
                            <button type="button" style="font-weight:700" onclick="wrapSelection('\${notesId}','**')">B</button>
                            <button type="button" style="font-style:italic" onclick="wrapSelection('\${notesId}','*')">I</button>
                            <button type="button" style="text-decoration:underline" onclick="wrapSelection('\${notesId}','__')">U</button>
                            <button type="button" style="text-decoration:line-through" onclick="wrapSelection('\${notesId}','~~')">S</button>
                        </div>
                        <textarea id="\${notesId}" data-field="notes" rows="4">\${escapeHtml(t.notes || "")}</textarea>
                    </div>
                </div>
                <div class="actions">
                    <button class="primary" onclick="saveEdit(\${t.id})">Save</button>
                    <button onclick="cancelEdit()">Cancel</button>
                </div>
            </div>\`;
        }

        function onTypeChange(prefix, type) {
            ["port", "http", "dns"].forEach((t) => {
                const el = document.getElementById(prefix + "-fields-" + t);
                if (el) el.style.display = (t === type) ? "" : "none";
            });
        }

        function matchesSearch(t, q) {
            if (!q) return true;
            const haystack = [t.name, t.host, t.tags, t.notes].filter(Boolean).join(" ").toLowerCase();
            return haystack.includes(q);
        }

        const targetsHeaderRow = '<div class="Box-row header-row">' +
            '<span style="width:8px"></span>' +
            '<div class="grow">Monitor</div>' +
            '<div style="min-width:130px">Status</div>' +
            '<div class="actions" style="margin-left:0">Actions</div>' +
            '</div>';
        function renderTargets() {
            const q = (document.getElementById("search")?.value || "").trim().toLowerCase();
            const visible = targets.filter((t) => matchesSearch(t, q));
            document.getElementById("targets-box").innerHTML = targetsHeaderRow + (
                visible.map((t) => t.id === editingId ? editRow(t) : viewRow(t)).join("")
                || (targets.length
                    ? '<div class="Box-row mono">No monitors match your search.</div>'
                    : '<div class="Box-row mono">No monitors yet -- add one below.</div>')
            );
        }
        function filterByTag(tag) {
            document.getElementById("search").value = tag;
            renderTargets();
        }

        async function loadTargets() {
            try {
                targets = await api("/admin/api/targets");
                renderTargets();
            } catch (e) {}
        }
        function startEdit(id) { editingId = id; renderTargets(); }
        function cancelEdit() { editingId = null; renderTargets(); }
        // Builds the {name, type, host, port, tags, notes, config} payload
        // from whichever fields are relevant to the selected type. get(field)
        // abstracts over "look up by id" (add form) vs "look up by data-field
        // within this row" (edit row) so both call sites share this logic.
        function buildPayload(get) {
            const type = get("type") || "port";
            const name = get("name");
            const tags = get("tags");
            const notes = get("notes");
            let host, port = 0, config = null;
            if (type === "http") {
                host = get("http-url");
                config = {};
                if (get("expectedStatus")) config.expectedStatus = get("expectedStatus");
                if (get("keyword")) config.keyword = get("keyword");
            } else if (type === "dns") {
                host = get("dns-hostname");
                config = { recordType: get("recordType") || "A" };
                if (get("expectedValue")) config.expectedValue = get("expectedValue");
            } else {
                host = get("port-host");
                port = Number(get("port-num")) || 0;
            }
            return { name, type, host, port, tags, notes, config };
        }

        async function saveEdit(id) {
            const row = document.querySelector(\`[data-id="\${id}"]\`);
            const get = (field) => {
                const el = row.querySelector(\`[data-field="\${field}"]\`);
                return el ? el.value : "";
            };
            const body = buildPayload(get);
            if (!body.name || !body.host) return alert("name and host/URL/hostname are required");
            await api(\`/admin/api/targets/\${id}\`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            editingId = null;
            loadTargets();
        }
        async function togglePause(id, paused) {
            await api(\`/admin/api/targets/\${id}/\${paused ? "resume" : "pause"}\`, { method: "POST" });
            loadTargets();
        }
        async function testNotify(id) {
            const result = await api(\`/admin/api/targets/\${id}/test-notify\`, { method: "POST" });
            const line = (label, r) => label + ": " + (r.sent ? "sent" : "not sent (" + (r.reason || "channel not configured") + ")");
            alert(line("Telegram", result.telegram) + "\\n" + line("Email", result.email));
        }
        async function resetTarget(id) {
            if (!confirm("Reset this monitor? This permanently deletes its check history -- uptime %, incidents, and response times all start fresh. The monitor itself, its config, tags, and notes are kept.")) return;
            await api(\`/admin/api/targets/\${id}/reset\`, { method: "POST" });
            loadTargets();
        }
        async function removeTarget(id) {
            if (!confirm("Delete this monitor and all its history?")) return;
            await api(\`/admin/api/targets/\${id}\`, { method: "DELETE" });
            loadTargets();
        }
        function openAddModal() { document.getElementById("add-modal-backdrop").classList.add("open"); }
        function closeAddModal() { document.getElementById("add-modal-backdrop").classList.remove("open"); }
        document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAddModal(); });

        async function addTarget() {
            const get = (field) => {
                const el = document.getElementById("new-" + field);
                return el ? el.value : "";
            };
            const body = buildPayload(get);
            if (!body.name || !body.host) return alert("name and host/URL/hostname are required");
            await api("/admin/api/targets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            ["name", "type", "port-host", "port-num", "http-url", "expectedStatus", "keyword", "dns-hostname", "expectedValue", "tags", "notes"].forEach((field) => {
                const el = document.getElementById("new-" + field);
                if (el) el.value = "";
            });
            document.getElementById("new-type").value = "port";
            onTypeChange("new", "port");
            closeAddModal();
            loadTargets();
        }
        if (!getToken()) document.getElementById("auth-box").style.display = "block";
        loadTargets();
        </script>
    `);
}
