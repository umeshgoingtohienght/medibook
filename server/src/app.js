import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";

import { errorHandler, notFound } from "./middleware/errorHandler.js";
import routes from "./routes/index.js";

export const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""));

const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin: (origin, cb) =>
      !origin || allowedOrigins.includes(origin)
        ? cb(null, true)
        : cb(Object.assign(new Error("Origin not allowed by CORS"), { status: 403 })),
  })
);
app.use(express.json({ limit: "20kb" }));
if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));

app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false }));
app.get("/api/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));
app.use("/api", routes);

app.use(notFound);
app.use(errorHandler);

export default app;
