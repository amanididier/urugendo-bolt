export function getRwandaToday(): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Kigali",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(new Date()); // Returns YYYY-MM-DD in Rwanda timezone
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}
