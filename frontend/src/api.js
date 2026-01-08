const BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

async function asJson(res) {
  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  return text ? JSON.parse(text) : null;
}

export async function fetchProduct(barcode) {
  const res = await fetch(`${BASE}/api/product/${barcode}`);
  return asJson(res);
}

export async function addToDay(payload) {
  const res = await fetch(`${BASE}/api/day/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return asJson(res);
}

export async function fetchDay(day) {
  const res = await fetch(`${BASE}/api/day/${day}`);
  return asJson(res);
}
