# Beaver Banff — running plan

What's agreed, what's being built, and what's queued. Add to the bottom of each list; move
items up to **Done** as they land.

## Now

- [x] **📚 The Word Lodge** — the first themed game building. Four 3D word games (Wordle,
  Connections, Mini Crossword, Spelling Bee), all built as seeded sims so they work solo
  against bots today and over the network later. See
  [the design](superpowers/specs/2026-10-21-word-lodge-design.md).
- [x] **Frame-rate work** — chunked world geometry + frustum culling, cheaper draw queue.

## Themed game buildings

Each one is an interior `Scene` entered from a building in town, holding games that share the
seeded-sim shape the Word Lodge establishes.

| Building | Where | Games inside |
|---|---|---|
| 📚 **Word Lodge** | Library Lane, off the west end of Main Street | Wordle, Connections, Mini Crossword, Spelling Bee |
| 🎲 **Board Game Manor** | A new estate on the north edge of town | A **mansion whodunnit** (rooms, suspects, deduction), **giant Guess Who** (a wall of hinged portraits), **giant chess & checkers** (walk between the squares), **Monopoly City** (a board you walk around as your own token) |
| 🧠 **Puzzle Observatory** | The existing observatory, east quarter | Nonograms, sudoku and logic grids as 3D light-tiles under the dome |
| 🎵 **Music Hall** | Grows out of the town-square bandstand | Rhythm games, a note-matching duet mode |
| 🏛️ **Trivia Museum** | New, beside the town hall | Buzzer rounds drawing on the Banff facts already in the journal |
| 🕹️ **Riverside Arcade** | Exists; currently only shows leaderboards | Walk-up cabinets, each a micro-game |

### Board Game Manor — detail

The four games the manor holds, in build order:

1. **Giant chess / checkers** — simplest: a board, pieces, a turn sim, a minimax bot. Proves the
   turn-based-with-bot shape for the manor the way Wordle proves it for the Lodge.
2. **Giant Guess Who** — a wall of portraits that flip down. Each player holds a secret beaver;
   you alternate yes/no questions. Natural multiplayer, easy bot.
3. **Mansion whodunnit** — the biggest: walk the manor's rooms gathering clues, deduce who, where
   and with what. Needs a room graph, a clue-dealing algorithm and a deduction bot.
4. **Monopoly City** — a board you walk as your own token, buying streets named after the town's
   real places. Longest session of the four; needs save/resume.

## Map expansion

- **Widen the valley** — raise `HUB.radius` 100 → ~140 and fill the empty north-west quadrant
  with a harbour district or ski village. Costs geometry; do it after chunked culling lands.
- **A second valley by train** — a new `Scene` reached from the station, like the summit. Much
  cheaper than growing the hub and gives somewhere genuinely new to go.
- **Underground** — a mine and cave network under the waterfall cliff. The train tunnel is
  already there as the way in.
- **Seasonal dressing** — the fairground becomes a winter market, the square a spring fête. The
  seasons system already exists; this is placement data per season.

## Activities

- **Mail delivery rounds** — the post office exists and does nothing.
- **Fish and bug tournaments** — weekly themes, scored against the village.
- **Cooking** at the bakery, combining foraged items.
- **Photography quests** — "photograph a rainbow over the lighthouse". Photo mode exists.
- **Hide and seek / tag** — player-run, needs only a timer and a role flag.

## Engine and infrastructure

- [x] **Chunked geometry + frustum culling** — the world drew ~1,027,000 triangles every frame
  regardless of where the camera pointed (743k visible pass + 315k again for shadows). Scenery
  is now split into 345 pieces that are tested against the camera and the shadow box. Measured
  from where players actually stand: **48% fewer triangles on the plaza, 69% on Main Street,
  78% at the Word Lodge.**
- [x] **Ground detail range** — grass and flowers (170k triangles) stop drawing past 52 m.
- [x] **Cheaper draw queue** — reuse arrays, stop allocating per frame, skip redundant uniforms.
- [x] **`pathDistance` / `riverDistance`** — were allocating an array and a closure on every
  call, during world build, every frame, and on the server for every movement check. ~2.5×
  faster as plain loops.
- [ ] **Pack vertex attributes** — colour and smooth-normal to bytes: 48 → 28 bytes/vertex, about
  45 MB less GPU memory. Matters most on phones.
- [ ] **Index buffers** — the world is non-indexed triangle soup today.
- [ ] **Spread `buildHub` across frames** — it blocks for ~1 s at startup. Needs a progress bar.
- [ ] **Batch the per-frame DOM writes** — every nametag, bug, place label and NPC mark sets
  `style.left`/`top` each frame.
- [ ] **Online multiplayer for the Word Lodge** — the sims and rooms are built for it; what's
  left is matchmaking across hubs and a lobby. See the design doc's "Scope for online play".
