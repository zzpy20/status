import { sendTelegram } from "./telegram.js";
import { sendEmail } from "./email.js";

// Fires every configured channel in parallel; one failing doesn't block the
// other (each function already catches/logs its own errors internally).
export async function notifyAll(env, { target, isUp, monitorUrl, text }) {
    return Promise.all([
        sendTelegram(env, text),
        sendEmail(env, { target, isUp, monitorUrl }),
    ]);
}
