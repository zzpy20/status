// Queensland (Brisbane) never observes daylight saving, so "AEST" is
// correct year-round -- no need to compute AEST vs AEDT.
export function formatBrisbaneTime(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-AU", {
        timeZone: "Australia/Brisbane",
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false,
    }).formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value;
    return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")} AEST`;
}
