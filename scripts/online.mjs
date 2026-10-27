// One command to put the game online from this computer:   npm run online
//
//   1. builds the web client,
//   2. starts the game server (or reuses one already running on the port),
//   3. opens a public tunnel with ngrok (or cloudflared) if either is installed,
//   4. prints the links to send to friends.
//
// Keep this window open and the computer awake while people play. Ctrl+C stops everything.
//
// Environment: NGROK_REGION (e.g. eu, ap, in, us: if friends' ping is high, try another), PORT (default 2567),
// NO_TUNNEL=1 to skip step 3.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.env.PORT ?? 2567);
const procs = [];
const say = (s = "") => console.log(s);

const stop = () => { for (const p of procs) { try { p.kill(); } catch { /* already gone */ } } };
process.on("SIGINT", () => { stop(); process.exit(0); });
process.on("SIGTERM", () => { stop(); process.exit(0); });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const has = (cmd) => spawnSync(process.platform === "win32" ? "where" : "which", [cmd], { stdio: "ignore" }).status === 0;
async function getJson(url) {
  try { const r = await fetch(url, { signal: AbortSignal.timeout(2500) }); return await r.json(); } catch { return null; }
}

// 1. Build the client the server hands out.
say("🦫 Building the game…");
const build = spawnSync(process.execPath, ["client/build.mjs", "hosted"], { cwd: root, stdio: "inherit" });
if (build.status !== 0) { say("Build failed — see above."); process.exit(1); }

// 2. The game server.
const health = await getJson(`http://127.0.0.1:${port}/health`);
if (health?.ok) {
  say(`🦫 A game server is already running on port ${port} — using it.`);
} else {
  mkdirSync(`${root}/game-server/data`, { recursive: true });
  const server = spawn(
    process.execPath,
    [`${root}/node_modules/tsx/dist/cli.mjs`, "--tsconfig", "game-server/tsconfig.json", "game-server/src/index.ts"],
    { cwd: root, stdio: "inherit", env: { ...process.env, PORT: String(port), DATA_FILE: process.env.DATA_FILE ?? `${root}/game-server/data/players.json`, NODE_ENV: "production" } },
  );
  procs.push(server);
  server.on("exit", (code) => { say(`Game server stopped (${code}).`); stop(); process.exit(code ?? 0); });
  for (let i = 0; i < 40 && !(await getJson(`http://127.0.0.1:${port}/health`))?.ok; i++) await wait(500);
  if (!(await getJson(`http://127.0.0.1:${port}/health`))?.ok) { say("The game server didn't start — see above."); stop(); process.exit(1); }
}

// 3. A public tunnel.
let publicUrl = "";
async function ngrokTunnel() {
  say("🌐 Opening a tunnel…");
  const region = process.env.NGROK_REGION ? ["--region", process.env.NGROK_REGION] : [];
  // Reuse last time's address if ngrok will give it to us again (a free account has one fixed
  // address), so the link you share and the page you publish keep working between sessions.
  const lastFile = `${root}/game-server/data/public-url.txt`;
  const last = existsSync(lastFile) ? readFileSync(lastFile, "utf8").trim() : "";
  const attempts = last ? [["--url", last], []] : [[]];
  let url = "";
  for (const extra of attempts) {
    const t = spawn("ngrok", ["http", String(port), "--log=stdout", ...region, ...extra], { stdio: ["ignore", "pipe", "pipe"] });
    let exited = false;
    t.on("exit", () => { exited = true; });
    t.stdout.on("data", () => {});
    t.stderr.on("data", (d) => process.stderr.write(d));
    for (let i = 0; i < 30 && !url && !exited; i++) {
      await wait(1000);
      const j = await getJson("http://127.0.0.1:4040/api/tunnels");
      url = j?.tunnels?.find((x) => x.public_url?.startsWith("https://"))?.public_url ?? "";
    }
    if (url) { procs.push(t); break; }
    try { t.kill(); } catch { /* already gone */ }
  }
  if (!url) say("ngrok didn't give a link. Is it signed in? Try `ngrok config check`, or run `ngrok http " + port + "` yourself.");
  else writeFileSync(lastFile, url);
  return url;
}

