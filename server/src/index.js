import "dotenv/config";
import http from "node:http";
import app, { allowedOrigins } from "./app.js";
import { connectDB } from "./config/db.js";
import { initSocket } from "./socket.js";

const PORT = process.env.PORT || 5000;

connectDB(process.env.MONGO_URI)
  .then(() => {
    const server = http.createServer(app);
    initSocket(server, allowedOrigins);
    server.listen(PORT, () => console.log(`🩺 MediBook API + Socket.io on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("❌ Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });
