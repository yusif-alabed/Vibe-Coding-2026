import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GameServer } from "./server";

/**
 * Beaver Banff game server. One process does everything needed to host the game online:
 *  - the WebSocket game server (villages, races, cabins, friends, parties),
 *  - the built web client (client/dist) on the same address, so players just open the URL,
 *  - /health for uptime checks.
 * Progress is saved to DATA_FILE (default ./data/players.json).
 */

const port = Number(process.env.PORT ?? process.env.GAME_SERVER_PORT ?? 2567);
const here = fileURLToPath(new URL(".", import.meta.url));
const staticDir = resolve(process.env.STATIC_DIR ?? join(here, "../../client/dist"));
const hasClient = existsSync(join(staticDir, "index.html"));

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".json": "application/json",
  ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".ico": "image/x-icon", ".woff2": "font/woff2",
};

const http = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" });
    res.end(JSON.stringify({ ok: true, ...game.stats() }));
    return;
  }
  if (hasClient && (req.method === "GET" || req.method === "HEAD")) {
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
    let file = resolve(staticDir, rel || "index.html");
    if (!file.startsWith(staticDir)) { res.writeHead(403); res.end(); return; }
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(staticDir, "index.html");
    res.writeHead(200, {
      "content-type": MIME[extname(file)] ?? "application/octet-stream",
      "cache-control": file.endsWith("index.html") ? "no-cache" : "public, max-age=3600",
    });
    res.end(req.method === "HEAD" ? undefined : readFileSync(file));
    return;
  }
  res.writeHead(404);
  res.end();
});

const game = new GameServer(http, { dataFile: process.env.DATA_FILE ?? "./data/players.json" });

http.listen(port, () => {
  console.log(`🦫 Beaver Banff game server on port ${port}${hasClient ? ` — open http://localhost:${port} to play` : " (client not built: run `npm run build:hosted`)"}`);
});

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    game.close();
    http.close(() => process.exit(0));
  });
}