async function cloudflareTunnel() {
  say("🌐 Opening a Cloudflare tunnel…");
  // Over TCP ("http2") the tunnel attaches to the data centre nearest you (Dubai from the UAE). The default
  // QUIC connection landed in Tokyo from there: ~140 ms instead of ~37 ms through the tunnel. Set
  // CF_PROTOCOL=quic to use QUIC anyway.
  const proto = ["--protocol", process.env.CF_PROTOCOL || "http2"];
  const t = spawn("cloudflared", ["tunnel", "--no-autoupdate", ...proto, "--url", `http://127.0.0.1:${port}`], { stdio: ["ignore", "pipe", "pipe"] });
  // cloudflared hands out a link straight away, but the link only works once a connection to Cloudflare is
  // registered. Some networks (schools, offices, some hotspots) block the port it needs (7844), and then
  // the link just shows "Error 1033" — so wait for the connection, not just the link.
  let url = "";
  const ready = new Promise((resolve) => {
    const onData = (d) => {
      const s = String(d);
      url ||= s.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0] ?? "";
      if (url && /Registered tunnel connection/.test(s)) resolve(true);
    };
    t.stdout.on("data", onData);
    t.stderr.on("data", onData);
    t.on("exit", () => resolve(false));
  });
  if (await Promise.race([ready, wait(25000).then(() => false)])) { procs.push(t); return url; }
  try { t.kill(); } catch { /* already gone */ }
  say("Cloudflare can't connect from this network (it blocks the port Cloudflare needs).");
  return "";
}

// Which tunnel: set TUNNEL=ngrok or TUNNEL=cloudflared to choose. Otherwise cloudflared when it's installed
// (from the UAE it reaches a Dubai data centre, so friends nearby never route through another country),
// else ngrok. If Cloudflare can't connect from this network, ngrok is used instead.
let kind = process.env.TUNNEL || (has("cloudflared") ? "cloudflared" : has("ngrok") ? "ngrok" : "");
if (!process.env.NO_TUNNEL) {
  if (kind === "cloudflared" && has("cloudflared")) {
    publicUrl = await cloudflareTunnel();
    if (!publicUrl && has("ngrok") && !process.env.TUNNEL) { say("Using ngrok instead."); kind = "ngrok"; }
  }
  if (kind === "ngrok" && has("ngrok")) publicUrl = await ngrokTunnel();
  else if (!kind) say("No tunnel tool found (install one: `brew install cloudflared` or `brew install ngrok`), so only people on your Wi-Fi can join.");
}

// Tell the page builder where this game lives (kept out of git: it is your own address).
let addressChanged = false;
if (publicUrl && kind === "ngrok") {
  const entry = [{ name: "Beaver Banff", url: publicUrl.replace(/^https/, "wss") }];
  const file = `${root}/servers.json`;
  const before = existsSync(file) ? readFileSync(file, "utf8") : "";
  const now = JSON.stringify(entry, null, 2) + "\n";
  if (before !== now) { writeFileSync(file, now); addressChanged = before !== ""; }
}

// 4. The links.
const lan = Object.values(networkInterfaces()).flat().find((i) => i && i.family === "IPv4" && !i.internal)?.address;
say();
say("════════════════════════════════════════════════════════════");
say("  🦫 BEAVER BANFF IS ONLINE");
say("════════════════════════════════════════════════════════════");
if (publicUrl) {
  say("  Send friends this link (anywhere in the world):");
  say();
  say(`  ▸ ${publicUrl}`);
  if (kind === "cloudflared") {
    say("      (no warning page. This link is new every time you start the game, so send the fresh one each session.)");
  } else {
    say("      (it may show a one-time 'Visit Site' notice from the tunnel the first time;");
    say("       to avoid it, publish your own page with `npm run page`)");
  }
  if (addressChanged) {
    say();
    say("  ⚠ Your address changed since last time. If you publish your own page, run `npm run page`");
    say("    again and push it, or friends will see the server as offline.");
  }
} else {
  say("  No public link (tunnel not running).");
}
say();
say(`  ★ PLAYING ON THIS COMPUTER? Use  http://localhost:${port}  — no tunnel in the way, so your ping is ~0 ms.`);
say("    (Friends use the links above; their ping is whatever the tunnel and their internet give.)");
if (lan) say(`  Same Wi-Fi:         http://${lan}:${port}`);
say();
say("  Keep this window open and your computer awake. Ctrl+C stops the game.");
say("════════════════════════════════════════════════════════════");
say();

// Report the player count now and then, so you can see friends arriving.
let last = -1;
setInterval(async () => {
  const j = await getJson(`http://127.0.0.1:${port}/health`);
  const n = j?.connections ?? 0;
  if (n !== last) { last = n; say(`👥 ${n} beaver${n === 1 ? "" : "s"} connected`); }
}, 5000);
