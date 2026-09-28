import { getLang, translate } from "./i18n";

export function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

export function shiftDate(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

export function formatDate(dateStr) {
  if (dateStr === todayISO()) return translate("date.today");
  if (dateStr === shiftDate(todayISO(), -1)) return translate("date.yesterday");
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString(
    getLang() === "es" ? "es" : undefined,
    { weekday: "short", month: "short", day: "numeric" }
  );
}

export function shortDate(dateStr) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString(
    getLang() === "es" ? "es" : undefined,
    { month: "short", day: "numeric" }
  );
}

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];

/** Read the target date + meal from the URL, with safe defaults. */
export function logTarget(searchParams) {
  const date = searchParams.get("date") || todayISO();
  const meal = MEAL_TYPES.includes(searchParams.get("meal"))
    ? searchParams.get("meal")
    : "breakfast";
  return { date, meal };
}
