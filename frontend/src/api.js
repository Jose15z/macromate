const BASE = "http://localhost:8000";

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

async function request(path, { method = "GET", body, formData } = {}) {
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
    throw new ApiError(0, "Cannot reach the server. Is the backend running?");
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

  return res.json();
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

export const getMe = () => request("/api/me");

export const updateProfile = (fields) =>
  request("/api/me", { method: "PUT", body: fields });

// ---- products (OpenFoodFacts) ----
export const fetchProduct = (barcode) =>
  request(`/api/product/${encodeURIComponent(barcode)}`);

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

// ---- photo recognition ----
export const recognizePhoto = (file) => {
  const formData = new FormData();
  formData.append("image", file);
  return request("/api/recognize", { method: "POST", formData });
};
