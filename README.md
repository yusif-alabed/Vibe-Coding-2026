# 🦫 Beaver Banff

A cozy 3D multiplayer social game set in a Banff-inspired mountain village. Explore pine forests, turquoise lakes and timber cabins as an original chibi beaver, meet friends, race toboggans, earn coins and dress up.

> Everything here is original: no names, characters, art or music from any other game.

## What works today

- 🏔️ **A whole mountain town** — the original village (plaza fountain, lodge café, outfitter, arcade, lake dock, hot springs, trailhead) plus cobbled **Main Street** (bakery, post office, general store, flower shop, ice-cream parlour, toy shop, maple shop, library), a **town hall** with a clock tower, the **town square** bandstand and market, **Cottage Lane** up to the **windmill**, a **skating pond**, a **lighthouse**, an east quarter across a second bridge (**watermill**, **greenhouse**, **observatory**, **fire lookout**) and a **fairground** with a Ferris wheel, a **campground** and a **ranger station** south of the river.
- ☕ **Things to do everywhere** — sip cocoa, soak in the hot spring, eat croissants / ice cream / maple taffy / toasted marshmallows, play guitar on the bandstand, ride the Ferris wheel, go skating, climb the fire lookout, ring the town bell, read Banff facts at the library.
- 🌗 **Day and night** — a 25-minute day shared by everyone (pink sunrise, golden hour, orange sunset, violet dusk, moonlit starry night) in the village, cabins, races and title screen. A clock under the minimap shows the time. Or pick golden hour, day or night in ⚙️ Settings.
- 🗺️ **Minimap** — turns with your camera; tap it or press **M** for the full town map. Place names only appear when you're close.
- 🎥 **Simple follow camera** — it sits behind and above your beaver and moves exactly as you do; it passes through things instead of bumping into them. On streets, forward walks straight up the road.
- 🦋 **A living world** — butterflies, fireflies, jumping fish, birds overhead, chimney smoke, a busker by the fountain and skaters on the pond.
- 🔊 **Sound and music** — a gentle generated acoustic soundtrack (racier in races), footsteps that change on grass/stone/wood/snow, splashes, coin chimes, the town bell, crackling campfires, birdsong by day and crickets at night.
- 🦫 **Beaver avatars** — 9 fur colours and 30 cosmetics, including seasonal hats (flower crown, sun hat, pumpkin, holiday pom hat), earmuffs, a propeller beanie, picnic basket, guitar, snowboard and sparkle/heart/bubble trails.
- 👥 **Multiplayer** — public villages (up to 50 beavers each) and private rooms with a share code.
- 🤝 **Friends and parties** — add friends (tap a beaver or use their friend code), see who's online and where, jump to their village, and form a party of up to 4 that races together.
- 💾 **Saved progress across devices** — the server saves every beaver; use your recovery code (⚙️ Settings) to bring your beaver to another device.
- 💬 **Safe chat** — filtered text chat, quick-chat phrases, emotes, block and report.
- 🛷 **Toboggan Rush** — 4-racer downhill race, bots fill empty seats, server-calculated results.
- 🛶 **Canoe Dash** — a second minigame: paddle down a forest river from the Lake Dock, dodging rocks, logs and buoys and riding the rapids.
- 🪙 **Coins & shop** — earn coins racing, spend them on cosmetics (no pay-to-win).
- 📜 **Daily quests** — three new quests every day (UTC), a bonus for finishing all three, and 12 golden pinecones hidden around the village.
- 🏡 **Cabin decorating** — every beaver has a log cabin. Buy furniture (15 pieces), arrange it on a tile grid, and visit friends' cabins.
- 📷 **Photo mode** — free camera, poses, filters and a postcard frame; save the picture to your device.
- 📱 **Phones** — on-screen joystick, a ⚡ Fast graphics setting for older phones.
- 🎮 **Solo mode** — the whole game also runs in the browser with friendly bot beavers (you can befriend them and party up too).
- ⛳ **Bow Valley Golf** — nine holes modelled on the famous course along the Bow River (Bow River Bend, Rundle's Shadow, Elk Meadow, the Devil's Cauldron par 3 over a glacial pond, Spray River, Sulphur Mountain, Cascade, Riverside, The Castle). Pick how many holes (1–9), aim, choose driver / iron / wedge / putter, hold and release the power meter. Real ball flight with wind, bounces, roll, slopes, bunkers, water and out-of-bounds penalties. Play with your party (or a bot), and quit any time keeping the coins for finished holes. Start at the ⛳ clubhouse.
- 🎮 **Four more minigames + weekly leaderboards** — 🌰 Pinecone Hunt (campground), 🪵 Log Rolling (lighthouse), ⛄ Snowball Fight in teams (skating pond) and 🦫 co-op Dam Builder (watermill). Weekly bests for every game reset each Monday.
- 🍂 **Seasons and weather** — the real month sets the season (spring blossom, summer, autumn leaves, winter snow) with limited-time outfits and furniture; rain (umbrellas come out), snow, fog and rainbows roll through every few minutes.
- 🎣 **Village life** — fishing at the lake and river (12 catches, some only at night, in certain seasons or in the rain), spotting butterflies and fireflies, a community garden (plant, water, harvest), a bag to sell or gift items, and a 📖 collections journal (fish, bugs, places, Banff facts) with badges and rewards.
- 🗨️ **Townsfolk with stories** — Bea the baker, Mayor Maple, Ranger Rowan and Keeper Gus each have a three-part errand chain with special rewards (a baker's hat, the mayor's sash, a fox kit and a duckling pet).
- 🏡 **Cottage Lane** — every beaver's cabin is on the lane noticeboard: visit, ❤️ like, stamp guestbooks, and see the week's coziest cabins.
- 💃 **Group fun** — dance, sing along, play guitar and pair-skate with others; group photos count too. **Clubs** with a tag on your name, **gifts** to friends and **invite links** (`?room=CODE`, `?friend=CODE`).
- 🚂 **Getting around** — a steam train circling the valley (through a tunnel under the waterfall cliff), hot-air balloon rides, and the 🚡 gondola to a snowy summit with a glacier lake, an ice cave and a viewpoint.
- 🦊 **More customisation** — tails, eyes, pets that follow you, and a 🎨 dye station for hats, scarves and packs.
- ♿ **Comfort** — large text & buttons, colour-blind friendly map shapes, phone vibration (haptics), bigger tap targets.

