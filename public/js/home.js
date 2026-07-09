(function () {
  const { api, getAccessKey, setAccessKey } = window.NotKetApi;

  const accessForm = document.getElementById("access-form");
  const openModeActions = document.getElementById("open-mode-actions");
  const accessKeyInput = document.getElementById("access-key");
  const homeError = document.getElementById("home-error");

  function setError(message) {
    if (homeError) homeError.textContent = message || "";
  }

  async function init() {
    try {
      const config = await api("/api/app/config");
      if (config.openMode) {
        openModeActions.classList.remove("hidden");
        accessForm.classList.add("hidden");
        return;
      }

      accessForm.classList.remove("hidden");
      openModeActions.classList.add("hidden");
      const existing = getAccessKey();
      if (existing) {
        accessKeyInput.value = existing;
      }
    } catch (error) {
      setError(error.message || "Không tải được cấu hình.");
    }
  }

  accessForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setError("");
    const key = (accessKeyInput.value || "").trim();
    if (!key) {
      setError("Vui lòng nhập mã truy cập.");
      return;
    }

    setAccessKey(key);

    try {
      await api("/api/messages?limit=1");
      window.location.href = "/documents";
    } catch (error) {
      setAccessKey("");
      setError(error.message || "Mã truy cập không hợp lệ.");
    }
  });

  init();
})();
