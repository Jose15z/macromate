import { translate } from "./i18n";

const BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

const TOKEN_KEY = "mm_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(status, detail) {
    super(detail);
    this.status = status;
  }
}

async function request(path, { method = "GET", body, formData, raw = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : formData,
    });
  } catch {
    throw new ApiError(0, translate("api.network"));
  }

  if (res.status === 401 && token && !path.startsWith("/api/auth/")) {
    // token expired or revoked — force re-login
    setToken(null);
    window.location.assign("/login");
    throw new ApiError(401, "Session expired");
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      if (typeof data.detail === "string") detail = data.detail;
      else if (Array.isArray(data.detail) && data.detail[0]?.msg)
        detail = data.detail[0].msg;
    } catch {
      /* keep statusText */
    }
    throw new ApiError(res.status, detail);
  }

  return raw ? res : res.json();
}

// ---- auth ----
export const register = (email, password, displayName) =>
  request("/api/auth/register", {
    method: "POST",
    body: { email, password, display_name: displayName },
  });

export const login = (email, password) =>
  request("/api/auth/login", { method: "POST", body: { email, password } });

export const logout = () => request("/api/auth/logout", { method: "POST" });

export const forgotPassword = (email) =>
  request("/api/auth/forgot", { method: "POST", body: { email } });

export const resetPassword = (token, password) =>
  request("/api/auth/reset", { method: "POST", body: { token, password } });

export const getMe = () => request("/api/me");

export const updateProfile = (fields) =>
  request("/api/me", { method: "PUT", body: fields });

export const changePassword = (currentPassword, newPassword) =>
  request("/api/me/password", {
    method: "PUT",
    body: { current_password: currentPassword, new_password: newPassword },
  });

export const deleteAccount = (password) =>
  request("/api/me/delete", { method: "POST", body: { password } });

// ---- products (OpenFoodFacts) ----
export const fetchProduct = (barcode) =>
  request(`/api/product/${encodeURIComponent(barcode)}`);

export const searchProducts = (q) =>
  request(`/api/search-products?q=${encodeURIComponent(q)}`);

// ---- foods ----
export const createFood = (food) =>
  request("/api/foods", { method: "POST", body: food });

export const listFoods = (list = "saved", search = "") => {
  const params = new URLSearchParams({ list });
  if (search) params.set("search", search);
  return request(`/api/foods?${params}`);
};

export const updateFood = (id, fields) =>
  request(`/api/foods/${id}`, { method: "PUT", body: fields });

export const deleteFood = (id) =>
  request(`/api/foods/${id}`, { method: "DELETE" });

// ---- diary ----
export const fetchDay = (date) => request(`/api/diary/${date}`);

export const addEntry = (entry) =>
  request("/api/diary/entries", { method: "POST", body: entry });

export const updateEntry = (id, fields) =>
  request(`/api/diary/entries/${id}`, { method: "PATCH", body: fields });

export const deleteEntry = (id) =>
  request(`/api/diary/entries/${id}`, { method: "DELETE" });

export const fetchSummary = (start, end) =>
  request(`/api/diary/summary?start=${start}&end=${end}`);

export const copyDay = (fromDate, toDate, mealType = null) =>
  request("/api/diary/copy", {
    method: "POST",
    body: { from_date: fromDate, to_date: toDate, meal_type: mealType },
  });

export async function downloadExport() {
  const res = await request("/api/export.csv", { raw: true });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "macromate-diary.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---- weights ----
export const upsertWeight = (date, weightKg) =>
  request("/api/weights", { method: "POST", body: { date, weight_kg: weightKg } });

export const listWeights = (start, end) =>
  request(`/api/weights?start=${start}&end=${end}`);

// ---- recipes ----
export const listRecipes = () => request("/api/recipes");

export const createRecipe = (name, items) =>
  request("/api/recipes", { method: "POST", body: { name, items } });

export const deleteRecipe = (id) =>
  request(`/api/recipes/${id}`, { method: "DELETE" });

export const logRecipe = (id, date, mealType, factor = 1) =>
  request(`/api/recipes/${id}/log`, {
    method: "POST",
    body: { date, meal_type: mealType, factor },
  });

// ---- AI ----
export const recognizePhoto = (file) => {
  const formData = new FormData();
  formData.append("image", file);
  return request("/api/recognize", { method: "POST", formData });
};

export const suggestMeals = (date, mealType, lang) =>
  request("/api/suggest", {
    method: "POST",
    body: { date, meal_type: mealType, lang },
  });
