function extractCookie(response) {
  if (typeof response.headers.getSetCookie === "function") {
    const cookies = response.headers.getSetCookie();
    if (cookies.length) {
      return cookies[0].split(";")[0];
    }
  }

  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) return "";
  return setCookie.split(";")[0];
}

function waitForSocketConnect(socket, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Socket connect timeout."));
    }, timeout);

    socket.once("connect", () => {
      clearTimeout(timer);
      resolve();
    });

    socket.once("connect_error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function tokenFromCookie(cookieHeader) {
  if (!cookieHeader) return "";
  const separatorIndex = cookieHeader.indexOf("=");
  if (separatorIndex === -1) return "";
  return cookieHeader.slice(separatorIndex + 1);
}

module.exports = {
  extractCookie,
  tokenFromCookie,
  waitForSocketConnect
};