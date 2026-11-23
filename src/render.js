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
        --danger-subtle: #fff1f0; --success-subtle: #ddf4e4;
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
        --danger-subtle: #2d1214; --success-subtle: #122117;
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
            --danger-subtle: #2d1214; --success-subtle: #122117;
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
        --danger-subtle: #fff1f0; --success-subtle: #ddf4e4;
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
    .card.accent-danger { background: var(--danger-subtle); border-color: var(--danger-emphasis); }
    .card.accent-danger .value { color: var(--danger-fg); }
    .card.accent-success { background: var(--success-subtle); border-color: var(--success-emphasis); }
    .card.accent-success .value { color: var(--success-fg); }

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

    input:not([type="checkbox"]) {
        background: var(--canvas-default); color: var(--fg-default);
        border: 1px solid var(--border-default); border-radius: 6px;
        padding: 5px 12px; line-height: 20px; width: 100%;
    }
    input:not([type="checkbox"]):focus { border-color: var(--accent-fg); outline: none; box-shadow: 0 0 0 3px rgba(9,105,218,0.2); }
    input[type="checkbox"] { width: 16px; height: 16px; flex-shrink: 0; accent-color: var(--accent-fg); }

    .field { display: flex; flex-direction: column; gap: 4px; }
    .field label { font-size: 12px; font-weight: 600; color: var(--fg-muted); }
    .form-row { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
    .form-row .field { flex: 1 1 160px; }
    .form-row .field.port { flex: 0 0 90px; }
    .actions { display: flex; gap: 4px; flex: 0 0 104px; justify-content: flex-end; }
    .more-btn { font-weight: 700; letter-spacing: 1px; padding-left: 10px; padding-right: 10px; }
    .row-menu {
        position: fixed; z-index: 150; display: none; min-width: 170px; padding: 4px;
        background: var(--canvas-default); border: 1px solid var(--border-default); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    }
    .row-menu.open { display: block; }
    .row-menu button { display: block; width: 100%; text-align: left; border: 0; box-shadow: none; background: none; margin: 0; padding: 6px 10px; border-radius: 4px; }
    .row-menu button:hover, .row-menu button:focus-visible { background: var(--btn-hover-bg); outline: none; }
    .row-menu button.danger { color: var(--danger-fg); }
    .row-menu-sep { height: 1px; background: var(--border-muted); margin: 4px 0; }
    .row-menu a { display: block; padding: 6px 10px; border-radius: 4px; color: var(--fg-default); text-decoration: none; white-space: nowrap; }
    .row-menu a:hover, .row-menu a:focus-visible { background: var(--btn-hover-bg); outline: none; }
    .row-more { flex-shrink: 0; padding: 2px 8px; line-height: 1.2; }
    .grow { flex: 1 1 auto; min-width: 0; }
    .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .search-box { margin-bottom: 12px; position: relative; }
    .search-box input { padding-right: 32px; }
    .search-clear {
        display: none; position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
        width: 20px; height: 20px; align-items: center; justify-content: center;
        color: var(--fg-muted); cursor: pointer; font-size: 16px; line-height: 1; user-select: none; border-radius: 4px;
    }
    .search-clear:hover { color: var(--fg-default); background: var(--btn-hover-bg); }
    .search-clear.visible { display: flex; }
    .toolbar-row { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; }
    .toolbar-row .search-box { flex: 1 1 auto; margin-bottom: 0; }
    /* Active / Paused / All filter on the admin list */
    .seg { display: inline-flex; flex-shrink: 0; border: 1px solid var(--btn-border); border-radius: 6px; overflow: hidden; }
    .seg button { border: 0; border-radius: 0; margin: 0; white-space: nowrap; }
    .seg button + button { border-left: 1px solid var(--btn-border); }
    .seg button.active { background: var(--accent-fg); color: #fff; }
    .seg .count { opacity: 0.75; font-variant-numeric: tabular-nums; }
    .id-badge { color: var(--fg-muted); font-weight: 400; font-variant-numeric: tabular-nums; margin-right: 4px; }

    .modal-backdrop {
        display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5);
        align-items: flex-start; justify-content: center; padding: 40px 16px; overflow-y: auto; z-index: 100;
    }
    .modal-backdrop.open { display: flex; }
    .modal { background: var(--canvas-default); border: 1px solid var(--border-default); border-radius: 8px; max-width: 640px; width: 100%; padding: 20px; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .modal-header h2 { font-size: 16px; font-weight: 600; margin: 0; }
    /* Status-page groups (first tag) + summary line */
    details.group > summary {
        display: flex; align-items: center; gap: 8px; padding: 8px 16px; cursor: pointer; list-style: none;
        background: var(--canvas-subtle); border-bottom: 1px solid var(--border-muted); font-weight: 600; user-select: none;
    }
    details.group > summary::-webkit-details-marker { display: none; }
    details.group > summary:focus-visible { outline: 2px solid var(--accent-fg); outline-offset: -2px; }
    details.group .chev { width: 0; height: 0; border-left: 5px solid var(--fg-muted); border-top: 4px solid transparent; border-bottom: 4px solid transparent; transition: transform 0.15s; }
    details.group[open] .chev { transform: rotate(90deg); }
    .group-name { text-transform: capitalize; }
    .group-counts { margin-left: auto; display: flex; gap: 12px; font-weight: 400; font-size: 12px; color: var(--fg-muted); }
    .count-item { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
    .count-item .dot { width: 8px; height: 8px; }
    details.group:last-child .Box-row:last-child { border-bottom: none; }
    .summary-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 20px; margin: -4px 0 12px; font-size: 14px; }
    .summary-counts { display: flex; gap: 14px; }
    .attention { color: var(--fg-muted); }
    .attention a.down { color: var(--danger-fg); font-weight: 600; }
    .attention a.pending { color: var(--fg-default); }
    .all-ok { color: var(--success-fg); }
    /* Private notes on the status/archived pages -- only rendered client-side
       for a browser holding the admin token (see attachNotes()). */
    .note-btn { border: 0; background: none; padding: 0 2px; margin-left: 4px; color: var(--fg-muted); cursor: pointer; vertical-align: -2px; line-height: 0; }
    .note-btn:hover, .note-btn[aria-expanded="true"] { color: var(--accent-fg); }
    .note-btn svg { width: 14px; height: 14px; }
    .note-pop {
        position: fixed; z-index: 200; display: none; width: max-content; max-width: min(380px, calc(100vw - 32px));
        background: var(--canvas-default); color: var(--fg-default); border: 1px solid var(--border-default); border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.18); padding: 10px 12px; font-size: 13px; line-height: 1.5; overflow-wrap: anywhere;
    }
    .note-pop.open { display: block; }
    .note-pop-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; color: var(--fg-muted); margin-bottom: 4px; }
    /* Nudge shown when a backdrop click is ignored because the form has unsaved changes. */
    @keyframes modal-nudge { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
    .modal.nudge { animation: modal-nudge 0.25s ease-in-out 2; }
    .tag-pill {
        display: inline-block; background: var(--btn-bg); border: 1px solid var(--btn-border);
        border-radius: 12px; padding: 1px 8px; font-size: 11px; color: var(--fg-muted);
        margin: 3px 4px 0 0; cursor: pointer;
    }
    .tag-pill:hover { background: var(--btn-hover-bg); }
    .pin-badge {
        display: inline-block; background: var(--accent-fg); color: #fff;
        border-radius: 12px; padding: 1px 8px; font-size: 11px; font-weight: 600;
        margin: 3px 4px 0 0;
    }
    .phone-meta { display: none; }
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
        .Box-row .actions { margin-left: 0; flex-wrap: wrap; width: 100%; justify-content: flex-start; }
        .group-counts { gap: 8px; }
        /* Status/Archived rows on phones: a compact two-line card.
           Line 1: dot, name (ellipsized), status on the right.
           Line 2: 24h · 7d · last down, small and muted, under the name.
           The ::after item with flex-basis 100% forces the line break.
           Host line and tag pills are hidden here (the group heading shows
           the main tag; the monitor's detail page has the host). Scoped to
           #rows-box so the admin list keeps its own layout. */
        #rows-box .Box-row { flex-direction: row; flex-wrap: wrap; align-items: center; gap: 2px 10px; padding: 10px 14px; }
        #rows-box .Box-row::after { content: ""; order: 2; flex-basis: 100%; height: 0; }
        #rows-box .Box-row > .dot { order: 1; }
        #rows-box .Box-row > .col-name { order: 1; flex: 1 1 0 !important; min-width: 0; display: flex; align-items: center; }
        #rows-box .col-name a { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        #rows-box .col-name .pin-badge { flex-shrink: 0; }
        #rows-box .col-name .note-btn { flex-shrink: 0; }
        #rows-box .col-ident, #rows-box .col-tags, #rows-box .wide-only { display: none; }
        #rows-box .Box-row > .col-status { order: 1; white-space: nowrap; font-size: 13px; }
        #rows-box .Box-row > .row-more { order: 1; }
        #rows-box .Box-row > .col-stat { order: 3; min-width: 0 !important; font-size: 12px; color: var(--fg-muted); white-space: nowrap; }
        #rows-box .col-status + .col-stat { margin-left: 18px; }
        /* Admin rows on phones: line 1 = checkbox, dot, #id name, Edit/⋯;
           line 2 = status · what it checks; optional line 3 = notes preview
           (tap to expand, as on desktop). Tags hidden, like the status page. */
        #targets-box .Box-row:not(.header-row) { flex-direction: row; flex-wrap: nowrap; align-items: flex-start; gap: 10px; padding: 10px 12px; }
        #targets-box .Box-row > input[type="checkbox"] { margin-top: 2px; }
        #targets-box .Box-row > .dot { margin-top: 6px; }
        #targets-box .Box-row > .col-name { flex: 1 1 0 !important; min-width: 0; }
        #targets-box .row-title { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        #targets-box .col-ident, #targets-box .col-tags, #targets-box .col-status { display: none; }
        #targets-box .phone-meta { display: block; font-size: 12px; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        #targets-box .notes-snippet { max-width: 100%; }
        #targets-box .wide-only { display: none; }
        #targets-box .Box-row > .actions { width: auto; flex-wrap: nowrap; }
        /* Column widths are inline flex-basis values (e.g. flex: 0 0 170px);
           once the row stacks vertically those become *heights*, leaving
           huge gaps. Reset them to natural size here. */
        .Box-row > div { flex: 0 0 auto !important; }
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
        { key: "archived", label: "Archived", href: "/archived" },
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
    if (isUp == null) return 'Pending<span class="wide-only"> first check</span>';
    return `<span class="status-badge ${isUp ? "up" : "down"}">${isUp ? "Up" : "Down"}</span> &middot; ${timeAgo(checkedAt)}`;
}

