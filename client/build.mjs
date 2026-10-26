// Client build script (esbuild).
//   node build.mjs dev      → dev server on http://localhost:5173 with live rebuilds
//   node build.mjs build    → dist/ (index.html + app.js) for deployment
//   node build.mjs preview  → dist/beaver-banff.html and ../index.html, one self-contained file
//                             (solo mode; set GAME_SERVER_URL=wss://your-server to build in online play)
//   node build.mjs hosted   → dist/ for the game server to serve (connects back to the same address)
import * as esbuild from "esbuild";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const mode = process.argv[2] ?? "build";
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const serverUrl = mode === "hosted" ? "same-origin" : process.env.VITE_GAME_SERVER_URL ?? process.env.GAME_SERVER_URL ?? (mode === "dev" ? "ws://localhost:2567" : "");

const options = {
  entryPoints: [here("./src/main.ts")],
  bundle: true,
  format: "esm",
  target: "es2020",
  sourcemap: mode === "dev",
  minify: mode !== "dev" && !process.env.NO_MINIFY,
  define: { __GAME_SERVER_URL__: JSON.stringify(serverUrl) },
  alias: { "@beaver/shared": here("../shared/src/index.ts") },
  logLevel: "info",
};

/**
 * Puts the app tag (or the whole bundle) into the page.
 *
 * The replacement has to be a function. With a string, `$&`, "$`" and friends are substitution
 * patterns, and a minified bundle can easily contain them — esbuild names a variable `$`, the
 * next token is `&&`, and the `$&` it forms gets replaced by the matched `<!--APP-->`. The
 * stray `<!--` then comments out the rest of that line, which in minified output is most of
 * the program, and the page dies with a syntax error somewhere far away.
 */
const injectApp = (page, tag) => page.replace("<!--APP-->", () => tag);

// The template's "not built yet" notice is removed from every built page.
const html = (await readFile(here("./index.html"), "utf8"))
  .replace(/<div id="boot-msg"[\s\S]*?<\/div>\s*/, "")
  .replace(/\s*<!-- This page is a template[^>]*-->/, "");

// Static files (textures, sounds) live in client/public and are served from the site root,
// e.g. client/public/assets/textures/x.png → /assets/textures/x.png
const copyPublic = async (dir) => {
  if (existsSync(here("./public"))) await cp(here("./public"), dir, { recursive: true });
};

// The single-file preview can't load files, so embed any "/assets/..." file it references as a data: URI.
const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", mp3: "audio/mpeg", ogg: "audio/ogg" };
const inlineAssets = async (js) => {
  const refs = [...new Set(js.match(/["'`]\/assets\/[^"'`]+["'`]/g) ?? [])];
  for (const ref of refs) {
    const path = ref.slice(1, -1);
    const file = here("./public" + path);
    if (!existsSync(file)) continue;
    const ext = path.split(".").pop().toLowerCase();
    const data = (await readFile(file)).toString("base64");
    js = js.split(ref).join(JSON.stringify(`data:${MIME[ext] ?? "application/octet-stream"};base64,${data}`));
  }
  return js;
};

if (mode === "dev") {
  await mkdir(here("./dev"), { recursive: true });
  await copyPublic(here("./dev"));
  await writeFile(here("./dev/index.html"), injectApp(html, '<script type="module" src="/app.js"></script>'));
  const ctx = await esbuild.context({ ...options, outfile: here("./dev/app.js") });
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: here("./dev"), port: 5173 });
  console.log(`\n🦫 Beaver Banff client: http://localhost:${port}  (game server: ${serverUrl || "none — solo mode"})\n`);
} else if (mode === "build" || mode === "hosted") {
  // OUT_DIR lets a test build go somewhere else, so a server that is serving client/dist isn't disturbed.
  const out = process.env.OUT_DIR ? resolve(process.env.OUT_DIR) : here("./dist");
  await mkdir(out, { recursive: true });
  await copyPublic(out);
  await esbuild.build({ ...options, outfile: join(out, "app.js") });
  await writeFile(join(out, "index.html"), injectApp(html, '<script type="module" src="./app.js"></script>'));
} else if (mode === "preview") {
  const out = await esbuild.build({ ...options, write: false, format: "iife" });
  const js = (await inlineAssets(out.outputFiles[0].text)).replace(/<\/script/gi, "<\\/script");
  await mkdir(here("./dist"), { recursive: true });
  const page = injectApp(html, `<script>${js}</script>`);
  await writeFile(here("./dist/beaver-banff.html"), page);
  // Also refresh the ready-to-play copy at the top of the repo, so anyone can just open index.html.
  await writeFile(here("../index.html"), page);
  // Artifact version: page content only (the host adds the document skeleton).
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta charset[^>]*>|<meta name="viewport"[^>]*>/g, "").trim();
  await writeFile(here("./dist/beaver-banff.artifact.html"), `${head}\n<style>html,body{height:100%;background:#ffd9b0}</style>\n<script>${js}</script>\n`);
  console.log("Wrote dist/beaver-banff.html");
}
