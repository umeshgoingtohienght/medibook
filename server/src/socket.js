import jwt from "jsonwebtoken";
import { Server } from "socket.io";

let io = null;

/**
 * Real-time channels:
 *   doctor:<doctorId> — anyone viewing a doctor's page; receives "slots:changed"
 *   user:<userId>     — private notifications (requires a valid JWT in the handshake)
 */
export function initSocket(httpServer, allowedOrigins) {
  io = new Server(httpServer, { cors: { origin: allowedOrigins } });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        socket.userId = jwt.verify(token, process.env.JWT_SECRET).id;
      } catch {
        /* anonymous connection is fine for public slot updates */
      }
    }
    next();
  });

  io.on("connection", (socket) => {
    if (socket.userId) socket.join(`user:${socket.userId}`);
    socket.on("doctor:watch", (doctorId) => typeof doctorId === "string" && socket.join(`doctor:${doctorId}`));
    socket.on("doctor:unwatch", (doctorId) => socket.leave(`doctor:${doctorId}`));
  });
  return io;
}

export function emitSlotsChanged(doctorId, date) {
  io?.to(`doctor:${doctorId}`).emit("slots:changed", { doctorId: String(doctorId), date });
}

export function notifyUser(userId, event, payload) {
  io?.to(`user:${userId}`).emit(event, payload);
}
