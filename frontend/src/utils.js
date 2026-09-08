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
  if (dateStr === todayISO()) return "Today";
  if (dateStr === shiftDate(todayISO(), -1)) return "Yesterday";
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];

export const MEAL_LABELS = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

/** Read the target date + meal from the URL, with safe defaults. */
export function logTarget(searchParams) {
  const date = searchParams.get("date") || todayISO();
  const meal = MEAL_TYPES.includes(searchParams.get("meal"))
    ? searchParams.get("meal")
    : "breakfast";
  return { date, meal };
}
