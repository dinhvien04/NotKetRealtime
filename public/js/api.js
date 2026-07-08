// api.js - HTTP api helper + csrf
async function ensureCsrfToken() {
  if (window.state && window.state.csrfToken) {
    return window.state.csrfToken;
  }
  const response = await fetch("/api/csrf-token", { credentials: "include" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok || !data.csrfToken) {
    throw new Error(data.error || "Không thể lấy CSRF token.");
  }
  if (window.state) window.state.csrfToken = data.csrfToken;
  return data.csrfToken;
}

async function api(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const headers = { ...(options.headers || {}) };

  if (method !== "GET" && method !== "HEAD") {
    const csrfToken = await ensureCsrfToken();
    headers["X-CSRF-Token"] = csrfToken;
  }

  if (!headers["Content-Type"] && options.body && typeof options.body === "string") {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(path, {
    credentials: "include",
    headers,
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (data.csrfToken && window.state) {
    window.state.csrfToken = data.csrfToken;
  }
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || "Yêu cầu thất bại.");
  }
  return data;
}

function getInitials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part.charAt(0).toLocaleUpperCase("vi"))
    .join("");
}

// expose
if (typeof window !== "undefined") {
  window.ensureCsrfToken = ensureCsrfToken;
  window.api = api;
  window.getInitials = getInitials;
}
