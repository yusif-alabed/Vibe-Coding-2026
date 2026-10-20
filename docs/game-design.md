# Beaver Banff — Game design

A cozy, original 3D social game. Players are beavers in a Banff-inspired mountain village: they explore, meet friends, play minigames, earn coins and dress up.

```text
Explore the mountains → meet friends → play minigames → earn coins →
unlock cosmetics/emotes → show them off → return with friends
```

## Audience & tone

All ages, including kids. Friendly, low-pressure, no violence, no pay-to-win. Safety features are part of the core design, not an add-on.

## The village (social hub)

One open 3D map, about 120 m across, ringed by pine forest and snowy peaks.

| Place | Where | What you do there |
|---|---|---|
| ⛲ Village Plaza | centre | Spawn point, fountain with beaver statue, benches, lamps |
| ☕ Lodge Café | north-west | "Grab a hot cocoa" (emote), campfire, benches |
| 🎒 Outfitter | north-east | Opens the cosmetic shop / wardrobe |
| 🕹️ Riverside Arcade | east, by the river | Teases upcoming minigames |
| 🛶 Lake Dock | south-west | Dock into a turquoise glacier lake; beavers can swim |
| 🛷 Trailhead portal | north, snowy hill | Joins the Toboggan Rush queue |
| ♨️ Hot Springs | far north-east | Soak (emote), steam |

The river runs from the north-east peaks, past the arcade, around the south of the village (with a bridge) into the lake. Water is walkable: beavers switch to a swimming pose.

## Controls

| Action | Desktop | Phone |
|---|---|---|
| Walk | WASD / arrows | Tap the ground |
| Camera | Drag, Q/E, scroll zoom | Drag |
| Chat | Enter | Chat box |
| Hop | Space | 😀 menu |
| Use place | F or the big button | Big button |
| Steer (race) | A/D or ←/→ | Hold left/right half of screen |

## Minigame 1: Toboggan Rush

- 4 racers (empty seats filled by bot beavers, so you never wait long).
- 520 m winding downhill run, ~20 seconds.
- Steer to dodge rocks, pines and snowmen (hit = "BONK!", 0.9 s slowdown).
- Slide through golden snowflake rings for a 1.6 s speed boost.
- The **server** simulates the race from player steering input only and decides the results.

### Rewards

| Result | Coins |
|---|---|
| Taking part | 10 |
| 1st / 2nd / 3rd / 4th (if finished) | +40 / +25 / +15 / +5 |

New players start with 100 coins so they can buy something on day one.

## Cosmetics

Hats, scarves, backpacks and trails (12 items, 0–350 coins) plus 6 fur colours. Cosmetics never affect gameplay. The catalog lives in `shared/src/cosmetics.ts`.

## Daily quests & golden pinecones

- Three quests a day from a pool of 14 (visit a landmark, race, podium, pinecones, emotes, quick-chat, buy something, decorate, take a photo). Picked deterministically per player and UTC day; never two of the same kind.
- Rewards 15–50 coins each, plus a 50-coin bonus for finishing all three.
- 12 golden pinecones spawn around the village each day (same spots for everyone, 3 coins each, once per player per day). Walk into one to collect it.
- The server counts progress only from things it can check itself (position, races, purchases), so quests can't be faked from the client. Rules live in `shared/src/quests.ts` and `shared/src/progress.ts`.

## Cabins & furniture

- Every player owns a cabin: a 10 × 8 tile floor with a stone fireplace. Rugs sit on their own layer so furniture can stand on them.
- 15 furniture pieces (20–120 coins, up to 6 of each). New players start with a rug, armchair and stump table.
- Decorate mode: pick an item from your basket, tap a tile (green = fits, red = blocked), R / ⟳ to turn it, tap placed furniture to move it. Layouts are validated on the server (`shared/src/cabin.ts`).
- Tap another beaver → 🏡 Visit cabin. Visitors can look around but not change anything.

## Photo mode

- 📷 button or P. Hides the HUD; drag to orbit, scroll to zoom, ▲▼ to tilt. Your beaver holds a pose (smile, wave, cheer, mid-hop, surprised, cool).
- Filters: Natural, Golden, Film, Vivid, Mono, Dreamy. Optional postcard frame with a caption and date. Save or share the JPEG.
- Taking a photo counts for the photo daily quest.

## Safety

- Chat filter (catches common disguises like `stup1d`), and a hard block on emails, phone numbers and links.
- Rate limit: burst of 5 messages, then 1 every 1.5 s; repeated identical messages are dropped.
- Quick-chat phrases and emotes for players who'd rather not type.
- Tap any beaver to Block (you stop seeing their chat) or Report (logged for moderators).
- Every report, block, filtered message and rejected move is written to a moderation log.
- No voice chat.

## Product decisions made during the build

Recorded here as the brief asked:

1. **Toboggan Rush** was chosen as the first minigame: easiest rules to understand, short rounds, works with 1–4 players.
2. **Bots fill empty race seats** so a solo player can always race; bots earn nothing.
3. **Cosmetics are bought anywhere** via the 🎒 button (not only at the Outfitter), because walking back to buy is friction for kids. The Outfitter building still opens the shop.
4. **Solo mode** runs the same shared rules in the browser with bot villagers, so the game is playable without a server (and doubles as an offline preview).
5. **Rendering**: a small built-in WebGL toon renderer instead of Three.js. It gives the outlined, flat-shaded look directly, has zero dependencies and keeps the game tiny. Swapping to Three.js later is possible; models are built from simple primitives.
6. **Private cabins** use a 5-letter code (no confusing letters like O/0, I/1).
7. **Sessions before accounts**: Phase 2 keeps coins/outfit per browser session token; Phase 3 adds real accounts via the API.

## Roadmap

| Phase | Status |
|---|---|
| 1. Foundation: monorepo, docs, Docker, DB schema | ✅ Done |
| 2. Multiplayer village: movement, sync, rooms, private cabins | ✅ Done |
| 3. Social: accounts, friends, invites, presence, join-friend | 🟡 Chat safety, block/report done. Accounts API started. Friends next. |
| 4. Minigame: Toboggan Rush with server results & rewards | ✅ Done (party queue next) |
| 5. Progression & safety: shop, inventory, mod tools, reconnect | 🟡 Shop & inventory done, moderation log in memory. Persistence and admin tools next. |
