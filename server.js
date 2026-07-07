const http = require("http");
const { Server } = require("socket.io");
const config = require("./src/config/env");
const app = require("./src/app");
const registerSocketController = require("./src/controllers/socket.controller");
const { socketAuthMiddleware } = require("./src/middlewares/socket-auth.middleware");

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: config.clientOrigin,
    credentials: true
  }
});

io.use(socketAuthMiddleware);
registerSocketController(io);

httpServer.listen(config.port, () => {
  console.log(`Nối Kết Realtime đang chạy tại http://localhost:${config.port}`);
});