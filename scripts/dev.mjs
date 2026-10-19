// Starts the game server and the client dev server together (Ctrl+C stops both).
import { spawn } from "node:child_process";

const isWin = process.platform === "win32";
const npm = isWin ? "npm.cmd" : "npm";
const procs = [
  spawn(npm, ["run", "dev", "--workspace", "game-server"], { stdio: "inherit" }),
  spawn(npm, ["run", "dev", "--workspace", "client"], { stdio: "inherit" }),
];
const stop = () => procs.forEach((p) => p.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const p of procs) p.on("exit", (code) => { if (code) { stop(); process.exit(code); } });
