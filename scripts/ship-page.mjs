// Builds the one-file game page with YOUR server baked in and prepares it for your own website
// (for example the Vercel site connected to your own GitHub repo).   npm run page
//
//   - needs servers.json (npm run online writes it) and the address of your site's repo, either in the
//     PAGE_REPO environment variable or in a file called .page-repo (both stay out of git);
//   - never touches this repo's index.html, which is public: the baked page only ever exists in the
//     commit it prepares, on a local branch called deploy-to-my-vercel-repo;
//   - doesn't push: it prints the one command that does (pushing deploys your site).
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8", ...opts });
  if (r.status !== 0) { console.error((r.stderr || r.stdout || `${cmd} failed`).trim()); process.exit(1); }
  return r.stdout.trim();
};

if (!existsSync(`${root}/servers.json`)) { console.error("No servers.json yet. Run `npm run online` once first: it records where your game is reachable."); process.exit(1); }
const repo = (process.env.PAGE_REPO ?? (existsSync(`${root}/.page-repo`) ? readFileSync(`${root}/.page-repo`, "utf8") : "")).trim();
if (!repo) { console.error("Say which repo your site is published from: put its address (https://github.com/you/your-repo.git) in a file called .page-repo, or set PAGE_REPO."); process.exit(1); }

console.log("Building the page with your server baked in…");
run(process.execPath, ["client/build.mjs", "preview"], { stdio: ["ignore", "ignore", "inherit"] });
const blob = run("git", ["hash-object", "-w", "client/dist/beaver-banff.html"]);

console.log("Fetching your site's repo…");
run("git", ["fetch", "-q", repo, "main:refs/remotes/page-repo/main"]);

// The current code, with index.html swapped for the baked page, on top of your repo's history.
const idx = `${mkdtempSync(`${tmpdir()}/bb-`)}/index`;
const env = { ...process.env, GIT_INDEX_FILE: idx };
run("git", ["read-tree", "HEAD"], { env });
run("git", ["update-index", "--add", "--cacheinfo", `100644,${blob},index.html`], { env });
const tree = run("git", ["write-tree"], { env });
const msg = "Update the game page\n\nBuilt from the latest code with the server address included.\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>";
const commit = run("git", ["commit-tree", tree, "-p", "refs/remotes/page-repo/main", "-m", msg]);
run("git", ["branch", "-f", "deploy-to-my-vercel-repo", commit]);

const ahead = run("git", ["rev-list", "--count", "refs/remotes/page-repo/main..deploy-to-my-vercel-repo"]);
console.log(`\nReady: ${ahead} commit on top of your site's repo. To publish it (this deploys your site):\n`);
console.log(`  git push ${repo} deploy-to-my-vercel-repo:main\n`);
