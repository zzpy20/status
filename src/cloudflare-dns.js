// Cloudflare's own DNS API -- plain Bearer-token auth, no signing needed.
// Ported directly from sync-dns.sh's curl calls.

const CF_API = "https://api.cloudflare.com/client/v4";

// Returns { recordId, currentIp } for the A record, or null if not found.
export async function getDnsRecord(env, hostname) {
    const res = await fetch(`${CF_API}/zones/${env.CF_ZONE_ID}/dns_records?type=A&name=${hostname}`, {
        headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, "Content-Type": "application/json" },
    });
    const body = await res.json();
    const record = body.result?.[0];
    if (!record) return null;
    return { recordId: record.id, currentIp: record.content };
}

export async function updateDnsRecord(env, recordId, newIp) {
    const res = await fetch(`${CF_API}/zones/${env.CF_ZONE_ID}/dns_records/${recordId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content: newIp }),
    });
    const body = await res.json();
    if (!body.success) {
        throw new Error(`Cloudflare DNS update failed: ${JSON.stringify(body.errors)}`);
    }
}
