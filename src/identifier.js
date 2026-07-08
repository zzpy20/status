// Human-readable "what is this checking" string, per monitor type. Shared
// between server-rendered pages (index.js, render.js) -- the admin page's
// client-side script keeps its own duplicate copy since it runs in the
// browser, not the Worker.
export function targetIdentifier(t) {
    if (t.type === "http") return t.host;
    if (t.type === "dns") return `${t.host} (${(t.config && t.config.recordType) || "A"} record)`;
    return `${t.host}:${t.port}`;
}
