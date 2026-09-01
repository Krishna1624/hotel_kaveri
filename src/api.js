export const API_BASE = (import.meta.env?.VITE_API_BASE || "").replace(/\/$/, "");

export function resolveUrl(path) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${cleanPath}` : cleanPath;
}

export function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
  }
}

export async function apiFetch(url, options = {}, onAuthError = null) {
  const token = localStorage.getItem("access_token");
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const fetchOptions = {
    ...options,
    headers,
  };
  try {
    let response = await fetch(resolveUrl(url), fetchOptions);
    if (response.status === 401 && localStorage.getItem("refresh_token")) {
      const refreshed = await attemptTokenRefresh();
      if (refreshed) {
        const newToken = localStorage.getItem("access_token");
        headers["Authorization"] = `Bearer ${newToken}`;
        response = await fetch(resolveUrl(url), fetchOptions);
      } else {
        if (onAuthError) onAuthError();
      }
    }
    return response;
  } catch (err) {
    console.error("API Fetch Error:", err);
    throw err;
  }
}

async function attemptTokenRefresh() {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) return false;
  try {
    const response = await fetch(resolveUrl("/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (response.ok) {
      const data = await response.json();
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      return true;
    } else {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      return false;
    }
  } catch (err) {
    console.error("Token refresh failed", err);
    return false;
  }
}
