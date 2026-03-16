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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve admin panel HTML at /api/admin
app.get("/api/admin", (_req: Request, res: Response) => {
  const adminPath = path.resolve(__dirname, "../../telegram-bot/public/admin.html");
  res.sendFile(adminPath);
});

// Proxy all admin API calls to the telegram-bot server
app.use(
  "/api/admin",
  createProxyMiddleware({
    target: "http://localhost:3001",
    changeOrigin: true,
  })
);

app.use("/api", router);

export default app;
