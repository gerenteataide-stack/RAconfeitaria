import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import os from "os";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";
import { securityHeaders } from "./lib/security";

const app: Express = express();
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? "https://raconfeitaria.vercel.app")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);
if (process.env.NODE_ENV !== "production") {
  const localPort = process.env.LOCAL_APP_PORT || "5173";
  allowedOrigins.add(`http://localhost:${localPort}`);
  allowedOrigins.add(`http://127.0.0.1:${localPort}`);
  allowedOrigins.add("http://localhost:3000");
  allowedOrigins.add("http://127.0.0.1:3000");
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.disable("x-powered-by");
app.use(securityHeaders);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin) || origin.endsWith(".vercel.app")) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin not allowed"));
  },
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsDir = path.join(
  process.env.VERCEL ? os.tmpdir() : process.cwd(),
  "uploads",
);
app.use("/api/uploads", express.static(uploadsDir));

app.use("/api", router);

export default app;
