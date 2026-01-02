const BASE = "http://localhost:8000";

export async function fetchProduct(barcode) {
  const res = await fetch(`${BASE}/api/product/${barcode}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function addToDay(payload) {
  const res = await fetch(`${BASE}/api/day/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchDay(day) {
  const res = await fetch(`${BASE}/api/day/${day}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