## Play now (no install)

Open **`index.html`** in this folder in any modern browser (Chrome, Edge, Safari, Firefox). It's the whole game in one file, in solo mode with friendly bot beavers.

> `client/index.html` is only a template for the build, not the game. `index.html` is regenerated by `npm run build` / `npm run build:preview`, so rebuild before committing game changes.

## Quick start

You need **Node.js 20+**.

```bash
npm install
npm run dev
```

Then open **http://localhost:5173**. That starts the game server (`ws://localhost:2567`) and the client together. Open a second browser window to see two beavers in the same village.

Other commands:

| Command | What it does |
|---|---|
| `npm test` | Run all tests (game rules + live server tests) |
| `npm run typecheck` | Type-check every package |
| `npm run dev:server` | Game server only |
| `npm run dev:client` | Client only |
| `npm run build` | Production client in `client/dist/` (set `GAME_SERVER_URL=wss://your-server`), and refreshes the playable `index.html` |
| `npm run build:preview` | Refreshes the one-file playable `index.html` (solo mode) |

## Put it online (so friends anywhere can play)

The game server also serves the game itself, so hosting is one service and one link:

```bash
npm start            # builds the client and starts everything on http://localhost:2567
```

Deploy the included **`Dockerfile`** to any host that runs containers:

- **Render**: New → Blueprint → choose this repo (uses `render.yaml`, includes a disk for saves).
- **Fly.io**: `fly launch --copy-config`, `fly volumes create beaver_data --size 1`, `fly deploy` (uses `fly.toml`).
- **Anywhere with Docker**: `docker build -t beaver-banff . && docker run -p 2567:2567 -v beaver-data:/data beaver-banff`

Then share the URL (e.g. `https://beaver-banff.onrender.com`). Player progress is saved in `DATA_FILE` (`/data/players.json` in the container), so keep that folder on a persistent disk.

### Accounts API + database (optional for now)

```bash
docker compose up -d db          # PostgreSQL on localhost:5432
npm run migrate --workspace api  # create tables + load the cosmetic catalog
npm run dev:api                  # http://localhost:3001
```

Or run everything in Docker: `docker compose up`.

Copy `.env.example` to `.env` to change ports and URLs.

## Project layout

```text
Vibe-Coding-2026/
  client/        Browser game: WebGL toon renderer, scenes, UI (TypeScript, esbuild)
  game-server/   Real-time rooms over WebSocket (village + races), server-authoritative
  api/           Accounts, profiles, inventory, moderation (Node + PostgreSQL)
  shared/        Game rules used by both sides: protocol, race sim, rewards, chat filter
  assets/        Future sounds/models (current art is generated in code)
  docs/          Game design, art style, architecture, team guide
```

## Docs

- [Game design](docs/game-design.md) — loop, places, minigame rules, rewards, safety, decisions
- [Art style](docs/art-style.md) — "Chunky Alpine Toon" palette and rules
- [Architecture](docs/architecture.md) — how client, server and API fit together
- [Team guide](docs/team-guide.md) — how the three of us split the work

## Controls

**Walk** WASD / arrows or tap the ground · **Camera** drag, Q/E, scroll · **Chat** Enter · **Hop** Space · **Use place** F · **Journal** J · **Bag** B · **Map** M · **Photo mode** P (Space to snap) · **Cabin** 🏡 button, R to turn furniture · **Steer toboggan** A/D or ←/→ (phones: hold left/right side) · **Golf** A/D aim, 1–4 clubs, hold Space for power · **Minigames** A/D (+W/S in the Pinecone Hunt), Space to throw / hop
