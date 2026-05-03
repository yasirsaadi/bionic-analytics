import "dotenv/config";
import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { pool } from "./db.js";
import { authRouter } from "./routes/auth.js";
import { centersRouter } from "./routes/centers.js";
import { devicesRouter } from "./routes/devices.js";
import { usersRouter } from "./routes/users.js";
import { sessionsRouter } from "./routes/sessions.js";
import { targetsRouter } from "./routes/targets.js";
import { bootstrap } from "./bootstrap.js";

const PORT = Number(process.env.PORT ?? 3000);
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET is required");
}
const isProd = process.env.NODE_ENV === "production";

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));

const PgStore = connectPgSimple(session);

app.use(
  session({
    store: new PgStore({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),
    name: "physio.sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 12,
    },
  }),
);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/centers", centersRouter);
app.use("/api/devices", devicesRouter);
app.use("/api/users", usersRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/targets", targetsRouter);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

if (isProd) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // dist/server/server/index.js → ../../client (project root) — but build output flattens.
  // Actual layout in production: /app/dist/server/index.js (from rootDir=..)
  // So go up: dirname is dist/server, then ../../client/dist
  const candidates = [
    path.resolve(here, "../../client/dist"),
    path.resolve(here, "../client/dist"),
    path.resolve(process.cwd(), "client/dist"),
  ];
  const clientDist = candidates.find((p) => fs.existsSync(p));
  if (clientDist) {
    app.use(express.static(clientDist));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        next();
        return;
      }
      res.sendFile(path.join(clientDist, "index.html"));
    });
  } else {
    console.warn("[server] client/dist not found; static serving disabled");
  }
}

async function start(): Promise<void> {
  await bootstrap();
  app.listen(PORT, () => {
    console.log(`[server] listening on :${PORT}`);
  });
}

start().catch((err) => {
  console.error("[server] fatal startup error:", err);
  process.exit(1);
});
