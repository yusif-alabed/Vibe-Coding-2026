import { createServer } from "node:http";
import { GameServer } from "./server";

const port = Number(process.env.GAME_SERVER_PORT ?? 2567);

const http = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" });
    res.end(JSON.stringify({ ok: true, ...game.stats() }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const game = new GameServer(http);

http.listen(port, () => {
  console.log(`🦫 Beaver Banff game server listening on ws://localhost:${port}`);
});

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    game.close();
    http.close(() => process.exit(0));
  });
}
