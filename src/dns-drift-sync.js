import { describeInstancePublicIp } from "./aliyun.js";
import { getDnsRecord, updateDnsRecord } from "./cloudflare-dns.js";
import { sendTelegram } from "./telegram.js";

// Keeps Shenzhen-Reality's DNS records in sync with reality: both ECS boxes
// are Aliyun spot instances with no static EIP, so a reclaim/restart silently
// hands them a new public IP while DNS keeps pointing at the old dead one.
// Runs on every scheduled() tick alongside the uptime checks -- merged in
// here (rather than its own Worker) because the account is already at
// Cloudflare's 5-cron-trigger limit; see Shenzhen-Reality's README for the
// history. Mirrors Shenzhen-Reality/sync-dns.sh's sync_record(), which
// remains as a manual fallback.
async function syncRecord(env, { hostname, region, instanceId }) {
    const { publicIp: actualIp, status } = await describeInstancePublicIp(env, region, instanceId);
    if (!actualIp) {
        return { hostname, ok: false, reason: `could not determine instance IP (status=${status})` };
    }

    const record = await getDnsRecord(env, hostname);
    if (!record) {
        return { hostname, ok: false, reason: "no Cloudflare A record found" };
    }

    if (record.currentIp === actualIp) {
        return { hostname, ok: true, drifted: false, ip: actualIp };
    }

    await updateDnsRecord(env, record.recordId, actualIp);
    await sendTelegram(
        env,
        `🛰️ Spot instance IP drift auto-fixed\n${hostname}: ${record.currentIp} → ${actualIp}\n🕐 ${new Date().toISOString()}`
    );
    return { hostname, ok: true, drifted: true, from: record.currentIp, to: actualIp };
}

export async function syncDnsAll(env) {
    if (!env.SZ_INSTANCE_ID || !env.SG_INSTANCE_ID) return [];
    const targets = [
        { hostname: env.SZ_HOSTNAME, region: env.SZ_REGION, instanceId: env.SZ_INSTANCE_ID },
        { hostname: env.SG_HOSTNAME, region: env.SG_REGION, instanceId: env.SG_INSTANCE_ID },
    ];
    const results = [];
    for (const t of targets) {
        try {
            results.push(await syncRecord(env, t));
        } catch (err) {
            console.error(`dns-sync failed for ${t.hostname}:`, err.stack || err.message || String(err));
            results.push({ hostname: t.hostname, ok: false, reason: err.message || String(err) });
        }
    }
    return results;
}
