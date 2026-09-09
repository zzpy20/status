import { sendTelegram } from "./telegram.js";

// Cloudflare's D1 free tier hard caps -- see
// https://developers.cloudflare.com/d1/platform/limits/. These are
// account-wide, shared across every D1 database on the account, which is
// exactly why a bug in one project (this one) broke an unrelated project
// (my-links-app) five times in the space of a few days -- see
// docs/incidents/2026-09-06-d1-quota-exhaustion.md. Cloudflare offers no
// built-in proactive alert for D1 usage (checked directly in the
// dashboard's Notifications settings -- "Usage Based Billing" alerts only
// cover R2), so this exists to be the thing that would have caught every
// one of those five incidents same-day instead of via Cloudflare's
// after-the-fact "you're now blocked" email.
const D1_DAILY_ROWS_READ_LIMIT = 5_000_000;
const D1_DAILY_ROWS_WRITTEN_LIMIT = 100_000;
const WARN_THRESHOLD = 0.7;

export async function fetchD1UsageToday(env) {
    const today = new Date().toISOString().slice(0, 10); // UTC calendar day, matches the quota's own reset boundary
    const query = `query($accountTag: string!, $date: string!) {
        viewer {
            accounts(filter: { accountTag: $accountTag }) {
                d1AnalyticsAdaptiveGroups(limit: 20, filter: { date: $date }) {
                    sum { rowsRead rowsWritten }
                    dimensions { databaseId }
                }
            }
        }
    }`;
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${env.D1_USAGE_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables: { accountTag: env.CF_ACCOUNT_ID, date: today } }),
    });
    if (!res.ok) throw new Error(`D1 usage analytics fetch failed: ${res.status} ${res.statusText}`);
    const body = await res.json();
    if (body.errors) throw new Error(`D1 usage analytics query error: ${JSON.stringify(body.errors)}`);

    const groups = body.data?.viewer?.accounts?.[0]?.d1AnalyticsAdaptiveGroups || [];
    const totalRowsRead = groups.reduce((sum, g) => sum + g.sum.rowsRead, 0);
    const totalRowsWritten = groups.reduce((sum, g) => sum + g.sum.rowsWritten, 0);
    const perDatabase = groups
        .map((g) => ({ databaseId: g.dimensions.databaseId, rowsRead: g.sum.rowsRead, rowsWritten: g.sum.rowsWritten }))
        .sort((a, b) => b.rowsRead - a.rowsRead);
    return { today, totalRowsRead, totalRowsWritten, perDatabase };
}

// Checks today's account-wide D1 usage (via Cloudflare's GraphQL Analytics
// API -- this does NOT itself consume any D1 quota, it's a separate
// system) and sends one Telegram alert per UTC day if either the rows-read
// or rows-written total crosses 70% of the free-tier cap. Meant to be
// called every ~15 minutes from scheduled() (see index.js), not on every
// tick -- frequent enough to catch a runaway within the hour, not so
// frequent it adds meaningful cost of its own.
export async function checkD1UsageAndAlert(env) {
    if (!env.D1_USAGE_TOKEN || !env.CF_ACCOUNT_ID) return;

    let usage;
    try {
        usage = await fetchD1UsageToday(env);
    } catch (err) {
        console.error("D1 usage check failed:", err.stack || err.message || String(err));
        return;
    }

    const readPct = usage.totalRowsRead / D1_DAILY_ROWS_READ_LIMIT;
    const writePct = usage.totalRowsWritten / D1_DAILY_ROWS_WRITTEN_LIMIT;
    if (readPct < WARN_THRESHOLD && writePct < WARN_THRESHOLD) return;

    // At most one alert per UTC day: INSERT into a PK'd (date) table and
    // treat a conflict (already alerted today) as "nothing to do". Cheap
    // and atomic -- no separate read-then-write race.
    try {
        await env.DB.prepare("INSERT INTO usage_alerts (date, alerted_at) VALUES (?, ?)")
            .bind(usage.today, Date.now()).run();
    } catch {
        return;
    }

    const top = usage.perDatabase.slice(0, 3)
        .map((d) => `  ${d.databaseId.slice(0, 8)}...  ${d.rowsRead.toLocaleString()} read, ${d.rowsWritten.toLocaleString()} written`)
        .join("\n");
    await sendTelegram(env,
        `D1 usage warning (${usage.today} UTC)\n` +
        `Account-wide rows read: ${usage.totalRowsRead.toLocaleString()} / ${D1_DAILY_ROWS_READ_LIMIT.toLocaleString()} (${Math.round(readPct * 100)}%)\n` +
        `Account-wide rows written: ${usage.totalRowsWritten.toLocaleString()} / ${D1_DAILY_ROWS_WRITTEN_LIMIT.toLocaleString()} (${Math.round(writePct * 100)}%)\n` +
        `Top databases by reads today:\n${top}`
    );
}
