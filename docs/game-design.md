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

## The town

The village grew into a town (walkable radius 100 m, up from 62 m). The layout lives in `shared/src/townLayout.ts`; the server turns every building into collision circles and the client builds the models from the same numbers (`client/src/game/village/town.ts`).

- **Main Street** runs west from the plaza (cobbled) to the **Town Hall**, past shops with awnings and hanging signs, and through the **town square** (bandstand + market stalls).
- **Cottage Lane** heads north past pastel cottages with picket fences to the **windmill**; a path leads to the **skating pond**.
- The **lighthouse** stands on the lake shore.
- A second bridge crosses the river east to the **watermill**, **greenhouse**, **observatory**, cottages and the **fire lookout** (climbable).
- South of the river: the **fairground** (Ferris wheel, stalls, string lights), the **campground** (tents, campfire) and the **ranger station**.

### Activities

Walk up to a place and press the action button (or F). Activities are broadcast to everyone and the server checks you're at the right place (`ACT_PLACES` in `shared/src/protocol.ts`): cocoa (lodge), soak (hot spring), croissant (bakery), ice cream, maple taffy, marshmallow (campfire), guitar (bandstand), Ferris wheel ride, skating, climbing the lookout. Treats, music, rides and skating count toward new daily quests.

## Minigame 2: Canoe Dash

Same deterministic race engine as Toboggan Rush (server-authoritative, bots fill seats), themed as a forest river: rocks, floating logs and buoys to dodge, glowing rapids rings for speed. Join from the **Lake Dock**. Rewards match Toboggan Rush; finishing counts for the "Finish a Canoe Dash" quest.

## Day and night

One in-game day lasts 25 real minutes and follows the wall clock, so everyone sees the same sky. Nights are short (about a fifth of the cycle). Players can lock the time of day in ⚙️ Settings.

## Seasons and weather

The real calendar month sets the season (Mar–May spring, Jun–Aug summer, Sep–Nov autumn, Dec–Feb winter). Seasonal hats, scarves, trails and furniture are only sold during their season. Weather changes every 5 minutes from the shared clock (rain, snow in winter, fog, clouds, and a rainbow after a shower). Both can be locked in ⚙️ Settings.

## Village life

- **Fishing** at the lake or river: cast, wait for the bobber to dip, tap. The server picks the catch from the spot, season, time of day and weather (12 catches incl. junk; Golden Trout only in the rain).
- **Bugs**: butterflies by day, fireflies at night — tap one to spot it.
- **Garden**: 4 plots each, seeds cost 🪙5, watering makes them grow 40% faster; harvests go in your bag.
- **Bag**: sell items for coins or gift them to friends.
- **Journal**: fish, bugs, places (31 incl. the summit) and 12 Banff facts. Completing a page gives coins, a cosmetic and a badge.
- **Townsfolk**: Bea (bakery), Mayor Maple (town hall), Ranger Rowan (ranger station), Keeper Gus (lighthouse) each give a 3-step errand chain with a special reward.

## Minigames 3–6 and golf

All run on the server as deterministic simulations (solo mode runs the same code), bots fill empty seats, coins are paid by the server and weekly bests feed leaderboards that reset on Mondays.

- **Pinecone Hunt** (campground): 60 s, run around a clearing grabbing pinecones (big ones = 3).
- **Log Rolling** (lighthouse): keep your balance on a spinning log, lean against the wobble and hop; last beaver dry wins.
- **Snowball Fight** (skating pond): two teams of two, move along your fort and throw; most team hits wins.
- **Dam Builder** (watermill): co-op, catch floating logs to build the dam before the river spills over.
- **Bow Valley Golf** (clubhouse): 9 holes inspired by the Banff Springs course; choose 1–9 holes; everyone plays their own ball at the same time; quit any time. Physics: projectile flight with drag and wind, bounces and roll by surface (fairway, rough, green, sand, water, out-of-bounds), green slopes, trees that knock the ball down, cup capture under a speed limit, stroke penalties for water/OB, max 10 strokes a hole.

## Getting around

A steam train loops the valley on a timetable (two trains, about a minute a lap) from the station on the east edge; hot-air balloons fly a loop over town from the balloon meadow; the gondola rides up to the summit (glacier lake, ice cave, viewpoint).

## Social extras

Clubs (create/join by code, tag on your name), gifts, ❤️ likes and guestbook stamps on cabins, the weekly coziest-cabin list on the Cottage Lane noticeboard, dancing/singing/guitar/pair skating and group photos that count for group quests, invite links (`?room=CODE` for a private room, `?friend=CODE` to send a friend request on arrival).

## Friends, parties and accounts

- Every player gets a public **friend code** and a secret **recovery code** (⚙️ Settings). The recovery code signs the same beaver in on another device.
- Friend requests must be accepted. Friends list shows who's online and where; **Join** hops into their village.
- **Parties** (up to 4): when the leader queues for a race, party members in the same village come too.
- Progress (coins, outfits, cabin, quests, friends) is saved by the game server to `DATA_FILE`.

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
| 3. Social: accounts, friends, invites, presence, join-friend | ✅ Friends, parties, presence, join-friend, recovery codes |
| 4. Minigames: Toboggan Rush and Canoe Dash with server results & rewards | ✅ Done, with party queue |
| 5. Progression & safety: shop, inventory, mod tools, reconnect | 🟡 Shop, inventory, quests, cabins and saved progress done. Admin tools next. |
| 6. World & life: seasons, weather, journal, fishing, garden, townsfolk, golf, 4 minigames, clubs, train, balloons, summit | ✅ Done (hosting and admin panel deliberately left for later) |
