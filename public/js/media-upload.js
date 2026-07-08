// media-upload.js - S3 sign + XHR PUT upload (no binary over socket)
const MAX_UPLOAD_BYTES = 6291456;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/pdf", "text/plain",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation"
]);

function isAllowedFile(file) {
  return Boolean(file) && ALLOWED_MIME_TYPES.has(file.type) && file.size <= MAX_UPLOAD_BYTES;
}

function setUploadProgress(percent) {
  const el = (typeof window !== "undefined" && window.elements) ? window.elements : {};
  if (!el.uploadProgress || !el.uploadProgressBar) return;
  if (percent === null || percent === undefined) {
    el.uploadProgress.classList.add("is-hidden");
    el.uploadProgressBar.style.width = "0%";
    return;
  }
  el.uploadProgress.classList.remove("is-hidden");
  el.uploadProgressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
}

function inferUploadKind(file, extraFields = {}) {
  if (extraFields.kind) return extraFields.kind;
  if (file?.type?.startsWith("image/")) return "image";
  if (file?.type?.startsWith("audio/")) return "voice";
  return "file";
}

async function signUpload(file, extraFields = {}) {
  const apiFn = window.api || (async () => { throw new Error("no api"); });
  const kind = inferUploadKind(file, extraFields);
  const response = await apiFn("/api/uploads/sign", {
    method: "POST",
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      kind,
      durationMs: extraFields.durationMs === undefined ? null : extraFields.durationMs
    })
  });
  if (!response || !response.upload) {
    throw new Error((response && response.error) || "Không thể ký URL upload.");
  }
  return response.upload;
}

function putFileToSignedUrl(file, upload) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(upload.method || "PUT", upload.uploadUrl);
    const headers = upload.headers || {};
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }
    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      if (typeof setUploadProgress === "function") setUploadProgress(percent);
    });
    xhr.addEventListener("load", () => {
      if (typeof setUploadProgress === "function") setUploadProgress(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error("Không thể upload file lên storage."));
    });
    xhr.addEventListener("error", () => {
      if (typeof setUploadProgress === "function") setUploadProgress(null);
      reject(new Error("Không thể upload file lên storage."));
    });
    xhr.send(file);
  });
}

async function uploadFileWithProgress(file, extraFields = {}) {
  const upload = await signUpload(file, extraFields);
  await putFileToSignedUrl(file, upload);
  return {
    kind: upload.kind,
    fileKey: upload.fileKey,
    fileName: upload.fileName,
    mimeType: upload.mimeType,
    size: upload.size,
    durationMs: upload.durationMs ?? extraFields.durationMs ?? null
  };
}

async function uploadSelectedFile(file, extraFields = {}, maxAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await uploadFileWithProgress(file, extraFields);
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => window.setTimeout(resolve, 400 * attempt));
      }
    }
  }
  throw lastError;
}

async function refreshMediaUrl(fileKey) {
  try {
    const apiFn = window.api || (async () => ({}));
    const data = await apiFn("/api/uploads/refresh-url", {
      method: "POST",
      body: JSON.stringify({ fileKey })
    });
    return data.fileUrl || null;
  } catch (_e) {
    return null;
  }
}

window.ALLOWED_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "👏"];
if (typeof window !== "undefined") {
  window.isAllowedFile = isAllowedFile;
  window.setUploadProgress = setUploadProgress;
  window.signUpload = signUpload;
  window.putFileToSignedUrl = putFileToSignedUrl;
  window.uploadFileWithProgress = uploadFileWithProgress;
  window.uploadSelectedFile = uploadSelectedFile;
  window.refreshMediaUrl = refreshMediaUrl;
  window.MAX_UPLOAD_BYTES = MAX_UPLOAD_BYTES;
  window.ALLOWED_MIME_TYPES = ALLOWED_MIME_TYPES;
}
