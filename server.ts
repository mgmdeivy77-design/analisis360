import express from "express";
import path from "path";
import { createApp } from "./server/app.js";

const PORT = 3000;

async function startServer() {
  const app = createApp();

  if (process.env.NODE_ENV !== "production") {
    app.get("/dev-sw.js", (_req, res) => {
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.send(`
        self.addEventListener("install", () => self.skipWaiting());
        self.addEventListener("activate", (event) => {
          event.waitUntil((async () => {
            try {
              const keys = await caches.keys();
              await Promise.all(keys.map((k) => caches.delete(k)));
              await self.registration.unregister();
            } catch {}
          })());
        });
      `);
    });

    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    // Block access to server bundle or source maps if present in dist
    app.use((req, res, next) => {
      if (req.path === "/server.cjs" || req.path.endsWith(".map")) {
        res.status(404).end();
        return;
      }
      next();
    });
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