// Status-page grouping: a monitor's *first* tag is its group (untagged ->
// "Other"). Groups are collapsible <details> sections, alphabetical with
// "Other" last; inside each, down/pending monitors sort first. A summary
// line above lists totals and links straight to anything needing attention.
const STATE_ORDER = { down: 0, pending: 1, up: 2, paused: 3 };
function rowState(r) {
    return r.paused ? "paused" : r.is_up == null ? "pending" : r.is_up ? "up" : "down";
}
function escHtml(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function countsHtml(c) {
    return ["down", "pending", "up", "paused"].filter((k) => c[k])
        .map((k) => `<span class="count-item"><span class="dot ${k}"></span>${c[k]} ${k}</span>`).join("");
}
function countStates(rows) {
    const c = { up: 0, down: 0, pending: 0, paused: 0 };
    rows.forEach((r) => { c[rowState(r)]++; });
    return c;
}

export function renderStatusPage(rows, { title = "Status", active = "status", emptyText = "No monitors match your search." } = {}) {
    const headerRow = `
        <div class="Box-row header-row">
            <span style="width:8px"></span>
            <div class="grow">Monitor</div>
            <div style="flex:0 0 170px">Tags</div>
            <div style="flex:0 0 120px">Status</div>
            <div style="min-width:70px">24h</div>
            <div style="min-width:70px">7d</div>
            <div style="min-width:90px">Last down</div>
        </div>`;
    const rowHtml = (r) => `
        <div class="Box-row" data-id="${r.id}" data-search="${escHtml((r.name + " " + r.host + " " + (r.tags || "")).toLowerCase())}">
            <span class="dot ${rowState(r)}"></span>
            <div class="grow col-name">
                ${r.pinned ? '<span class="pin-badge">Pinned</span>' : ""}
                <a href="/monitor/${r.id}"><strong>${r.name}</strong></a>
                <div class="mono col-ident">${targetIdentifier(r)}</div>
            </div>
            <div class="col-tags" style="flex:0 0 170px">${tagPillsHtml(r.tags, "filterByTag")}</div>
            <div class="col-status" style="flex:0 0 120px">${statusHtml(r.paused, r.is_up, r.checked_at)}</div>
            <div class="col-stat" style="min-width:70px">${pct(r.uptime_24h)} <span class="mono">24h</span></div>
            <div class="col-stat" style="min-width:70px">${pct(r.uptime_7d)} <span class="mono">7d</span></div>
            <div class="col-stat mono" style="min-width:90px">down ${timeAgo(r.last_down)}</div>
        </div>`;

    const groups = new Map();
    for (const r of rows) {
        const key = tagList(r.tags)[0] || "Other";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(r);
    }
    const keys = [...groups.keys()].sort((a, b) =>
        (a === "Other") - (b === "Other") || a.localeCompare(b, undefined, { sensitivity: "base" }));
    const groupsHtml = keys.map((key) => {
        // Stable sort: problems first, otherwise keep the server's
        // pinned-then-name order.
        const list = groups.get(key).slice().sort((a, b) => STATE_ORDER[rowState(a)] - STATE_ORDER[rowState(b)]);
        const c = countStates(list);
        return `
        <details class="group" data-group="${escHtml(key)}" data-has-down="${c.down ? 1 : 0}" open>
            <summary><span class="chev" aria-hidden="true"></span><span class="group-name">${escHtml(key)}</span><span class="group-counts">${countsHtml(c)}</span></summary>
            ${list.map(rowHtml).join("")}
        </details>`;
    }).join("");

    const totals = countStates(rows);
    const attention = rows.filter((r) => ["down", "pending"].includes(rowState(r)))
        .sort((a, b) => STATE_ORDER[rowState(a)] - STATE_ORDER[rowState(b)]);
    const summary = rows.length ? `
        <div class="summary-bar">
            <span class="summary-counts">${countsHtml(totals)}</span>
            ${active === "status" ? (attention.length
                ? `<span class="attention">Needs attention: ${attention.map((r) => `<a href="/monitor/${r.id}" class="${rowState(r)}">${r.name}</a>`).join(", ")}</span>`
                : `<span class="all-ok">All monitors up</span>`) : ""}
        </div>` : "";

    return pageShell(title, `
        ${navRow(active)}
        <h1 class="page-title">${title}</h1>
        ${summary}
        <div class="search-box"><input id="search" placeholder="Search by name, host, or tag..." oninput="filterRows()"><span class="search-clear" id="search-clear" onclick="clearSearch()">&times;</span></div>
        <div class="Box" id="rows-box">${headerRow}${groupsHtml}</div>
        <p id="no-results" class="mono" style="display:none">${emptyText}</p>
        <footer>Checked every minute via Cloudflare Workers Cron Triggers + D1</footer>
        <script>
        // Collapsed groups are remembered per browser and per page. A group
        // with a down monitor always opens, so a problem can't hide inside
        // a collapsed section. While searching, every group with a match is
        // opened (without saving that), and the saved state comes back when
        // the search is cleared.
        const COLLAPSE_KEY = "status_collapsed_groups_${active}";
        let collapsed = [];
        try { collapsed = JSON.parse(localStorage.getItem(COLLAPSE_KEY) || "[]"); } catch (e) {}
        let applying = false;
        function applySavedGroups() {
            applying = true;
            document.querySelectorAll("#rows-box details.group").forEach((d) => {
                d.open = d.dataset.hasDown === "1" || !collapsed.includes(d.dataset.group);
            });
            setTimeout(() => { applying = false; }, 0);
        }
        document.querySelectorAll("#rows-box details.group").forEach((d) => {
            d.addEventListener("toggle", () => {
                if (applying || document.getElementById("search").value.trim()) return;
                collapsed = collapsed.filter((g) => g !== d.dataset.group);
                if (!d.open) collapsed.push(d.dataset.group);
                try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsed)); } catch (e) {}
            });
        });
        applySavedGroups();

        function clearSearch() {
            document.getElementById("search").value = "";
            filterRows();
            document.getElementById("search").focus();
        }
        function filterRows() {
            const q = document.getElementById("search").value.trim().toLowerCase();
            document.getElementById("search-clear").classList.toggle("visible", q.length > 0);
            let visible = 0;
            applying = true;
            document.querySelectorAll("#rows-box details.group").forEach((d) => {
                let inGroup = 0;
                d.querySelectorAll(".Box-row").forEach((row) => {
                    const match = !q || row.dataset.search.includes(q);
                    row.style.display = match ? "" : "none";
                    if (match) inGroup++;
                });
                d.style.display = inGroup ? "" : "none";
                if (q && inGroup) d.open = true;
                visible += inGroup;
            });
            setTimeout(() => { applying = false; }, 0);
            if (!q) applySavedGroups();
            document.getElementById("no-results").style.display = visible ? "none" : "block";
        }
        function filterByTag(tag) {
            document.getElementById("search").value = tag;
            filterRows();
        }
        const initialQ = new URLSearchParams(location.search).get("q");
        if (initialQ) { document.getElementById("search").value = initialQ; filterRows(); }

        // Private notes: shown only in a browser that has the admin token
        // saved (from /admin). Fetched here, client-side, so they never enter
        // this edge-cached public HTML; visitors without the token see no
        // change at all. Desktop: hover a name (short delay) and the note card
        // appears under its name -- the mouse can move into the card to
        // select text. Touch: tap the note icon. Esc / outside tap / scroll
        // closes it.
        (function () {
            let token = "";
            try { token = localStorage.getItem("status_admin_token") || ""; } catch (e) {}
            if (!token) return;
            attachAdminMenus();
            fetch("/admin/api/notes", { headers: { Authorization: "Bearer " + token } })
                .then((r) => (r.ok ? r.json() : null))
                .then((notes) => { if (notes) attachNotes(notes); })
                .catch(() => {});
        })();

        // Admin-only "⋯" at the end of each row (same token check as the
        // notes above, so visitors never see it): Edit in Admin opens
        // /admin?edit=<id>, which opens that monitor's edit form directly.
        function attachAdminMenus() {
            let menu = null, openBtn = null;
            function close() {
                if (menu) menu.classList.remove("open");
                if (openBtn) openBtn.setAttribute("aria-expanded", "false");
                openBtn = null;
            }
            function open(btn, id) {
                if (openBtn === btn) return close();
                close();
                if (!menu) {
                    menu = document.createElement("div");
                    menu.className = "row-menu";
                    menu.setAttribute("role", "menu");
                    document.body.appendChild(menu);
                    menu.addEventListener("click", (e) => e.stopPropagation());
                }
                menu.innerHTML = "";
                [["Edit in Admin", "/admin?edit=" + id], ["View details", "/monitor/" + id]].forEach(([label, href]) => {
                    const a = document.createElement("a");
                    a.href = href; a.textContent = label; a.setAttribute("role", "menuitem");
                    menu.appendChild(a);
                });
                menu.classList.add("open");
                const r = btn.getBoundingClientRect();
                const w = menu.offsetWidth, h = menu.offsetHeight;
                let top = r.bottom + 4;
                if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 4);
                menu.style.top = top + "px";
                menu.style.left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)) + "px";
                openBtn = btn;
                btn.setAttribute("aria-expanded", "true");
            }
            document.querySelectorAll("#rows-box .Box-row[data-id]").forEach((row) => {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "more-btn row-more";
                btn.setAttribute("aria-haspopup", "menu");
                btn.setAttribute("aria-expanded", "false");
                btn.setAttribute("aria-label", "More actions");
                btn.innerHTML = "&#x22EF;";
                btn.addEventListener("click", (e) => { e.stopPropagation(); open(btn, row.dataset.id); });
                row.appendChild(btn);
            });
            // Matching spacer so the header columns stay aligned with rows.
            const firstBtn = document.querySelector("#rows-box .row-more");
            const header = document.querySelector("#rows-box .header-row");
            if (firstBtn && header) {
                const spacer = document.createElement("span");
                spacer.style.flex = "0 0 " + firstBtn.offsetWidth + "px";
                header.appendChild(spacer);
            }
            document.addEventListener("click", close);
            document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
            window.addEventListener("scroll", close, { passive: true });
            window.addEventListener("resize", close);
        }
        // Same lightweight markers as the admin page (escape first, so notes
        // can never inject markup). Duplicated there, since each page's
        // script runs separately in the browser.
        function renderNotesHtml(text) {
            let s = (text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            s = s.replace(/\\*\\*(.+?)\\*\\*/g, "<strong>$1</strong>");
            s = s.replace(/\\*(.+?)\\*/g, "<em>$1</em>");
            s = s.replace(/__(.+?)__/g, "<u>$1</u>");
            s = s.replace(/~~(.+?)~~/g, "<del>$1</del>");
            return s.replace(/\\n/g, "<br>");
        }
        function attachNotes(notes) {
            const pop = document.createElement("div");
            pop.className = "note-pop";
            pop.setAttribute("role", "tooltip");
            document.body.appendChild(pop);
            const canHover = window.matchMedia("(hover: hover)").matches;
            let current = null, showTimer = null, hideTimer = null;

            function place(anchor) {
                const r = anchor.getBoundingClientRect();
                const w = pop.offsetWidth, h = pop.offsetHeight;
                const left = Math.max(16, Math.min(r.left, window.innerWidth - w - 16));
                let top = r.bottom + 6;
                if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
                pop.style.left = left + "px";
                pop.style.top = top + "px";
            }
            function show(row) {
                clearTimeout(hideTimer);
                if (current && current !== row) hide();
                current = row;
                pop.innerHTML = '<div class="note-pop-title">Notes \u00b7 only you see this</div>' + renderNotesHtml(notes[row.dataset.id]);
                pop.classList.add("open");
                place(row.querySelector("a") || row);
                row.querySelector(".note-btn").setAttribute("aria-expanded", "true");
            }
            function hide() {
                clearTimeout(showTimer);
                pop.classList.remove("open");
                if (current) current.querySelector(".note-btn").setAttribute("aria-expanded", "false");
                current = null;
            }
            const icon = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Z"/></svg>';

            document.querySelectorAll("#rows-box .Box-row[data-id]").forEach((row) => {
                const note = notes[row.dataset.id];
                if (!note) return;
                row.dataset.search += " " + note.toLowerCase(); // search matches notes too, for you
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "note-btn";
                btn.setAttribute("aria-label", "Show notes");
                btn.setAttribute("aria-expanded", "false");
                btn.innerHTML = icon;
                btn.addEventListener("click", (e) => {
                    e.preventDefault(); e.stopPropagation();
                    if (current === row) hide(); else show(row);
                });
                const link = row.querySelector("a");
                (link || row.querySelector(".grow")).insertAdjacentElement("afterend", btn);
                // Hover trigger is only the name and the note icon, not the
                // whole row -- moving the mouse down the list toward
                // something else shouldn't keep popping cards open.
                if (canHover) {
                    [link, btn].filter(Boolean).forEach((el) => {
                        el.addEventListener("mouseenter", () => {
                            clearTimeout(hideTimer); clearTimeout(showTimer);
                            if (current !== row) showTimer = setTimeout(() => show(row), current ? 0 : 300);
                        });
                        el.addEventListener("mouseleave", () => {
                            clearTimeout(showTimer);
                            hideTimer = setTimeout(hide, 200);
                        });
                    });
                }
            });
            pop.addEventListener("mouseenter", () => clearTimeout(hideTimer));
            pop.addEventListener("mouseleave", () => { hideTimer = setTimeout(hide, 200); });
            document.addEventListener("click", (e) => { if (current && !pop.contains(e.target)) hide(); });
            document.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
            window.addEventListener("scroll", hide, { passive: true });
            window.addEventListener("resize", hide);
        }
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
    const incidentRows = m.incidents365d.list.slice().reverse().map((i) => `
        <tr>
            <td>${formatBrisbaneTime(new Date(i.start))}</td>
            <td>${i.ongoing ? "ongoing" : formatBrisbaneTime(new Date(i.end))}</td>
            <td>${duration(i.end - i.start)}</td>
        </tr>`).join("") || `<tr><td colspan="3" class="mono">No incidents in the last 365 days.</td></tr>`;

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
            <div class="card"><div class="label">365d uptime</div><div class="value">${pct(m.uptime365d.pct)}</div><div class="mono">${m.incidents365d.count} incidents, ${duration(m.incidents365d.totalDownMs)} down</div></div>
            <div class="card ${m.incidents365d.totalDownMs > 0 ? "accent-danger" : "accent-success"}"><div class="label">Total downtime (365d)</div><div class="value">${duration(m.incidents365d.totalDownMs)}</div><div class="mono">${m.incidents365d.count} incidents</div></div>
        </div>

        <h2 class="section-title">Response time (last 30 days)</h2>
        <div class="card">
            ${sparkline(m.latencySeries)}
            <div class="cards" style="margin-top:8px; margin-bottom:0">
                <div><div class="label">Average</div><div class="value">${ms(m.latency30d.avg)}</div></div>
                <div><div class="label">Minimum</div><div class="value">${ms(m.latency30d.min)}</div></div>
                <div><div class="label">Maximum</div><div class="value">${ms(m.latency30d.max)}</div></div>
            </div>
        </div>

        <h2 class="section-title">Incidents (last 365 days)</h2>
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
        <div class="search-box"><input id="search" placeholder="Search by monitor name..." oninput="filterIncidentRows()"><span class="search-clear" id="search-clear" onclick="clearSearch()">&times;</span></div>
        <div class="Box">
            <table>
                <thead><tr><th>Status</th><th>Monitor</th><th>Root Cause</th><th>Started</th><th>Resolved</th><th>Duration</th></tr></thead>
                <tbody id="rows-body">${rows}</tbody>
            </table>
        </div>
        <p id="no-results" class="mono" style="display:none">No incidents match your search.</p>
        <footer>Showing the most recent ${incidents.length} incident${incidents.length === 1 ? "" : "s"} across all monitors</footer>
        <script>
        function clearSearch() {
            document.getElementById("search").value = "";
            filterIncidentRows();
            document.getElementById("search").focus();
        }
        function filterIncidentRows() {
            const q = document.getElementById("search").value.trim().toLowerCase();
            document.getElementById("search-clear").classList.toggle("visible", q.length > 0);
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
            <div class="search-box"><input id="search" placeholder="Search by name, #id, host, tag, or notes..." oninput="renderTargets()"><span class="search-clear" id="search-clear" onclick="clearSearch()">&times;</span></div>
            <div class="seg" id="status-filter" role="group" aria-label="Show monitors">
                <button type="button" data-filter="active" onclick="setStatusFilter('active')">Active <span class="count"></span></button>
                <button type="button" data-filter="paused" onclick="setStatusFilter('paused')">Paused <span class="count"></span></button>
                <button type="button" data-filter="all" onclick="setStatusFilter('all')">All <span class="count"></span></button>
            </div>
            <button class="primary" onclick="openAddModal()">+ Add monitor</button>
        </div>
        <div id="bulk-toolbar" class="Box" style="display:none; padding:10px 16px; margin-bottom:12px; align-items:center; gap:8px; flex-wrap:wrap;">
            <strong id="bulk-count" class="mono"></strong>
            <button onclick="bulkAddTags()">Add tags</button>
            <button onclick="bulkRemoveTags()">Remove tags</button>
            <button onclick="bulkPause()">Pause</button>
            <button onclick="bulkResume()">Resume</button>
            <button class="danger" onclick="bulkReset()">Reset</button>
            <button class="danger" onclick="bulkDelete()">Delete</button>
            <button class="link" onclick="clearSelection()">Clear selection</button>
        </div>
        <div class="Box" id="targets-box"></div>

        <div class="modal-backdrop" id="monitor-modal-backdrop" onmousedown="backdropPressed = (event.target === this)" onclick="onBackdropClick(event, this)">
        <div class="modal" id="monitor-modal">
            <div class="modal-header">
                <h2 id="modal-title">Add monitor</h2>
                <button class="link" onclick="closeModal()">Close</button>
            </div>
            <div class="form-row">
                <div class="field grow"><label>Name</label><input id="new-name" placeholder="e.g. Shenzhen - forward (443)" /></div>
                <div class="field" style="flex:0 0 140px">
                    <label>Type</label>
                    <select id="new-type" onchange="onTypeChange('new', this.value)">
                        <option value="port">Port (TCP)</option>
                        <option value="http">HTTP</option>
                        <option value="dns">DNS</option>
                        <option value="heartbeat">Heartbeat (push)</option>
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
            <div id="new-fields-heartbeat" style="margin-top:8px; display:none">
                <div class="form-row">
                    <div class="field" style="flex:0 0 200px"><label>Grace period (minutes)</label><input id="new-graceMinutes" placeholder="5" type="number" min="2" max="14400" /></div>
                    <div class="field grow"><label>&nbsp;</label><div class="mono">Marked down if no push arrives within this window (confirmed on the next check, so alerts land ~1-2 min later).</div></div>
                </div>
                <div class="field" style="margin-top:8px">
                    <label>Push URL</label>
                    <div id="heartbeat-url-box" class="mono">Generated when you save.</div>
                </div>
            </div>
            <div class="form-row" style="margin-top:8px">
                <div class="field grow"><label>Tags <span class="mono">(the first tag is its group on the Status page)</span></label><input id="new-tags" placeholder="comma-separated, e.g. mac, jellyfin" /></div>
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
            <div style="margin-top:16px"><button class="primary" id="modal-submit-btn" onclick="saveModal()">Add monitor</button></div>
        </div>
        </div>

        <script>
        const TOKEN_KEY = "status_admin_token";
        let targets = [];
        let editingId = null;
        let modalSnapshot = null;

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
            if (t.type === "heartbeat") return "Heartbeat (every \u2264" + ((t.config && t.config.graceMinutes) || 5) + " min)" +
                (t.last_push_at ? " \u00b7 last push " + timeAgo(t.last_push_at) : " \u00b7 no push yet");
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
            const stateText = t.paused ? "Paused" : (t.is_up == null ? 'Pending<span class="wide-only"> first check</span>' :
                '<span class="status-badge ' + (t.is_up ? "up" : "down") + '">' + (t.is_up ? "Up" : "Down") + "</span> \\u00b7 " + timeAgo(t.checked_at));
            // Escaped: this one-line preview is inserted as HTML (the full
            // notes go through renderNotesHtml(), which escapes too).
            const notesPreview = escapeHtml((t.notes || "").replace(/\\s+/g, " ").slice(0, 100));
            return \`<div class="Box-row" data-id="\${t.id}">
                <input type="checkbox" class="row-checkbox" data-id="\${t.id}" onchange="updateBulkToolbar()" />
                <span class="dot \${dotClass}"></span>
                <div class="grow col-name">
                    <strong class="row-title">\${t.pinned ? '<span class="pin-badge">Pinned</span>' : ""}<span class="id-badge">#\${t.id}</span>\${t.name}</strong>
                    <div class="mono col-ident">\${targetIdentifier(t)}</div>
                    <div class="mono phone-meta">\${stateText} \\u00b7 \${targetIdentifier(t)}</div>
                    \${t.notes ? \`<div class="notes-snippet" onclick="toggleNotes(\${t.id})">\${notesPreview}\${t.notes.length > 100 ? "…" : ""}</div>
                    <div class="notes-full" id="notes-full-\${t.id}" style="display:none">\${renderNotesHtml(t.notes)}</div>\` : ""}
                </div>
                <div class="col-tags" style="flex:0 0 170px">\${tagPills(t.tags)}</div>
                <div class="mono col-status" style="flex:0 0 120px">\${stateText}</div>
                <div class="actions">
                    <button onclick="openEditModal(\${t.id})">Edit</button>
                    <button class="more-btn" aria-haspopup="menu" aria-expanded="false" aria-label="More actions for \${t.name}" onclick="openRowMenu(event, \${t.id})">&#x22EF;</button>
                </div>
            </div>\`;
        }

        // Push URL is shown only for an already-saved heartbeat monitor (the
        // token is minted server-side on save). Built with DOM APIs, not
        // innerHTML, and includes a ready-to-paste curl line.
        function renderPushUrl(t) {
            const box = document.getElementById("heartbeat-url-box");
            box.textContent = "";
            if (!t || !t.push_token) { box.textContent = "Generated when you save."; return; }
            const url = location.origin + "/push/" + t.push_token;
            const code = document.createElement("code");
            code.textContent = url;
            code.style.userSelect = "all";
            code.style.wordBreak = "break-all";
            const copy = document.createElement("button");
            copy.type = "button"; copy.className = "link"; copy.textContent = "Copy";
            copy.onclick = () => navigator.clipboard.writeText(url).then(() => { copy.textContent = "Copied"; });
            const rotate = document.createElement("button");
            rotate.type = "button"; rotate.className = "danger"; rotate.textContent = "Rotate";
            rotate.onclick = () => rotateToken(t.id);
            const hint = document.createElement("div");
            hint.textContent = "e.g. every minute: curl -fsS -m 10 " + url;
            hint.style.marginTop = "4px";
            box.append(code, " ", copy, " ", rotate, hint);
        }
        async function rotateToken(id) {
            if (!confirm("Rotate the push URL? The old URL stops working immediately -- update every client that uses it.")) return;
            const updated = await api(\`/admin/api/targets/\${id}/rotate-token\`, { method: "POST" });
            const t = targets.find((x) => x.id === id);
            if (t && updated && updated.push_token) { t.push_token = updated.push_token; renderPushUrl(t); }
            loadTargets();
        }

        function onTypeChange(prefix, type) {
            ["port", "http", "dns", "heartbeat"].forEach((t) => {
                const el = document.getElementById(prefix + "-fields-" + t);
                if (el) el.style.display = (t === type) ? "" : "none";
            });
        }

        function matchesSearch(t, q) {
            if (!q) return true;
            if (/^#\\d+$/.test(q)) return String(t.id) === q.slice(1); // "#13" finds monitor 13
            const haystack = [t.name, t.host, t.tags, t.notes].filter(Boolean).join(" ").toLowerCase();
            return haystack.includes(q);
        }

        const targetsHeaderRow = '<div class="Box-row header-row">' +
            '<input type="checkbox" id="select-all" onchange="toggleSelectAll(this.checked)" />' +
            '<span style="width:8px"></span>' +
            '<div class="grow">Monitor</div>' +
            '<div style="flex:0 0 170px">Tags</div>' +
            '<div style="flex:0 0 120px">Status</div>' +
            '<div class="actions">Actions</div>' +
            '</div>';
        // Active / Paused / All -- mirrors the public Status vs Archived split
        // so paused monitors don't clutter the working list. Remembered per
        // browser; defaults to Active. Counts reflect the current search.
        const FILTER_KEY = "status_admin_filter";
        let statusFilter = "active";
        try { statusFilter = localStorage.getItem(FILTER_KEY) || "active"; } catch (e) {}
        function setStatusFilter(f) {
            statusFilter = f;
            try { localStorage.setItem(FILTER_KEY, f); } catch (e) {}
            clearSelection();
            renderTargets();
        }
        function renderTargets() {
            const q = (document.getElementById("search")?.value || "").trim().toLowerCase();
            document.getElementById("search-clear").classList.toggle("visible", q.length > 0);
            const matched = targets.filter((t) => matchesSearch(t, q));
            const counts = { active: matched.filter((t) => !t.paused).length, paused: matched.filter((t) => t.paused).length, all: matched.length };
            document.querySelectorAll("#status-filter button").forEach((b) => {
                const f = b.dataset.filter;
                b.classList.toggle("active", f === statusFilter);
                b.setAttribute("aria-pressed", f === statusFilter ? "true" : "false");
                b.querySelector(".count").textContent = counts[f];
            });
            const visible = matched.filter((t) => statusFilter === "all" || (statusFilter === "paused" ? t.paused : !t.paused));
            const emptyText = !targets.length ? "No monitors yet -- add one below."
                : q ? "No " + (statusFilter === "all" ? "" : statusFilter + " ") + "monitors match your search."
                : statusFilter === "paused" ? "No paused monitors." : "No active monitors.";
            document.getElementById("targets-box").innerHTML = targetsHeaderRow + (
                visible.map((t) => viewRow(t)).join("") || '<div class="Box-row mono">' + emptyText + '</div>'
            );
        }
        function clearSearch() {
            document.getElementById("search").value = "";
            renderTargets();
            document.getElementById("search").focus();
        }
        function filterByTag(tag) {
            document.getElementById("search").value = tag;
            renderTargets();
        }

        // /admin?edit=<id> (from the status page's "⋯ > Edit in Admin")
        // opens that monitor's edit form once the list has loaded -- after
        // the token is entered, if it wasn't saved yet. The param is then
        // dropped from the URL so a refresh doesn't reopen the form.
        let pendingEditId = Number(new URLSearchParams(location.search).get("edit")) || null;
        async function loadTargets() {
            try {
                targets = await api("/admin/api/targets");
                renderTargets();
                if (pendingEditId) {
                    const id = pendingEditId;
                    pendingEditId = null;
                    history.replaceState(null, "", location.pathname);
                    if (targets.some((t) => t.id === id)) openEditModal(id);
                }
            } catch (e) {}
        }
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
            } else if (type === "heartbeat") {
                host = "heartbeat"; // placeholder; the server ignores it for this type
                config = { graceMinutes: Number(get("graceMinutes")) || 5 };
            } else {
                host = get("port-host");
                port = Number(get("port-num")) || 0;
            }
            return { name, type, host, port, tags, notes, config };
        }

        async function togglePause(id, paused) {
            await api(\`/admin/api/targets/\${id}/\${paused ? "resume" : "pause"}\`, { method: "POST" });
            loadTargets();
        }
        async function togglePin(id, pinned) {
            await api(\`/admin/api/targets/\${id}/\${pinned ? "unpin" : "pin"}\`, { method: "POST" });
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

        // "⋯" row menu: keeps each admin row to Edit + one menu button
        // instead of six buttons (much calmer on a phone). One shared menu
        // element, rebuilt per open from the row's current pinned/paused
        // state. Closes on outside click, Esc, scroll or resize.
        let rowMenu = null, rowMenuBtn = null;
        function closeRowMenu() {
            if (rowMenu) rowMenu.classList.remove("open");
            if (rowMenuBtn) rowMenuBtn.setAttribute("aria-expanded", "false");
            rowMenuBtn = null;
        }
        function openRowMenu(e, id) {
            e.stopPropagation();
            const btn = e.currentTarget;
            if (rowMenuBtn === btn) return closeRowMenu();
            closeRowMenu();
            const t = targets.find((x) => x.id === id);
            if (!t) return;
            if (!rowMenu) {
                rowMenu = document.createElement("div");
                rowMenu.className = "row-menu";
                rowMenu.setAttribute("role", "menu");
                document.body.appendChild(rowMenu);
                rowMenu.addEventListener("click", (ev) => ev.stopPropagation());
            }
            const items = [
                [t.pinned ? "Unpin" : "Pin to top", () => togglePin(id, t.pinned)],
                [t.paused ? "Resume" : "Pause", () => togglePause(id, t.paused)],
                ["Test notify", () => testNotify(id)],
                null,
                ["Reset history…", () => resetTarget(id), "danger"],
                ["Delete…", () => removeTarget(id), "danger"],
            ];
            rowMenu.innerHTML = "";
            items.forEach((it) => {
                if (!it) { const hr = document.createElement("div"); hr.className = "row-menu-sep"; rowMenu.appendChild(hr); return; }
                const b = document.createElement("button");
                b.type = "button"; b.setAttribute("role", "menuitem"); b.textContent = it[0];
                if (it[2]) b.className = it[2];
                b.onclick = () => { closeRowMenu(); it[1](); };
                rowMenu.appendChild(b);
            });
            rowMenu.classList.add("open");
            const r = btn.getBoundingClientRect();
            const w = rowMenu.offsetWidth, h = rowMenu.offsetHeight;
            let top = r.bottom + 4;
            if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 4);
            rowMenu.style.top = top + "px";
            rowMenu.style.left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)) + "px";
            rowMenuBtn = btn;
            btn.setAttribute("aria-expanded", "true");
            rowMenu.querySelector("button").focus();
        }
        document.addEventListener("click", closeRowMenu);
        document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeRowMenu(); });
        window.addEventListener("scroll", closeRowMenu, { passive: true });
        window.addEventListener("resize", closeRowMenu);

        function getSelectedIds() {
            return Array.from(document.querySelectorAll(".row-checkbox:checked")).map((el) => Number(el.dataset.id));
        }
        function updateBulkToolbar() {
            const count = getSelectedIds().length;
            const toolbar = document.getElementById("bulk-toolbar");
            toolbar.style.display = count > 0 ? "flex" : "none";
            document.getElementById("bulk-count").textContent = count + " selected";
        }
        function toggleSelectAll(checked) {
            document.querySelectorAll(".row-checkbox").forEach((el) => { el.checked = checked; });
            updateBulkToolbar();
        }
        function clearSelection() {
            document.querySelectorAll(".row-checkbox").forEach((el) => { el.checked = false; });
            const selectAll = document.getElementById("select-all");
            if (selectAll) selectAll.checked = false;
            updateBulkToolbar();
        }
        // Full replace-payload for a target, since PUT replaces every field --
        // spread the target's current values and override just what changed.
        function targetToPayload(t, overrides) {
            return { name: t.name, type: t.type, host: t.host, port: t.port, config: t.config, tags: t.tags, notes: t.notes, ...overrides };
        }
        async function bulkPause() {
            const ids = getSelectedIds();
            if (!ids.length) return;
            if (!confirm(\`Pause \${ids.length} monitor(s)?\`)) return;
            for (const id of ids) await api(\`/admin/api/targets/\${id}/pause\`, { method: "POST" });
            clearSelection();
            loadTargets();
        }
        async function bulkResume() {
            const ids = getSelectedIds();
            if (!ids.length) return;
            for (const id of ids) await api(\`/admin/api/targets/\${id}/resume\`, { method: "POST" });
            clearSelection();
            loadTargets();
        }
        async function bulkReset() {
            const ids = getSelectedIds();
            if (!ids.length) return;
            if (!confirm(\`Reset \${ids.length} monitor(s)? This permanently deletes their check history -- uptime %, incidents, and response times all start fresh for each one.\`)) return;
            for (const id of ids) await api(\`/admin/api/targets/\${id}/reset\`, { method: "POST" });
            clearSelection();
            loadTargets();
        }
        async function bulkDelete() {
            const ids = getSelectedIds();
            if (!ids.length) return;
            if (!confirm(\`Delete \${ids.length} monitor(s) and all their history? This cannot be undone.\`)) return;
            for (const id of ids) await api(\`/admin/api/targets/\${id}\`, { method: "DELETE" });
            clearSelection();
            loadTargets();
        }
        async function bulkAddTags() {
            const ids = getSelectedIds();
            if (!ids.length) return;
            const input = prompt(\`Add tags to \${ids.length} monitor(s), comma-separated:\`);
            if (!input) return;
            const toAdd = input.split(",").map((s) => s.trim()).filter(Boolean);
            if (!toAdd.length) return;
            for (const id of ids) {
                const t = targets.find((x) => x.id === id);
                if (!t) continue;
                const existing = (t.tags || "").split(",").map((s) => s.trim()).filter(Boolean);
                const merged = Array.from(new Set([...existing, ...toAdd]));
                await api(\`/admin/api/targets/\${id}\`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(targetToPayload(t, { tags: merged.join(", ") })) });
            }
            clearSelection();
            loadTargets();
        }
        async function bulkRemoveTags() {
            const ids = getSelectedIds();
            if (!ids.length) return;
            const input = prompt(\`Remove tags from \${ids.length} monitor(s), comma-separated:\`);
            if (!input) return;
            const toRemove = input.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
            if (!toRemove.length) return;
            for (const id of ids) {
                const t = targets.find((x) => x.id === id);
                if (!t) continue;
                const existing = (t.tags || "").split(",").map((s) => s.trim()).filter(Boolean);
                const remaining = existing.filter((tag) => !toRemove.includes(tag.toLowerCase()));
                await api(\`/admin/api/targets/\${id}\`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(targetToPayload(t, { tags: remaining.join(", ") })) });
            }
            clearSelection();
            loadTargets();
        }

        function snapshotModalFields() {
            const fields = ["name", "type", "port-host", "port-num", "http-url", "expectedStatus", "keyword", "dns-hostname", "recordType", "expectedValue", "graceMinutes", "tags", "notes"];
            return fields.map((f) => { const el = document.getElementById("new-" + f); return el ? el.value : ""; }).join("\\u0001");
        }
        function clearModalFields() {
            ["name", "port-host", "port-num", "http-url", "expectedStatus", "keyword", "dns-hostname", "expectedValue", "graceMinutes", "tags", "notes"].forEach((field) => {
                const el = document.getElementById("new-" + field);
                if (el) el.value = "";
            });
            document.getElementById("new-type").value = "port";
            document.getElementById("new-recordType").value = "A";
            renderPushUrl(null);
            onTypeChange("new", "port");
        }
        function fillModalFields(t) {
            const type = t.type || "port";
            const cfg = t.config || {};
            document.getElementById("new-name").value = t.name || "";
            document.getElementById("new-type").value = type;
            onTypeChange("new", type);
            document.getElementById("new-port-host").value = type === "port" ? (t.host || "") : "";
            document.getElementById("new-port-num").value = type === "port" ? (t.port || "") : "";
            document.getElementById("new-http-url").value = type === "http" ? (t.host || "") : "";
            document.getElementById("new-expectedStatus").value = cfg.expectedStatus || "";
            document.getElementById("new-keyword").value = cfg.keyword || "";
            document.getElementById("new-dns-hostname").value = type === "dns" ? (t.host || "") : "";
            document.getElementById("new-recordType").value = cfg.recordType || "A";
            document.getElementById("new-expectedValue").value = cfg.expectedValue || "";
            document.getElementById("new-graceMinutes").value = type === "heartbeat" ? (cfg.graceMinutes || 5) : "";
            renderPushUrl(type === "heartbeat" ? t : null);
            document.getElementById("new-tags").value = t.tags || "";
            document.getElementById("new-notes").value = t.notes || "";
        }
        function openAddModal() {
            editingId = null;
            clearModalFields();
            document.getElementById("modal-title").textContent = "Add monitor";
            document.getElementById("modal-submit-btn").textContent = "Add monitor";
            document.getElementById("monitor-modal-backdrop").classList.add("open");
            modalSnapshot = snapshotModalFields();
        }
        function openEditModal(id) {
            const t = targets.find((x) => x.id === id);
            if (!t) return;
            editingId = id;
            fillModalFields(t);
            document.getElementById("modal-title").textContent = "Edit monitor #" + id;
            document.getElementById("modal-submit-btn").textContent = "Save changes";
            document.getElementById("monitor-modal-backdrop").classList.add("open");
            modalSnapshot = snapshotModalFields();
        }
        // force=true skips the unsaved-changes check -- used right after a
        // successful save, where there's nothing left to discard.
        function closeModal(force) {
            if (!force && modalSnapshot !== null && snapshotModalFields() !== modalSnapshot) {
                if (!confirm("Discard unsaved changes?")) return;
            }
            document.getElementById("monitor-modal-backdrop").classList.remove("open");
            editingId = null;
            modalSnapshot = null;
        }
        document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

        // Guards against losing a half-filled Add/Edit form by accident:
        // 1. A click only counts as "outside" if the press *started* on the
        //    backdrop -- selecting text in a field and releasing the mouse
        //    past the modal edge used to land a click on the backdrop and
        //    close it.
        // 2. With unsaved changes, an outside click never closes (not even
        //    behind a confirm, which is easy to OK by reflex) -- the modal
        //    just nudges. Close / Esc still work, with the confirm.
        // 3. Reloading or leaving the page with unsaved changes asks first.
        let backdropPressed = false;
        function modalDirty() {
            const open = document.getElementById("monitor-modal-backdrop").classList.contains("open");
            return open && modalSnapshot !== null && snapshotModalFields() !== modalSnapshot;
        }
        function onBackdropClick(e, backdrop) {
            const pressedHere = backdropPressed;
            backdropPressed = false;
            if (e.target !== backdrop || !pressedHere) return;
            if (!modalDirty()) return closeModal(true);
            const m = document.getElementById("monitor-modal");
            m.classList.remove("nudge"); void m.offsetWidth; m.classList.add("nudge");
        }
        window.addEventListener("beforeunload", (e) => {
            if (modalDirty()) { e.preventDefault(); e.returnValue = ""; }
        });

        async function saveModal() {
            const get = (field) => {
                const el = document.getElementById("new-" + field);
                return el ? el.value : "";
            };
            const body = buildPayload(get);
            if (!body.name || !body.host) return alert("name and host/URL/hostname are required");
            if (editingId) {
                await api(\`/admin/api/targets/\${editingId}\`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            } else {
                await api("/admin/api/targets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            }
            closeModal(true);
            loadTargets();
        }
        if (!getToken()) document.getElementById("auth-box").style.display = "block";
        loadTargets();
        </script>
    `);
}
