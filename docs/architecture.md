# Architecture

```text
 Browser (client/)                     Game server (game-server/)              API (api/)  ──  PostgreSQL
 ─────────────────                     ───────────────────────────             ──────────────────────────
 WebGL toon renderer      WebSocket    HubRoom  (≤50 beavers per village)      Accounts, profiles,
 Hub scene / Race scene  ───────────▶  RaceRoom (one per race, isolated)       friends, inventory,
 Sends INPUT only        ◀───────────  Validates movement, chat, purchases     ledger, reports,
                          JSON msgs    Runs the race simulation                moderation actions
                                       Calculates results & coins
                        └──────────── shared/ (TypeScript rules used by both) ───────────┘
```

## Packages

| Folder | What's in it |
|---|---|
| `shared/` | Game rules both sides use: constants, wire protocol, cosmetics catalog, purchase rules, rewards, chat filter + rate limiter, movement validation, the deterministic Toboggan Rush simulation. |
| `game-server/` | Node + `ws`. `server.ts` routes connections; `rooms/HubRoom.ts` (village), `rooms/RaceRoom.ts` (race). In-memory player store keyed by session token. |
| `client/` | Zero-dependency TypeScript game. `engine/` (math, mesh builder, renderer), `game/` (beaver, world, scenes), `net/` (online + offline), `ui/`. Built with esbuild. |
| `api/` | Node + `pg`. Register/login (scrypt hashes, signed session tokens), `/me`, catalog. `migrations/` holds the schema. |
| `assets/` | Reserved for future sounds/models. Current art is generated in code (see `docs/art-style.md`). |

## Server-authoritative rules

The browser never decides anything that matters:

| Thing | Client sends | Server does |
|---|---|---|
| Walking | proposed x/z | caps speed, keeps inside the world, pushes out of buildings |
| Chat | text | filters, blocks personal info, rate limits, respects blocks |
| Outfit | desired look | strips anything you don't own or that's in the wrong slot |
| Purchases | item id | checks price and ownership against its own coin balance |
| Racing | steer value −1…1 | clamps it, runs the physics, decides places and coins |

## Rooms & scaling

- Public villages fill to `HUB.capacity` (50), then a new `village-N` opens.
- Private cabins are separate hub rooms with a 5-letter invite code.
- Each race is its own room; the hub keeps running independently.
- Position updates are batched at 12 Hz per room, race snapshots at 20 Hz.
- To scale out: run several game-server processes behind a load balancer with sticky sessions per room, and move the player store to the API/PostgreSQL (Phase 3).

### Load-test guidance (30+ players)

1. Start the server, then run N headless clients that join and send `move` at 12 Hz (see `game-server/src/test/server.test.ts` for a minimal client).
2. Watch `GET /health` for room sizes and the process CPU.
3. Bandwidth per hub ≈ players² × 12 Hz × ~30 bytes. 50 players ≈ 900 KB/s outbound — fine for one process. Beyond that, add interest management (only send nearby players).

## Data model

See `api/migrations/001_init.sql`: `users`, `profiles`, `friendships`, `blocks`, `currencies` + append-only `currency_ledger`, `cosmetic_items`, `inventory`, `rooms`, `match_results`, `player_reports`, `moderation_actions`.

## Testing

`npm test` runs Node's built-in test runner over:
- reward maths, purchases, look sanitising,
- chat filter, personal-info blocking, rate limits,
- movement validation,
- race determinism, finishing and cheat clamping,
- live game-server tests: two players syncing, anti-teleport, private rooms, chat filter + blocking, coins surviving reconnect, portal check,
- password hashing and session tokens.
