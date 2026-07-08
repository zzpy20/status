import { formatBrisbaneTime } from "./time.js";
import { targetIdentifier } from "./identifier.js";

function emailHtml({ target, isUp, monitorUrl }) {
    const stateWord = isUp ? "up" : "down";
    const stateColor = isUp ? "#1a7f37" : "#cf222e";
    let hostname = "";
    try { hostname = new URL(monitorUrl).hostname; } catch {}
    return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f6f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2328">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #d0d7de;border-radius:6px;overflow:hidden">
<tr><td style="background:#0d1117;padding:24px 28px">
    <span style="color:#3fb950;font-size:20px;line-height:1">&#9679;</span>
    <span style="color:#e6edf3;font-size:18px;font-weight:600;margin-left:6px">status</span>
    <div style="color:#ffffff;font-size:26px;font-weight:700;margin-top:16px">${target.name} is <span style="color:${isUp ? "#3fb950" : "#f85149"}">${stateWord}</span>.</div>
</td></tr>
<tr><td style="padding:28px">
    <p style="margin:0 0 16px;font-size:15px">We detected ${isUp ? "a recovery" : "an incident"} on your monitor. Your service is currently <strong>${stateWord}</strong>.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fa;border:1px solid #d8dee4;border-radius:6px">
        <tr><td style="padding:12px 16px;border-bottom:1px solid #d8dee4">
            <div style="font-size:12px;color:#656d76;text-transform:uppercase">Monitor name</div>
            <div style="font-size:14px;font-weight:600">${target.name}</div>
        </td></tr>
        <tr><td style="padding:12px 16px;border-bottom:1px solid #d8dee4">
            <div style="font-size:12px;color:#656d76;text-transform:uppercase">Checked</div>
            <div style="font-size:14px;font-weight:600;font-family:ui-monospace,monospace">${targetIdentifier(target)}</div>
        </td></tr>
        <tr><td style="padding:12px 16px">
            <div style="font-size:12px;color:#656d76;text-transform:uppercase">Time</div>
            <div style="font-size:14px;font-weight:600">${formatBrisbaneTime()}</div>
        </td></tr>
    </table>
    <p style="margin:20px 0 0"><a href="${monitorUrl}" style="color:${stateColor};font-weight:600;text-decoration:none">View monitor &rarr;</a></p>
</td></tr>
${hostname ? `<tr><td style="padding:0 28px 20px"><p style="margin:0;font-size:11px;color:#9198a1">Powered by ${hostname}</p></td></tr>` : ""}
</table>
</body></html>`;
}

export async function sendEmail(env, { target, isUp, monitorUrl }) {
    if (!env.RESEND_API_KEY || !env.OWNER_EMAIL) {
        return { sent: false, reason: "RESEND_API_KEY or OWNER_EMAIL not set" };
    }
    const from = env.RESEND_FROM || "Status <onboarding@resend.dev>";
    const subject = `${target.name} is ${isUp ? "up" : "down"}`;
    try {
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                from,
                to: env.OWNER_EMAIL,
                subject,
                html: emailHtml({ target, isUp, monitorUrl }),
            }),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => "");
            console.error(`resend send failed: ${res.status} ${res.statusText} -- ${body}`);
            return { sent: false, reason: `${res.status} ${res.statusText}` };
        }
        return { sent: true };
    } catch (err) {
        console.error("resend send threw:", err.stack || err.message || String(err));
        return { sent: false, reason: err.message || String(err) };
    }
}
