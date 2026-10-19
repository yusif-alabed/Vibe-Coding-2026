import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import pg from "pg";
import { CATALOG, ECONOMY, STARTER_ITEMS } from "@beaver/shared";
import { hashPassword, signSession, validatePassword, validateUsername, verifyPassword, verifySession } from "./auth";

/**
 * Accounts & profiles API (Phase 3 foundation).
 * Endpoints: POST /auth/register, POST /auth/login, GET /me, GET /catalog, GET /health
 * Friends, inventory sync and moderation endpoints build on the same tables (see api/migrations).
 */
const port = Number(process.env.API_PORT ?? 3001);
const secret = process.env.SESSION_SECRET ?? "dev-secret-change-me";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL ?? "postgres://beaver:beaver@localhost:5432/beaver_banff" });

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type, authorization",
  });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 10_000) throw new Error("too large");
  }
  return raw ? JSON.parse(raw) : {};
}

async function register(body: Record<string, unknown>) {
  const username = validateUsername(body.username);
  if (!username || !validatePassword(body.password)) return [400, { error: "Username: 3–16 letters/numbers. Password: 8+ characters." }] as const;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const u = await client.query("INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id", [username, await hashPassword(body.password)]);
    const id = u.rows[0].id;
    await client.query("INSERT INTO profiles (user_id, display_name) VALUES ($1, $2)", [id, username]);
    await client.query("INSERT INTO currencies (user_id, balance) VALUES ($1, $2)", [id, ECONOMY.startingCoins]);
    await client.query("INSERT INTO currency_ledger (user_id, delta, reason) VALUES ($1, $2, 'starting_grant')", [id, ECONOMY.startingCoins]);
    for (const item of STARTER_ITEMS) await client.query("INSERT INTO inventory (user_id, item_id) VALUES ($1, $2)", [id, item]);
    await client.query("COMMIT");
    return [201, { token: signSession(id, secret) }] as const;
  } catch (e) {
    await client.query("ROLLBACK");
    if ((e as { code?: string }).code === "23505") return [409, { error: "That name is taken." }] as const;
    throw e;
  } finally {
    client.release();
  }
}

async function login(body: Record<string, unknown>) {
  const username = validateUsername(body.username);
  if (!username || typeof body.password !== "string") return [400, { error: "Missing username or password." }] as const;
  const r = await pool.query("SELECT id, password_hash, is_banned FROM users WHERE lower(username) = lower($1)", [username]);
  const user = r.rows[0];
  if (!user || !(await verifyPassword(body.password, user.password_hash))) return [401, { error: "Wrong username or password." }] as const;
  if (user.is_banned) return [403, { error: "This account is suspended." }] as const;
  return [200, { token: signSession(user.id, secret) }] as const;
}

async function me(userId: string) {
  const r = await pool.query(
    `SELECT u.username, p.display_name, p.fur_color, p.equipped, c.balance AS coins,
            COALESCE(array_agg(i.item_id) FILTER (WHERE i.item_id IS NOT NULL), '{}') AS owned
       FROM users u JOIN profiles p ON p.user_id = u.id
       LEFT JOIN currencies c ON c.user_id = u.id AND c.currency = 'coins'
       LEFT JOIN inventory i ON i.user_id = u.id
      WHERE u.id = $1 GROUP BY u.id, p.user_id, c.balance`,
    [userId],
  );
  return r.rows[0] ? ([200, r.rows[0]] as const) : ([404, { error: "Not found" }] as const);
}

createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") return send(res, 204, {});
    const url = new URL(req.url ?? "/", "http://x");
    if (url.pathname === "/health") return send(res, 200, { ok: true });
    if (url.pathname === "/catalog") return send(res, 200, CATALOG);
    if (req.method === "POST" && url.pathname === "/auth/register") return send(res, ...(await register(await readJson(req))));
    if (req.method === "POST" && url.pathname === "/auth/login") return send(res, ...(await login(await readJson(req))));
    if (url.pathname === "/me") {
      const userId = verifySession((req.headers.authorization ?? "").replace(/^Bearer /, ""), secret);
      if (!userId) return send(res, 401, { error: "Please log in." });
      return send(res, ...(await me(userId)));
    }
    send(res, 404, { error: "Not found" });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: "Something went wrong." });
  }
}).listen(port, () => console.log(`🦫 Beaver Banff API on http://localhost:${port}`));
