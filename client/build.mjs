// Client build script (esbuild).
//   node build.mjs dev      → dev server on http://localhost:5173 with live rebuilds
//   node build.mjs build    → dist/ (index.html + app.js) for deployment
//   node build.mjs preview  → dist/beaver-banff.html, one self-contained file (solo mode)
import * as esbuild from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const mode = process.argv[2] ?? "build";
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const serverUrl = process.env.VITE_GAME_SERVER_URL ?? process.env.GAME_SERVER_URL ?? (mode === "dev" ? "ws://localhost:2567" : "");

const options = {
  entryPoints: [here("./src/main.ts")],
  bundle: true,
  format: "esm",
  target: "es2020",
  sourcemap: mode === "dev",
  minify: mode !== "dev" && !process.env.NO_MINIFY,
  define: { __GAME_SERVER_URL__: JSON.stringify(mode === "preview" ? "" : serverUrl) },
  alias: { "@beaver/shared": here("../shared/src/index.ts") },
  logLevel: "info",
};

const html = (await readFile(here("./index.html"), "utf8"));

if (mode === "dev") {
  await mkdir(here("./dev"), { recursive: true });
  await writeFile(here("./dev/index.html"), html.replace("<!--APP-->", '<script type="module" src="/app.js"></script>'));
  const ctx = await esbuild.context({ ...options, outfile: here("./dev/app.js") });
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: here("./dev"), port: 5173 });
  console.log(`\n🦫 Beaver Banff client: http://localhost:${port}  (game server: ${serverUrl || "none — solo mode"})\n`);
} else if (mode === "build") {
  await mkdir(here("./dist"), { recursive: true });
  await esbuild.build({ ...options, outfile: here("./dist/app.js") });
  await writeFile(here("./dist/index.html"), html.replace("<!--APP-->", '<script type="module" src="./app.js"></script>'));
} else if (mode === "preview") {
  const out = await esbuild.build({ ...options, write: false, format: "iife" });
  const js = out.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
  await mkdir(here("./dist"), { recursive: true });
  await writeFile(here("./dist/beaver-banff.html"), html.replace("<!--APP-->", `<script>${js}</script>`));
  // Artifact version: page content only (the host adds the document skeleton).
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta charset[^>]*>|<meta name="viewport"[^>]*>/g, "").trim();
  await writeFile(here("./dist/beaver-banff.artifact.html"), `${head}\n<style>html,body{height:100%;background:#ffd9b0}</style>\n<script>${js}</script>\n`);
  console.log("Wrote dist/beaver-banff.html");
}
