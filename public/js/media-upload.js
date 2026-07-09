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
          return;
        }
        // 0 often means CORS/network blocked the response body
        if (xhr.status === 0) {
          const err = new Error(
            "Upload thất bại. Kiểm tra S3 CORS AllowedOrigins nếu đang deploy."
          );
          err.code = "S3_CORS";
          reject(err);
          return;
        }
        reject(new Error(`Upload S3 thất bại (${xhr.status}).`));
      };

      xhr.onerror = () => {
        const err = new Error(
          "Upload thất bại. Kiểm tra S3 CORS AllowedOrigins nếu đang deploy."
        );
        err.code = "S3_CORS";
        reject(err);
      };
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
