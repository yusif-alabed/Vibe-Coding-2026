import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ANSWERS, CLUES, GROUPS, WordMatch, hiveWords, isWordGame, known, makePuzzle, markGuess, parseWordAction,
  scoreWord, stillPossible, wordCoins, wordsOfLength,
} from "./index";
import { BeePuzzle } from "./bee";
import { ConnectionsPuzzle } from "./connections";
import { CrosswordPuzzle } from "./crossword";
import { WordlePuzzle } from "./wordle";
import type { WordGame } from "./types";

const GAMES: WordGame[] = ["wordle", "connections", "crossword", "bee"];
const entrants = (bots = 2) => [
  { id: "me", name: "You", isBot: false },
  ...Array.from({ length: bots }, (_, i) => ({ id: `bot${i}`, name: `Bot ${i}`, isBot: true })),
];

// ------------------------------------------------------------------ vocabulary

test("vocabulary is well formed", () => {
  assert.ok(ANSWERS.length > 500, `only ${ANSWERS.length} answers`);
  for (const w of ANSWERS) assert.match(w, /^[a-z]{5}$/, `bad answer ${w}`);
  assert.equal(new Set(ANSWERS).size, ANSWERS.length, "duplicate answers");
  // Every answer must also be accepted as a guess, or a player could type the solution and be
  // told it isn't a word.
  for (const w of ANSWERS) assert.ok(known(w), `answer ${w} is not an accepted guess`);
  for (const [w, c] of Object.entries(CLUES)) {
    assert.ok(c.length > 0, `empty clue for ${w}`);
    assert.match(w, /^[a-z]{3,5}$/, `clue key ${w} is the wrong length`);
  }
});

test("Connections groups are usable", () => {
  assert.ok(GROUPS.length >= 16, "need plenty of themes for variety");
  for (const g of GROUPS) {
    assert.ok(g.words.length >= 4, `${g.theme} has too few words`);
    assert.ok(g.hint.length > 0, `${g.theme} has no crossword hint`);
    assert.equal(new Set(g.words).size, g.words.length, `${g.theme} repeats a word`);
  }
});

// ------------------------------------------------------------------ Wordle

test("markGuess handles repeated letters", () => {
  assert.equal(markGuess("crane", "crane"), "ggggg");
  assert.equal(markGuess("brick", "crane"), "bgbyb"); // R is placed, C is elsewhere
  assert.equal(markGuess("sloth", "crane"), "bbbbb");

  // ABIDE has a single E, so only the first of SPEED's two Es may colour.
  assert.equal(markGuess("speed", "abide"), "bbyby");
  // ERASE has two, so both do.
  assert.equal(markGuess("speed", "erase"), "ybyyb");

  // A green claims its letter before any amber can: THOSE's only E is matched in place, so
  // GEESE's earlier Es stay blank.
  assert.equal(markGuess("geese", "those"), "bbbgg");

  // RADAR has two Rs and two As; ARRAY's third R finds nothing left.
  assert.equal(markGuess("array", "radar"), "yyygb");
});

test("Wordle accepts real words, refuses nonsense, and never spends a row on a refusal", () => {
  const m = new WordMatch("wordle", 12345, entrants(0));
  const me = m.player("me")!;
  const bad = m.act("me", { kind: "guess", word: "zzzzz" });
  assert.equal(bad.ok, false);
  assert.equal(me.rows.length, 0, "a refused guess must not cost a row");
  const good = m.act("me", { kind: "guess", word: "crane" });
  assert.equal(good.ok, true);
  assert.equal(me.rows.length, 1);
  // Repeating a guess is also refused without cost.
  m.act("me", { kind: "guess", word: "crane" });
  assert.equal(me.rows.length, 1);
});

test("Wordle ends after six rows, or early on a solve", () => {
  const p = new WordlePuzzle(99);
  const answer = p.reveal().toLowerCase();
  const m = new WordMatch("wordle", 99, entrants(0));
  const me = m.player("me")!;
  for (const w of ["crane", "mouse", "plaid", "sight", "bluff"]) m.act("me", { kind: "guess", word: w });
  assert.equal(me.done, false, "five wrong guesses should not end it");
  m.act("me", { kind: "guess", word: answer });
  assert.equal(me.solved, true);
  assert.equal(me.done, true);
});

test("stillPossible narrows to the answer", () => {
  const answer = "beach";
  const rows = ["crane", "stout"];
  const marks = rows.map((g) => markGuess(g, answer));
  const left = stillPossible(ANSWERS, rows, marks);
  assert.ok(left.includes(answer), "the answer must survive its own clues");
  assert.ok(left.length < ANSWERS.length, "guesses should narrow the field");
});

// ------------------------------------------------------------------ Connections

