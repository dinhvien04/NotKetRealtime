const http = require("http");
const { Server } = require("socket.io");
const app = require("./src/app");
const registerSocketController = require("./src/controllers/socket.controller");

const PORT = process.env.PORT || 3000;
const httpServer = http.createServer(app);
const io = new Server(httpServer);

registerSocketController(io);

httpServer.listen(PORT, () => {
  console.log(`Nối Kết Realtime đang chạy tại http://localhost:${PORT}`);
});
