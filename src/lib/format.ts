const timeZone = () => process.env.APP_TIMEZONE || "Asia/Kolkata";

/** "7:14 pm" in the club's timezone. */
export function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: timeZone() });
}

/** "15 OCT 2026", for the check-in stamp's rim. */
export function stampDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: timeZone() }).toUpperCase();
}