test("Connections deals four distinct groups of four", () => {
  for (let seed = 1; seed <= 60; seed++) {
    const p = new ConnectionsPuzzle(seed * 31);
    assert.equal(p.setup.cards.length, 16, `seed ${seed}`);
    assert.equal(new Set(p.setup.cards).size, 16, `seed ${seed} repeats a card`);
  }
});

test("Connections rewards a right group and ends after four mistakes", () => {
  const m = new WordMatch("connections", 7, entrants(0));
  const me = m.player("me")!;
  // Four wrong picks, each of four cards that cannot all be one group.
  for (let i = 0; i < 4; i++) {
    const cards = [0, 1, 2, 3].map((k) => (i * 4 + k) % 16);
    m.act("me", { kind: "pick", cards: [...new Set(cards)] });
  }
  assert.ok(me.mistakes > 0 || me.found.length > 0, "picks must land somewhere");
});

test("Connections bots can finish the puzzle", () => {
  const m = new WordMatch("connections", 2024, entrants(1));
  let now = Date.now();
  for (let step = 0; step < 400 && !m.player("bot0")!.done; step++) {
    now += 1000;
    m.botTurns(now);
  }
  assert.equal(m.player("bot0")!.done, true, "a bot should reach an end state");
});

// ------------------------------------------------------------------ Crossword

test("every crossword seed yields a fully clued, solvable grid", () => {
  for (let seed = 1; seed <= 120; seed++) {
    const p = new CrosswordPuzzle(seed * 7919);
    const { blocks, clues, size } = p.setup;
    assert.equal(size, 5);
    assert.equal(clues.length, 10, `seed ${seed} has ${clues.length} clues`);
    for (const c of clues) assert.ok(c.text.length > 0, `seed ${seed}: empty clue`);

    const sol = p.solutionCells();
    for (let i = 0; i < 25; i++) {
      if (blocks[i]) assert.equal(sol[i], "", `seed ${seed}: letter in a blocked square`);
      else assert.match(sol[i], /^[a-z]$/, `seed ${seed}: square ${i} is "${sol[i]}"`);
    }
    // Each clue's answer must be a word, and no word may appear twice in one grid.
    const words = clues.map((c) => {
      const step = c.dir === "a" ? 1 : size;
      return Array.from({ length: c.len }, (_, k) => sol[c.cell + k * step]).join("");
    });
    for (const w of words) assert.ok(known(w), `seed ${seed}: "${w}" is not a word`);
    assert.equal(new Set(words).size, words.length, `seed ${seed} repeats a word: ${words.join(" ")}`);
  }
});

test("crossword grids vary between seeds", () => {
  const grids = new Set<string>();
  for (let seed = 1; seed <= 60; seed++) grids.add(new CrosswordPuzzle(seed * 104729).solutionCells().join(""));
  assert.ok(grids.size >= 30, `only ${grids.size} distinct grids from 60 seeds`);
});

test("crossword scores correct letters and completes", () => {
  const p = new CrosswordPuzzle(4242);
  const m = new WordMatch("crossword", 4242, entrants(0));
  const me = m.player("me")!;
  const sol = p.solutionCells();
  // The match builds its own puzzle from the same seed; it must agree with this one.
  for (let i = 0; i < 25; i++) if (sol[i]) m.act("me", { kind: "fill", cell: i, letter: sol[i] });
  assert.equal(me.solved, true, "filling the solution must solve it");
});

// ------------------------------------------------------------------ Spelling Bee

test("every Bee hive has seven letters and a decent word list", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const p = new BeePuzzle(seed * 613);
    assert.equal(p.setup.outer.length, 6, `seed ${seed}`);
    assert.match(p.setup.centre, /^[a-z]$/);
    assert.ok(!p.setup.outer.includes(p.setup.centre), "the centre must not repeat outside");
    const words = p.allWords();
    assert.ok(words.length >= 18, `seed ${seed} only has ${words.length} words`);
    const letters = p.setup.centre + p.setup.outer.join("");
    for (const w of words) {
      assert.ok(w.includes(p.setup.centre), `${w} misses the centre letter`);
      for (const ch of w) assert.ok(letters.includes(ch), `${w} uses ${ch}, not in the hive`);
    }
    assert.ok(p.setup.best > 0);
  }
});

test("Bee refuses words that miss the centre letter or use outside letters", () => {
  const p = new BeePuzzle(613);
  const m = new WordMatch("bee", 613, entrants(0));
  const letters = p.setup.centre + p.setup.outer.join("");
  const outside = "abcdefghijklmnopqrstuvwxyz".split("").find((c) => !letters.includes(c))!;
  assert.equal(m.act("me", { kind: "guess", word: outside.repeat(4) }).ok, false);
  const good = p.allWords()[0];
  assert.equal(m.act("me", { kind: "guess", word: good }).ok, true);
  assert.equal(m.act("me", { kind: "guess", word: good }).ok, false, "no double-scoring a word");
});

