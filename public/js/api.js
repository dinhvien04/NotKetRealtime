(function (global) {
  const ACCESS_KEY_STORAGE = "notket_access_key";

  function getAccessKey() {
    try {
      return localStorage.getItem(ACCESS_KEY_STORAGE) || "";
    } catch (_error) {
      return "";
    }
  }

  function setAccessKey(key) {
    try {
      if (key) {
        localStorage.setItem(ACCESS_KEY_STORAGE, key);
      } else {
        localStorage.removeItem(ACCESS_KEY_STORAGE);
      }
    } catch (_error) {
      /* ignore */
    }
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    const key = getAccessKey();
    if (key) {
      headers.set("X-App-Access-Key", key);
    }

    const response = await fetch(path, {
      ...options,
      headers
    });

    let data = null;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = { ok: response.ok, error: await response.text() };
    }

    if (!response.ok) {
      const error = new Error((data && data.error) || "Yêu cầu thất bại.");
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  function formatFileSize(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  function showToast(message, type = "info") {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = message;
    el.classList.remove("hidden", "error", "success");
    if (type === "error") el.classList.add("error");
    if (type === "success") el.classList.add("success");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      el.classList.add("hidden");
    }, 3200);
  }

  global.NotKetApi = {
    ACCESS_KEY_STORAGE,
    getAccessKey,
    setAccessKey,
    api,
    formatFileSize,
    showToast
  };
})(window);
