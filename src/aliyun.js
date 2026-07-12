// Aliyun ECS OpenAPI request signing (RPC-style Signature Version 1.0).
// Unlike Cloudflare's simple Bearer-token auth, every Aliyun API request must
// be signed: build a canonicalized, sorted query string, then HMAC-SHA1 it
// with the AccessKeySecret. Algorithm verified standalone (plain Node) against
// the real API before ever being wired into this Worker -- see the repo's
// dns-sync-worker/README.md for the full walkthrough.

// Aliyun's percent-encoding is stricter than encodeURIComponent: it also
// escapes '*' and leaves '~' unescaped.
function percentEncode(str) {
    return encodeURIComponent(str)
        .replace(/\+/g, "%20")
        .replace(/\*/g, "%2A")
        .replace(/%7E/g, "~");
}

async function hmacSha1Base64(key, message) {
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(key),
        { name: "HMAC", hash: "SHA-1" },
        false,
        ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

function isoTimestamp() {
    return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

async function buildSignedUrl({ action, region, params, accessKeyId, accessKeySecret }) {
    const allParams = {
        Format: "JSON",
        Version: "2014-05-26",
        AccessKeyId: accessKeyId,
        SignatureMethod: "HMAC-SHA1",
        Timestamp: isoTimestamp(),
        SignatureVersion: "1.0",
        SignatureNonce: crypto.randomUUID(),
        Action: action,
        ...params,
    };

    const sortedKeys = Object.keys(allParams).sort();
    const canonicalizedQueryString = sortedKeys
        .map((k) => `${percentEncode(k)}=${percentEncode(String(allParams[k]))}`)
        .join("&");

    const stringToSign = `GET&${percentEncode("/")}&${percentEncode(canonicalizedQueryString)}`;
    const signature = await hmacSha1Base64(`${accessKeySecret}&`, stringToSign);

    return `https://ecs.${region}.aliyuncs.com/?${canonicalizedQueryString}&Signature=${percentEncode(signature)}`;
}

// Returns { publicIp, status } for a single instance, or throws on API error.
export async function describeInstancePublicIp(env, region, instanceId) {
    const url = await buildSignedUrl({
        action: "DescribeInstances",
        region,
        params: { RegionId: region, InstanceIds: JSON.stringify([instanceId]) },
        accessKeyId: env.ALIYUN_ACCESS_KEY_ID,
        accessKeySecret: env.ALIYUN_ACCESS_KEY_SECRET,
    });
    const res = await fetch(url);
    const body = await res.json();
    if (!res.ok || body.Code) {
        throw new Error(`Aliyun API error: ${res.status} ${body.Code || ""} ${body.Message || JSON.stringify(body)}`);
    }
    const instance = body.Instances?.Instance?.[0];
    // Auto-allocated (NAT) public IPs report under PublicIpAddress; EIP-bound
    // instances report under EipAddress instead -- same fallback sync-dns.sh
    // already uses (`.PublicIpAddress.IpAddress[0] // .EipAddress.IpAddress`).
    return {
        publicIp: instance?.PublicIpAddress?.IpAddress?.[0] || instance?.EipAddress?.IpAddress || null,
        status: instance?.Status,
    };
}
