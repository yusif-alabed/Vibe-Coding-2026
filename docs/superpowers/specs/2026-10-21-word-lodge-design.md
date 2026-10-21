# The Word Lodge — design

A themed game building on Library Lane holding four word games, each rendered in 3D in the
village's style and each built so that playing a friend over the network later is a wiring
job, not a rewrite.

## Intent

Beaver Banff's minigames are all twitch games: steer, dodge, throw. The Word Lodge is the first
building that asks you to *think*, and the first of a family of themed game buildings (the Board
Game Manor, the Puzzle Observatory and the rest are in [the roadmap](../../roadmap.md)). It also
establishes the two patterns those buildings will reuse: an **interior `Scene`** entered from a
building in town, and a **seeded turn-based sim** in `shared/` that bots and real players drive
through the same code path.

## Goals

- Four word games — Wordle, Connections, Mini Crossword, Spelling Bee — playable today, solo,
  against bot beavers.
- Every one of them **3D and in the game's style**: chunky letter blocks, timber and lamplight,
  no flat DOM board pretending to be a game.
- Every one of them has a **race element**: you can see opponents closing in while you play.
- Written so online multiplayer needs no change to the game rules.

## Non-goals

- Online matchmaking across villages. The rooms are built; the lobby isn't.
- Hand-authored daily puzzle packs. Puzzles are generated from a seed (see below).
- Any other themed building. One at a time.

## Anti-goals

Things that would make this a failure even if it shipped:

- **A DOM game in a 3D costume.** If the board is an HTML grid floating over the world, it's wrong.
- **An unfair dictionary.** A player typing a real word and being told it isn't one is the worst
  moment a word game has. The accepted list is deliberately much wider than the answer list, and a
  rejected guess never costs a turn.
- **A bot that is simply faster than a human.** Bots that win by reaction speed aren't opponents,
  they're a clock. They think at human pace with human-shaped mistakes.

## The key constraint: puzzles come from a seed

Every existing minigame is `makeSim(game, seed, entrants)` — the server and every client build
the identical world from one integer. The word games must do the same, which rules out
hand-authored puzzle packs: the server would have to ship the answers to the client, where
anyone can read them.

So puzzles are **generated deterministically from the seed** out of a curated vocabulary
(`shared/src/words/vocab.ts`). Same seed, same puzzle, everywhere, with no answers on the wire
until the game ends. The vocabulary is hand-written rather than taken from a system dictionary,
because the system dictionary is full of `azote` and `cyath` and has no plurals.

## The games

| Game | The 3D object | How you race |
|---|---|---|
| **Wordle** | A 6×5 wall of chunky letter blocks that physically flip as they're marked | Opponents' boards hang on the side walls showing **colours only, no letters** — you watch them close in without being handed clues |
| **Connections** | 16 cubes on a lodge table; a solved group rises and slams together into a coloured bar | First to four groups; mistakes are public, so a rival's wrong guess is your opening |
| **Mini Crossword** | A 5×5 grid laid into the floor you walk onto, clues on a lectern | Fastest clean fill; opponents show a count of correct squares |
| **Spelling Bee** | A honeycomb of hex tiles on a plinth, centre letter glowing | Continuous scoring against the clock; the scoreboard moves while you type |

## Scope for online play

Three things make a game in this building work over the network without rule changes:

1. **All rules live in `shared/`.** `WordMatch` is driven only by actions (`guess`, `pick`,
   `fill`, `word`) and a clock. It never touches the DOM, `Math.random` or `Date.now` except
   through arguments.
2. **The wire separates you from them.** `WordSelfWire` has your letters; `WordPlayerWire` has
   only what an opponent is allowed to see — colour patterns, counts, scores. This is what lets
   the same message go to a bot-filled solo game and a four-player race unchanged.
3. **Bots are players.** A bot is a `WordPlayer` with `isBot: true` whose actions come from
   `botTurns(now)` on a timer, exactly like `GolfMatch`. Replacing one with a real player is
   deleting a flag.

What's left for real multiplayer: a `WordRoom` queue keyed by game across hubs, and the lobby UI.
The room itself (`game-server/src/rooms/WordRoom.ts`) is written and wired.

## Where it goes

A timber lodge with a book-stack weathervane at **(-86, -30)**, facing the library down a new
**Library Lane** running north from Main Street. Inside the walkable radius, clear of Cottage
Lane, on flat ground.

## What was left to the builder

These were my calls, not the user's:

- Generated puzzles over authored packs — forced by the seed constraint above.
- A hand-written vocabulary rather than `/usr/share/dict/words`.
- Four games rather than five; Strands-style path-tracing is queued, not built.
- A DOM on-screen keyboard over a 3D one. The game's own art guide calls for "sticker UI" in DOM
  and 3D in the world; a 3D keyboard would be worse to type on and off-style.
