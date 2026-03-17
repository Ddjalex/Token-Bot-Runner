import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createProxyMiddleware } from "http-proxy-middleware";
import router from "./routes";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

app.use(cors());

// Admin proxy MUST come before body parsers — body parsers consume the stream
// and cause the proxy to abort. The proxy handles /api/admin/* completely.
app.use(
  createProxyMiddleware({
    target: "http://localhost:3001",
    changeOrigin: true,
    pathFilter: (pathname) => pathname.startsWith("/api/admin/"),
  })
);

// Serve admin panel HTML at GET /api/admin (after proxy so GET /api/admin is not proxied)
app.get("/api/admin", (_req: Request, res: Response) => {
  const adminPath = path.resolve(__dirname, "../../telegram-bot/public/admin.html");
  res.sendFile(adminPath);
});

// Serve the Telegram Mini App (game) at /api/game and /api/game/login
app.get(["/api/game", "/api/game/login"], (_req: Request, res: Response) => {
  const gamePath = path.resolve(__dirname, "../../telegram-bot/public/index.html");
  res.sendFile(gamePath);
});

// Body parsers for all other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
