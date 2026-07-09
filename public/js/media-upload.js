(function (global) {
  const { api } = global.NotKetApi;

  async function signUpload(file, kind) {
    const data = await api("/api/uploads/sign", {
      method: "POST",
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        kind
      })
    });
    return data.upload;
  }

  function putFileToSignedUrl(file, upload, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(upload.method || "PUT", upload.uploadUrl, true);

      const headers = upload.headers || {};
      Object.keys(headers).forEach((key) => {
        xhr.setRequestHeader(key, headers[key]);
      });

      xhr.upload.onprogress = (event) => {
        if (!onProgress || !event.lengthComputable) return;
        onProgress(Math.round((event.loaded / event.total) * 100));
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload S3 thất bại (${xhr.status}).`));
        }
      };

      xhr.onerror = () => reject(new Error("Lỗi mạng khi upload S3."));
      xhr.send(file);
    });
  }

  async function uploadFile(file, kind, onProgress) {
    const resolvedKind =
      kind || (file.type && file.type.startsWith("image/") ? "image" : "file");
    const upload = await signUpload(file, resolvedKind);
    await putFileToSignedUrl(file, upload, onProgress);
    return upload;
  }

  global.NotKetMediaUpload = {
    signUpload,
    putFileToSignedUrl,
    uploadFile
  };
})(window);
