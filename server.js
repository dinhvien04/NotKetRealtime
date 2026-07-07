const http = require("http");
const { Server } = require("socket.io");
const config = require("./src/config/env");
const authService = require("./src/services/auth.service");
const app = require("./src/app");
const registerSocketController = require("./src/controllers/socket.controller");
const realtimeService = require("./src/services/realtime.service");
const { socketAuthMiddleware } = require("./src/middlewares/socket-auth.middleware");
const {
  socketOriginMiddleware,
  createSocketCorsOriginChecker
} = require("./src/middlewares/socket-origin.middleware");

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: createSocketCorsOriginChecker(),
    credentials: true
  }
});

io.use(socketOriginMiddleware);
io.use(socketAuthMiddleware);
realtimeService.setIo(io);
registerSocketController(io);

const authConfigError = authService.getAuthConfigError();
if (authConfigError) {
  console.error(authConfigError);
  process.exit(1);
}

httpServer.listen(config.port, () => {
  console.log(`Nối Kết Realtime đang chạy tại http://localhost:${config.port}`);
});