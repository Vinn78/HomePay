import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");

    // ✅ serve static files FIRST
    app.use(express.static(distPath));

    // ✅ only fallback for non-file routes
    app.get("*", (req, res, next) => {
      if (req.path.includes(".")) {
        return next(); // let static handle files
      }
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();