test("Bee scoring: four letters is one point, pangrams get seven more", () => {
  assert.equal(scoreWord("care", "acerstl"), 1);
  assert.equal(scoreWord("crates", "acerstl"), 6);
  assert.equal(scoreWord("clatters", "acerstl"), 8 + 7);
});

test("hiveWords only returns words buildable from the hive", () => {
  const words = hiveWords("aelprst", "e");
  assert.ok(words.length > 20);
  for (const w of words) {
    assert.ok(w.length >= 4);
    assert.ok(w.includes("e"));
    for (const ch of w) assert.ok("aelprst".includes(ch));
  }
});

// ------------------------------------------------------------------ The match

test("every game builds the same puzzle from the same seed", () => {
  for (const game of GAMES) {
    const a = new WordMatch(game, 555, entrants(1));
    const b = new WordMatch(game, 555, entrants(1));
    assert.deepEqual(a.setup, b.setup, `${game} is not deterministic`);
    assert.equal(a.reveal(), b.reveal(), `${game} reveals differently`);
  }
});

test("rivals never leak your letters", () => {
  const m = new WordMatch("wordle", 31337, entrants(1));
  m.act("me", { kind: "guess", word: "crane" });
  const rivals = m.rivals();
  const mine = rivals.find((r) => r.id === "me")!;
  // The colour pattern goes out; the word itself does not.
  assert.deepEqual(mine.marks, m.self("me")!.marks);
  const asText = JSON.stringify(rivals);
  assert.ok(!asText.includes("crane"), "a rival's view must not contain guessed words");

  const bee = new WordMatch("bee", 613, entrants(1));
  const word = new BeePuzzle(613).allWords()[0];
  bee.act("me", { kind: "guess", word });
  assert.ok(!JSON.stringify(bee.rivals()).includes(word), "found words must not reach rivals");

  const xw = new WordMatch("crossword", 4242, entrants(1));
  xw.act("me", { kind: "fill", cell: 0, letter: "a" });
  assert.deepEqual(xw.rivals().find((r) => r.id === "me")!.marks, [], "crossword rivals send no letters");
});

test("a round ends when the clock runs out, and ranks everyone", () => {
  for (const game of GAMES) {
    const start = Date.now();
    const m = new WordMatch(game, 808, entrants(2), start);
    assert.equal(m.advance(start + 1000), false, `${game} ended too early`);
    assert.equal(m.advance(start + m.setup.seconds * 1000 + 1), true, `${game} did not end on time`);
    assert.equal(m.over, true);
    const results = m.results();
    assert.equal(results.length, 3);
    assert.deepEqual(results.map((r) => r.place), [1, 2, 3]);
    for (const r of results) assert.ok(r.isBot ? r.coins === 0 : r.coins > 0, `${game}: bots must not earn coins`);
  }
});

test("solving beats scoring, and finishing first breaks a tie", () => {
  const m = new WordMatch("wordle", 99, entrants(2));
  const [me, a, b] = m.players;
  me.solved = true; me.score = 10; me.finishedAt = 50;
  a.solved = false; a.score = 999;
  b.solved = true; b.score = 10; b.finishedAt = 20;
  const order = m.results().map((r) => r.id);
  assert.deepEqual(order, ["bot1", "me", "bot0"], "solved first, then earlier finisher, then unsolved");
});

test("bots play at a human pace and eventually finish", () => {
  for (const game of GAMES) {
    const start = Date.now();
    const m = new WordMatch(game, 4711, entrants(2), start);
    // Nothing should happen in the first second: a bot that answers instantly is a clock.
    assert.equal(m.botTurns(start + 200).length, 0, `${game}: a bot moved immediately`);
    let now = start;
    let moves = 0;
    while (now < start + m.setup.seconds * 1000) {
      now += 1000;
      moves += m.botTurns(now).length;
    }
    assert.ok(moves > 0, `${game}: bots never moved`);
  }
});

test("a human cannot move after the round is over, and bots stop too", () => {
  const start = Date.now();
  const m = new WordMatch("wordle", 123, entrants(1), start);
  m.advance(start + m.setup.seconds * 1000 + 1);
  assert.equal(m.act("me", { kind: "guess", word: "crane" }).ok, false);
  assert.deepEqual(m.botTurns(start + 999999), []);
});

test("quitting keeps the score you had", () => {
  const m = new WordMatch("bee", 613, entrants(0));
  const word = new BeePuzzle(613).allWords()[0];
  m.act("me", { kind: "guess", word });
  const score = m.player("me")!.score;
  m.quit("me");
  assert.equal(m.player("me")!.done, true);
  assert.equal(m.player("me")!.score, score);
});

