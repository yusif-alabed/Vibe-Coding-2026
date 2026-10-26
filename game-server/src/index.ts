import { existsSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
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

/** Text files are gzipped once and kept in memory: the script is ~800 KB, and a tunnel is slow. */
const packed = new Map<string, { mtime: number; raw: Buffer; gz: Buffer | null }>();
function load(file: string) {
  const mtime = statSync(file).mtimeMs;
  let e = packed.get(file);
  if (!e || e.mtime !== mtime) {
    const raw = readFileSync(file);
    const text = /\.(html|js|css|json|svg)$/.test(file);
    e = { mtime, raw, gz: text ? gzipSync(raw, { level: 6 }) : null };
    packed.set(file, e);
  }
  return e;
}

const http = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-max-age": "86400" });
    res.end();
    return;
  }
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
    const e = load(file);
    const gz = e.gz !== null && /\bgzip\b/.test(String(req.headers["accept-encoding"] ?? ""));
    // The game page and script are checked with the server on every load (a tiny 304 when nothing
    // changed), so an update reaches everyone straight away instead of after an hour of caching.
    // Textures and sounds never change under the same name, so those can be kept.
    const live = /\.(html|js|css)$/.test(file);
    const etag = `"${Math.round(e.mtime)}-${e.raw.length}${gz ? "-gz" : ""}"`;
    if (live && req.headers["if-none-match"] === etag) {
      res.writeHead(304, { etag, "cache-control": "no-cache" });
      res.end();
      return;
    }
    res.writeHead(200, {
      "content-type": MIME[extname(file)] ?? "application/octet-stream",
      "cache-control": live ? "no-cache" : "public, max-age=3600",
      ...(live ? { etag } : {}),
      ...(gz ? { "content-encoding": "gzip", vary: "accept-encoding" } : {}),
    });
    res.end(req.method === "HEAD" ? undefined : gz ? e.gz : e.raw);
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
    http.closeAllConnections?.();
    setTimeout(() => process.exit(0), 2000).unref(); // never hang on shutdown
  });
}
