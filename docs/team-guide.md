# Working on Beaver Banff together (3 people)

## Suggested split

Each person owns an area so you rarely edit the same files at once.

| Owner | Area | Main files |
|---|---|---|
| **Person 1 — World & art** | The village, scenery, beaver look, new cosmetics | `client/src/game/hubWorld.ts`, `props.ts`, `beaver.ts`, `palette.ts`, `shared/src/cosmetics.ts`, `docs/art-style.md` |
| **Person 2 — Minigames** | Toboggan Rush tuning, the next minigame (log rolling or dam building) | `shared/src/race.ts`, `client/src/game/raceScene.ts`, `raceWorld.ts`, `game-server/src/rooms/RaceRoom.ts` |
| **Person 3 — Social & server** | Friends, parties, accounts, moderation, UI | `game-server/`, `api/`, `client/src/game/hubScene.ts` (HUD/chat), `client/src/ui/` |

Shared files everyone touches carefully: `shared/src/protocol.ts` (messages) and `shared/src/constants.ts`. Tell the others before changing these.

## Day-to-day flow

1. `git pull` before you start.
2. Make a branch: `git checkout -b yourname/what-youre-doing`.
3. Build in small steps; run `npm test` and play it (`npm run dev`).
4. Push and open a Pull Request on GitHub. Ask one teammate to look at it.
5. Merge, then everyone pulls.

## Vibe-coding tips

- Ask your AI helper to read `docs/` first; it explains the rules and style.
- Keep the server in charge: anything about coins, scores or items must be decided in `game-server/` using `shared/` rules.
- New cosmetic? Add it to `CATALOG` in `shared/src/cosmetics.ts`, then draw it in `beaver.ts` (`addHat`, `addScarf`, `addBackpack`).
- New place in the village? Add it to `HUB_PLACES` in `shared/src/constants.ts`, build it in `hubWorld.ts`, and add a label.
- Run `npm run build:preview` to get a single HTML file anyone can open to try your changes.