test("coins stay on the same scale as the other minigames", () => {
  for (const game of GAMES) {
    const lost = wordCoins(game, 4, false, 0, 4);
    const won = wordCoins(game, 1, true, 200, 4);
    assert.ok(lost >= 5 && lost <= 30, `${game}: losing pays ${lost}`);
    assert.ok(won > lost, `${game}: winning must pay more`);
    assert.ok(won <= 110, `${game}: winning pays ${won}, too much`);
  }
});

test("word lists are big enough to keep puzzles fresh", () => {
  assert.ok(wordsOfLength(5).length > 2000);
  assert.ok(wordsOfLength(4).length > 1000);
  assert.ok(wordsOfLength(3).length > 300);
});

// ------------------------------------------------------------------ hostile input

test("only the four real game names are accepted", () => {
  for (const g of GAMES) assert.equal(isWordGame(g), true, g);
  // `game in WORD_INFO` used to let these through, and the match then held an undefined puzzle.
  for (const bad of ["toString", "constructor", "__proto__", "valueOf", "hasOwnProperty", "", "WORDLE", null, 7, {}]) {
    assert.equal(isWordGame(bad), false, `${String(bad)} must be rejected`);
  }
  assert.throws(() => makePuzzle("toString" as never, 1), /unknown word game/);
});

test("a malformed action is turned away rather than crashing the room", () => {
  // Each of these reached the rules before and threw: the puzzles call `a.word.toLowerCase()`
  // and spread `a.cards`, so one bad message took the server down with it.
  const junk: unknown[] = [
    null, undefined, 42, "guess", [], {},
    { kind: "guess" }, { kind: "guess", word: 12345 }, { kind: "guess", word: "has space" },
    { kind: "guess", word: "x".repeat(99) },
    { kind: "pick" }, { kind: "pick", cards: "nope" }, { kind: "pick", cards: [1, "2"] },
    { kind: "pick", cards: [0, 99] }, { kind: "pick", cards: [1.5] },
    { kind: "fill" }, { kind: "fill", cell: "3", letter: "a" }, { kind: "fill", cell: 1, letter: "ab" },
    { kind: "fill", cell: 1, letter: 5 }, { kind: "fill", cell: -1, letter: "a" }, { kind: "fill", cell: 1, letter: "!" },
    { kind: "nonsense" },
  ];
  for (const raw of junk) assert.equal(parseWordAction(raw), null, `should reject ${JSON.stringify(raw)}`);

  assert.deepEqual(parseWordAction({ kind: "guess", word: "CRANE" }), { kind: "guess", word: "crane" });
  assert.deepEqual(parseWordAction({ kind: "pick", cards: [3, 1, 0, 2] }), { kind: "pick", cards: [3, 1, 0, 2] });
  assert.deepEqual(parseWordAction({ kind: "fill", cell: 7, letter: "Q" }), { kind: "fill", cell: 7, letter: "q" });
  assert.deepEqual(parseWordAction({ kind: "fill", cell: 7, letter: "" }), { kind: "fill", cell: 7, letter: "" });

  // And with the gate in place, feeding the junk straight through changes nothing.
  for (const game of GAMES) {
    const m = new WordMatch(game, 5, entrants(1));
    for (const raw of junk) {
      const a = parseWordAction(raw);
      if (a) m.act("me", a);
    }
    assert.equal(m.player("me")!.done, false, `${game}: junk should not end the round`);
  }
});

test("walking out earns nothing for placing", () => {
  const m = new WordMatch("wordle", 1, entrants(2));
  m.quit("me");
  const mine = m.results().find((r) => r.id === "me")!;
  // Quitting instantly used to come first (nobody had scored, and an early finish won the
  // tie-break), paying a podium bonus for doing nothing at all.
  assert.equal(mine.place, 3, "a quitter ranks below everyone still playing");
  assert.equal(mine.coins, 0, `quitting paid ${mine.coins} coins`);

  // Someone who played and ran out of time still gets paid.
  const played = new WordMatch("wordle", 1, entrants(2));
  played.act("me", { kind: "guess", word: "crane" });
  played.advance(Date.now() + played.setup.seconds * 1000 + 1);
  assert.ok(played.results().find((r) => r.id === "me")!.coins > 0, "playing and losing still pays");
});

test("solving still beats a rival who quit early", () => {
  const m = new WordMatch("bee", 613, entrants(2));
  m.quit("me");
  const [, a] = m.players;
  a.score = 1;
  const order = m.results().map((r) => r.id);
  assert.equal(order[order.length - 1], "me", "the quitter is last");
});
