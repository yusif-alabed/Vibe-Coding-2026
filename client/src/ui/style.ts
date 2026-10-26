/**
 * UI styles: a hand-made trail-lodge look. Menus are parchment notes pinned over the world,
 * signs and the HUD are snowy wooden planks, and the big buttons are strokes of paint.
 * Everything is drawn in ink brown with handwritten lettering.
 */

// Paper fibre: faint brown noise, tiled.
const PAPER = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .36 0 0 0 0 .24 0 0 0 0 .12 0 0 0 .11 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
// Wood grain: noise stretched along the plank.
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='120'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.006 .22' numOctaves='3' seed='4' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .16 0 0 0 0 .08 0 0 0 0 .03 0 0 0 .55 -.12'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`;
// A stroke of paint with ragged bristle ends.
const BRUSH = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 50' preserveAspectRatio='none'%3E%3Cpath d='M7 12C34 5 78 3 118 4.5S178 2 195 7l-3 5 6 4-5 5 6 5-6 4 5 6-4 5C170 45 112 47 62 45.5S16 48 5 42l4-5-7-4 6-5-6-4 6-5-5-4z'/%3E%3C/svg%3E")`;
// Snow lying on top of a sign.
const SNOW = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 22' preserveAspectRatio='none'%3E%3Cpath fill='%23dfe9f2' d='M0 16C8 8 18 12 28 9s20-5 32 0 22-6 36-2 24-4 38 0 22-5 34-1 20-2 32 4v18H0z'/%3E%3Cpath fill='%23fbfdff' d='M0 13C9 4 19 9 29 6s21-6 32-1 22-6 36-2 24-4 38 0 22-5 34-1 20-2 31 4v8c-60 4-140 4-200 0z'/%3E%3C/svg%3E")`;

export const CSS = `
:root {
  --ink: #3d2516; --ink-soft: #6b4a33; --muted: #7d6450;
  --paper: #f5ead2; --paper-2: #ecdcba; --paper-3: #e1cca2; --paper-hi: #fbf4e3;
  --cream: var(--paper); --cream-2: var(--paper-2);
  --wood: #7b4a28; --wood-dk: #4b2b16; --wood-lt: #a2693b;
  --orange: #c95a2c; --teal: #2b8580; --teal-dk: #1e6a65; --red: #b4412f; --gold: #d9a23a; --gold-hi: #f4d27a;
  --sky: #4f8fc4; --pine: #3f6b4a; --lake: #3b9ea0; --shadow: rgba(40,22,10,.28);
  --wob: 16px 12px 18px 11px / 11px 18px 12px 16px;
  --wob-pill: 999px 900px 999px 950px / 950px 999px 900px 999px;
  --font-display: "Kalam", "Patrick Hand", "Comic Sans MS", cursive;
  --font-body: "Patrick Hand", "Kalam", "Comic Sans MS", ui-rounded, system-ui, sans-serif;
  --paper-tex: ${PAPER};
  --grain: ${GRAIN};
}
* { box-sizing: border-box; scrollbar-width: thin; scrollbar-color: #a88560 transparent; }
:root { color-scheme: light; }
button, input { color: var(--ink); font-family: var(--font-body); }
html, body { margin: 0; height: 100%; overflow: hidden; background: #c9b48e; font-family: var(--font-body); font-size: 16px; color: var(--ink); -webkit-tap-highlight-color: transparent; }
#game { position: fixed; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
#ui { position: fixed; inset: 0; pointer-events: none; }
#ui .pe { pointer-events: auto; }
b, strong { font-family: var(--font-display); font-weight: 700; }
h2, h3 { font-family: var(--font-display); font-weight: 700; }
.ic { display: inline-grid; place-items: center; width: 1.15em; height: 1.15em; flex: none; vertical-align: -.18em; }
.ic svg { width: 100%; height: 100%; display: block; }

/* ---- Parchment ---- */
.card { position: relative; color: var(--ink);
  background: var(--paper-tex), radial-gradient(ellipse at 50% 40%, var(--paper-hi) 0%, var(--paper) 55%, var(--paper-2) 100%);
  border: 2.5px solid var(--ink); border-radius: var(--wob);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.45), inset 0 0 22px rgba(150,100,45,.18), 0 2px 0 rgba(61,37,22,.4), 0 12px 26px var(--shadow); }
/* Big panels sit on a second sheet with a strip of tape, like notes pinned to a board. */
.card.panel, .card.results, .card.help, .card.quests, .card.photo-result { isolation: isolate; }
.card.panel::before, .card.results::before, .card.help::before, .card.quests::before, .card.photo-result::before {
  content: ""; position: absolute; inset: 0; z-index: -1; border: 2.5px solid var(--ink); border-radius: var(--wob);
  background: var(--paper-tex), var(--paper-3); transform: rotate(-1.8deg) translate(-5px, 6px); box-shadow: 0 8px 20px var(--shadow); pointer-events: none; }
.card.panel::after, .card.results::after, .card.help::after, .card.photo-result::after {
  content: ""; position: absolute; left: 50%; top: -12px; width: 92px; height: 24px; transform: translateX(-50%) rotate(-3deg);
  background: linear-gradient(90deg, rgba(231,214,170,.86), rgba(240,226,190,.9)); border-left: 2px dashed rgba(120,90,50,.25); border-right: 2px dashed rgba(120,90,50,.25);
  box-shadow: 0 1px 3px rgba(0,0,0,.18); pointer-events: none; }

/* ---- Buttons: paint strokes, paper pills and round wooden-rimmed badges ---- */
.btn { --b: var(--teal); --fg: #fff6e4; position: relative; isolation: isolate;
  font-family: var(--font-display); font-weight: 700; font-size: 19px; line-height: 1.15; color: var(--fg);
  background: none; border: 0; padding: 11px 26px 10px; cursor: pointer; white-space: nowrap;
  display: inline-flex; align-items: center; justify-content: center; gap: 9px;
  text-shadow: 0 1px 0 rgba(0,0,0,.22); transition: transform .08s, filter .15s; }
.btn::before { content: ""; position: absolute; inset: 0; z-index: -1;
  background: repeating-linear-gradient(177deg, rgba(255,255,255,.09) 0 2px, transparent 2px 6px), repeating-linear-gradient(183deg, rgba(0,0,0,.07) 0 1px, transparent 1px 9px), var(--b);
  -webkit-mask: ${BRUSH} center / 100% 100% no-repeat; mask: ${BRUSH} center / 100% 100% no-repeat; }
.btn:hover { filter: brightness(1.07) saturate(1.05); transform: rotate(-.6deg) scale(1.02); }
.btn:active { transform: translateY(2px) scale(.98); filter: brightness(.95); }
.btn:disabled { --b: #b3a28a; cursor: default; transform: none; filter: none; }
.btn .ic { width: 1.25em; height: 1.25em; }
.btn.orange { --b: var(--orange); } .btn.red { --b: var(--red); }
.btn.gold { --b: var(--gold); --fg: var(--ink); text-shadow: 0 1px 0 rgba(255,255,255,.35); }
.btn.small { font-size: 16px; padding: 6px 15px 5px; gap: 6px; }
/* Paper pill with an ink outline (secondary actions) */
.btn.cream { --fg: var(--ink); text-shadow: none; font-size: 17px; padding: 8px 16px;
  background: var(--paper-tex), var(--paper-hi); border: 2.5px solid var(--ink); border-radius: var(--wob-pill);
  box-shadow: inset 0 -2px 0 rgba(150,100,45,.18), 0 2px 0 rgba(61,37,22,.35); }
.btn.cream.small { font-size: 15px; padding: 4px 11px; }
.btn.cream::before, .btn.dark::before, .btn.icon::before { display: none; }
.btn.cream:hover { background: var(--paper-tex), #fffaf0; }
/* Dark wooden pill (e.g. Join) */
.btn.dark { --fg: var(--paper-hi); background: var(--grain), linear-gradient(180deg, #6a3e20, #4a2914); border: 2.5px solid var(--ink); border-radius: var(--wob-pill); padding: 7px 18px; box-shadow: inset 0 1px 0 rgba(255,220,170,.25), 0 2px 0 rgba(61,37,22,.4); }
/* Round badges: the HUD buttons */
.btn.icon { --b: var(--paper-hi); width: 50px; height: 50px; padding: 0; font-size: 24px; border-radius: 50%; display: grid; place-items: center; text-shadow: none;
  background: radial-gradient(circle at 36% 30%, rgba(255,255,255,.55), transparent 55%), var(--paper-tex), var(--b);
  border: 3px solid var(--ink); box-shadow: inset 0 0 0 3px rgba(255,250,236,.7), inset 0 0 0 4.5px rgba(61,37,22,.28), inset 0 -4px 6px rgba(120,75,30,.22), 0 3px 0 var(--ink), 0 6px 12px rgba(30,15,5,.3); }
.btn.icon:active { transform: translateY(2px); box-shadow: inset 0 0 0 3px rgba(255,250,236,.7), inset 0 0 0 4.5px rgba(61,37,22,.28), 0 1px 0 var(--ink); }
.btn.icon .ic { width: 26px; height: 26px; color: var(--ink); }
.dock .btn.icon .ic, .hud-bottom .btn.icon .ic { width: 24px; height: 24px; }
.btn.icon.q { font-size: 28px; color: var(--ink); }
.btn.cream.icon { --b: var(--paper-hi); }
.btn.orange.icon { --b: #e38a54; } .btn.gold.icon { --b: var(--gold-hi); } .btn.red.icon { --b: #d9715c; }

input.field { font: 400 19px var(--font-body); color: var(--ink); width: 100%; outline: none; padding: 8px 14px;
  background: var(--paper-tex), #fbf5e6; border: 2px solid var(--ink-soft); border-radius: 12px 9px 13px 10px / 10px 13px 9px 12px;
  box-shadow: inset 0 2px 4px rgba(120,80,40,.16); }
input.field::placeholder { color: #a08870; }
input.field:focus { border-color: var(--ink); box-shadow: inset 0 2px 4px rgba(120,80,40,.16), 0 0 0 3px rgba(43,133,128,.25); }
input.field.code::placeholder, input.field.code { letter-spacing: 3px; text-transform: uppercase; }

/* ---- Title screen: a trail sign ---- */
.title { position: absolute; inset: 0; display: grid; place-items: center; padding: 30px 16px; overflow: auto;
  background: radial-gradient(ellipse at 50% 35%, transparent 30%, rgba(30,18,8,.38) 100%), linear-gradient(180deg, rgba(255,214,160,.10), rgba(30,22,14,.25)); }
.title > .card { width: min(420px, 100%); padding: 22px; text-align: center; }
.signpost { position: relative; width: min(440px, 100%); display: grid; justify-items: center; padding-bottom: 34px; isolation: isolate; }
.signpost::before, .signpost::after { content: ""; position: absolute; top: 100px; bottom: 0; width: 26px; z-index: -1;
  background: var(--grain), linear-gradient(90deg, #4a2914, #7b4a28 40%, #5a341a); border: 2.5px solid var(--ink); border-radius: 5px 5px 3px 3px; box-shadow: 0 6px 14px rgba(0,0,0,.35); }
.signpost::before { left: 16%; } .signpost::after { right: 16%; }
.sign-head { position: relative; width: 100%; margin-top: 34px; padding: 14px 22px 14px; text-align: center; z-index: 2; transform: rotate(-1deg);
  background: radial-gradient(circle at 16px 50%, #2c180b 0 3px, transparent 3.5px), radial-gradient(circle at calc(100% - 16px) 50%, #2c180b 0 3px, transparent 3.5px),
    var(--paper-tex), var(--grain), linear-gradient(180deg, #f6e9cc, #e9d4a8);
  background-size: auto, auto, auto, 100% 300%, auto;
  border: 3px solid var(--ink); border-radius: 22px 30px 18px 34px / 26px 18px 30px 20px;
  box-shadow: 0 0 0 5px #8a5530, 0 0 0 8px var(--ink), 0 14px 28px rgba(0,0,0,.4); }
.logo-mtn { position: absolute; left: 50%; top: -44px; width: 190px; transform: translateX(-50%); color: var(--ink); filter: drop-shadow(0 2px 0 rgba(255,245,225,.8)); }
.logo-mtn svg { width: 100%; display: block; }
.logo { font-family: var(--font-display); font-weight: 700; font-size: clamp(42px, 11vw, 64px); line-height: 1; margin: 0; letter-spacing: .5px;
  color: var(--ink); -webkit-text-stroke: 1.6px var(--ink); text-shadow: 0 2px 0 rgba(255,250,235,.8), 0 3px 0 rgba(61,37,22,.18); }
.logo span { color: inherit; }
.tagline { font: 400 17px/1.25 var(--font-body); color: var(--ink-soft); margin: 4px auto 0; max-width: 320px; text-wrap: balance; }
.sign-body { position: relative; width: calc(100% - 26px); margin-top: 18px; padding: 9px; z-index: 1;
  background: var(--grain), linear-gradient(180deg, #8a5530, #6b3e1f); border: 3px solid var(--ink); border-radius: 14px 10px 16px 9px / 10px 16px 9px 14px;
  box-shadow: inset 0 0 0 2px rgba(255,210,150,.18), 0 16px 30px rgba(0,0,0,.42); }
.sign-body > .card { padding: 14px 18px 14px; text-align: left; border-radius: 8px 11px 7px 12px / 11px 7px 12px 8px; box-shadow: inset 0 0 22px rgba(150,100,45,.2); }
.label { font-family: var(--font-display); font-weight: 700; text-align: left; margin: 10px 0 5px; font-size: 17px; display: flex; align-items: center; gap: 7px; }
.label:first-child { margin-top: 0; }
.label .ic { color: var(--ink-soft); }
.swatches { display: flex; gap: 9px; flex-wrap: wrap; padding: 3px; }
.swatch { width: 36px; height: 36px; border-radius: 50%; border: 2.5px solid var(--ink); cursor: pointer;
  box-shadow: inset 0 -4px 6px rgba(0,0,0,.18), inset 0 3px 4px rgba(255,255,255,.25); transition: transform .12s; }
.swatch:hover { transform: translateY(-2px) rotate(-4deg); }
.swatch.on { box-shadow: inset 0 -4px 6px rgba(0,0,0,.18), 0 0 0 3px var(--paper), 0 0 0 5.5px var(--ink); }
.row { display: flex; gap: 8px; align-items: center; }
.stack { display: grid; gap: 10px; margin-top: 16px; justify-items: stretch; }
.stack > .btn:not(.cream):not(.dark) { font-size: 22px; padding: 13px 26px 12px; }
.hint { font-size: 15px; color: var(--muted); margin-top: 12px; line-height: 1.3; }
.hint b { color: var(--ink); }
details summary { cursor: pointer; list-style: none; }
details summary::-webkit-details-marker { display: none; }
details summary::before { content: "›"; display: inline-block; margin-right: 6px; font-weight: 700; transition: transform .15s; }
details[open] summary::before { transform: rotate(90deg); }
.loading-card { padding: 16px 28px; font: 700 22px var(--font-display); }

/* ---- HUD ---- */
.hud-top { position: absolute; top: calc(12px + env(safe-area-inset-top, 0px)); left: calc(12px + env(safe-area-inset-left, 0px)); right: calc(12px + env(safe-area-inset-right, 0px)); display: flex; justify-content: space-between; gap: 8px; align-items: flex-start; }
.pill { font-family: var(--font-display); font-weight: 700; font-size: 16px; color: var(--ink); white-space: nowrap; display: inline-flex; gap: 7px; align-items: center;
  padding: 5px 14px 4px; background: var(--paper-tex), var(--paper-hi); border: 2.5px solid var(--ink); border-radius: var(--wob-pill);
  box-shadow: inset 0 -2px 0 rgba(150,100,45,.2), 0 2px 0 rgba(61,37,22,.35), 0 5px 12px var(--shadow); }
.pill.coins { font-size: 21px; padding: 4px 18px 3px 5px; gap: 10px; min-width: 110px; }
.coin { width: 34px; height: 34px; border-radius: 50%; flex: none; display: grid; place-items: center; color: #7a5212;
  background: radial-gradient(circle at 35% 30%, #fff1b8 0 12%, #f3c654 35%, #d29a2a 75%, #a8721a 100%);
  border: 2px solid #6d4610; box-shadow: inset 0 0 0 2.5px rgba(255,236,170,.55), inset 0 -3px 4px rgba(120,70,10,.3); }
.coin svg { width: 72%; height: 72%; }
/* Wooden plank with snow on it: holds coins and the round buttons */
.plank { position: relative; display: flex; gap: 10px; align-items: center; padding: 9px 12px;
  background: radial-gradient(circle at 9px 50%, #2c180b 0 2.5px, transparent 3px), radial-gradient(circle at calc(100% - 9px) 50%, #2c180b 0 2.5px, transparent 3px),
    var(--grain), linear-gradient(180deg, #8f5a33 0%, #74451f 55%, #5e3618 100%);
  background-size: auto, auto, 100% 300%, auto;
  border: 3px solid var(--ink); border-radius: 12px 8px 14px 7px / 8px 14px 7px 12px;
  box-shadow: inset 0 2px 0 rgba(255,210,150,.28), inset 0 -3px 0 rgba(0,0,0,.2), 0 8px 18px rgba(20,10,4,.4); }
.plank::before { content: ""; position: absolute; left: 4px; right: 4px; top: -9px; height: 14px; background: ${SNOW} center / 100% 100% no-repeat; pointer-events: none; filter: drop-shadow(0 1px 0 rgba(61,37,22,.35)); }
.hud-bottom { position: absolute; left: calc(12px + env(safe-area-inset-left, 0px)); right: calc(12px + env(safe-area-inset-right, 0px)); bottom: calc(12px + env(safe-area-inset-bottom, 0px)); display: flex; gap: 8px; align-items: center; }
.chatbar { flex: 1; display: flex; gap: 6px; max-width: 560px; align-items: center; }
.chatbar .btn:not(.cream) { padding: 9px 20px 8px; }
.chatlog { position: absolute; left: 12px; bottom: 76px; width: min(420px, calc(100% - 24px)); display: flex; flex-direction: column; gap: 4px; }
.chatline { background: var(--paper-tex), rgba(248,238,214,.95); border: 2px solid var(--ink); border-radius: 12px 9px 13px 8px / 9px 13px 8px 12px; padding: 3px 11px; font-size: 16px; width: fit-content; max-width: 100%; animation: pop .18s ease-out; box-shadow: 0 2px 0 rgba(61,37,22,.25); }
.chatline b { font-family: var(--font-display); }
.chatline.sys { background: var(--paper-tex), #dcebe0; }
.action { position: absolute; left: 50%; bottom: 84px; transform: translateX(-50%); }
.action .btn { font-size: 21px; }
.menu { position: absolute; bottom: 74px; right: 12px; padding: 10px; display: grid; gap: 6px; max-width: min(320px, calc(100vw - 24px)); }
.emotes { grid-template-columns: repeat(4, 1fr); }
.emotes button { font-size: 26px; background: var(--paper-hi); border: 2px solid var(--ink); border-radius: 50%; aspect-ratio: 1; padding: 4px; cursor: pointer; box-shadow: 0 2px 0 rgba(61,37,22,.35); }
.quick button { text-align: left; font: 400 17px var(--font-body); color: var(--ink); background: transparent; border: 0; border-bottom: 2px dashed rgba(61,37,22,.25); border-radius: 0; padding: 7px 8px; cursor: pointer; }
.quick button:last-child { border-bottom: 0; }
.quick button:hover, .emotes button:hover { background: rgba(217,162,58,.22); }

/* ---- World labels ---- */
.tag { position: absolute; transform: translate(-50%, -100%); font-family: var(--font-display); font-weight: 700; font-size: 16px; color: var(--paper-hi);
  -webkit-text-stroke: 3.5px var(--ink); paint-order: stroke fill; white-space: nowrap; pointer-events: none; }
.tag.me { color: var(--gold-hi); }
.place { position: absolute; transform: translate(-50%, -100%); color: #fbecd0; padding: 3px 12px 2px; font: 700 14px var(--font-display); white-space: nowrap; pointer-events: none;
  background: var(--grain), linear-gradient(180deg, #8a5530, #67391b); background-size: 100% 300%, auto; border: 2px solid var(--ink); border-radius: 6px 9px 5px 8px; box-shadow: 0 3px 0 rgba(61,37,22,.5); text-shadow: 0 1px 0 rgba(0,0,0,.4); }
.bubble { position: absolute; transform: translate(-50%, -100%); background: var(--paper-tex), var(--paper-hi); border: 2.5px solid var(--ink); border-radius: 16px 12px 17px 11px / 12px 17px 11px 16px; padding: 4px 11px; font-size: 16px; max-width: 230px; text-align: center; box-shadow: 0 3px 0 rgba(61,37,22,.4); pointer-events: none; animation: pop .18s ease-out; }
.bubble::after { content: ""; position: absolute; left: 50%; bottom: -9px; width: 12px; height: 12px; background: var(--paper-hi); border-right: 2.5px solid var(--ink); border-bottom: 2.5px solid var(--ink); transform: translateX(-50%) rotate(45deg); }
.emote { position: absolute; transform: translate(-50%, -100%); font-size: 34px; pointer-events: none; animation: float 1.6s ease-out forwards; }

/* ---- Panels ---- */
.overlay { position: absolute; inset: 0; display: grid; grid-template: minmax(0, 1fr) / minmax(0, 1fr); place-items: center; padding: 18px; background: radial-gradient(ellipse at center, rgba(40,24,12,.25), rgba(30,16,6,.55)); }
.panel { width: min(560px, 100%); max-height: min(640px, 100%); display: flex; flex-direction: column; }
.panel header { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 14px 16px 8px; margin: 0 12px; border-bottom: 2px solid rgba(61,37,22,.22); }
.panel h2 { font-family: var(--font-display); margin: 0; font-size: 28px; line-height: 1.1; }
.tabs { display: flex; gap: 6px; padding: 10px 16px 10px; flex-wrap: wrap; }
.tab { font: 700 15px var(--font-display); color: var(--ink); background: var(--paper-tex), var(--paper-hi); border: 2px solid var(--ink); border-radius: var(--wob-pill); padding: 3px 12px 2px; cursor: pointer; box-shadow: 0 2px 0 rgba(61,37,22,.3); }
.tab:hover { background: var(--paper-tex), #fffaf0; }
.tab.on { background: var(--grain), linear-gradient(180deg, #6a3e20, #4a2914); background-size: 100% 300%, auto; color: var(--paper-hi); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; padding: 4px 16px 18px; overflow: auto; min-height: 0; }
.item { background: var(--paper-tex), rgba(255,250,238,.75); border: 2px solid var(--ink); border-radius: 14px 10px 15px 9px / 10px 15px 9px 14px; padding: 10px; display: grid; gap: 6px; justify-items: center; text-align: center; box-shadow: 0 2px 0 rgba(61,37,22,.22); }
.item .ico { width: 58px; height: 58px; border-radius: 50%; border: 2.5px solid var(--ink); display: grid; place-items: center; font-size: 28px; box-shadow: inset 0 -4px 6px rgba(0,0,0,.1); }
.item .nm { font: 700 16px var(--font-display); line-height: 1.1; }
.price { font-size: 15px; color: var(--ink-soft); }

/* ---- Races & minigames ---- */
.countdown { position: absolute; inset: 0; display: grid; place-items: center; font-family: var(--font-display); font-weight: 700; font-size: min(28vw, 180px); color: var(--paper-hi); -webkit-text-stroke: 7px var(--ink); paint-order: stroke fill; text-shadow: 0 8px 0 var(--ink); pointer-events: none; }
.countdown.pop { animation: big .5s ease-out; }
.place-big { font-family: var(--font-display); font-weight: 700; font-size: 46px; color: var(--paper-hi); -webkit-text-stroke: 4px var(--ink); paint-order: stroke fill; line-height: 1; }
.progress { position: absolute; left: 50%; top: 14px; transform: translateX(-50%); width: min(420px, 60vw); height: 24px; }
.progress .track { position: absolute; inset: 0; background: var(--grain), linear-gradient(180deg, #8f5a33, #5e3618); background-size: 100% 300%, auto; border: 3px solid var(--ink); border-radius: 12px 8px 13px 7px / 8px 13px 7px 12px; box-shadow: 0 3px 0 rgba(61,37,22,.45); }
.progress .dot { position: absolute; top: 50%; width: 16px; height: 16px; border-radius: 50%; border: 2.5px solid var(--ink); transform: translate(-50%, -50%); background: var(--paper-2); transition: left .1s linear; }
.progress .dot.me { background: var(--gold-hi); width: 21px; height: 21px; z-index: 2; }
.progress .flag { position: absolute; right: -6px; top: -12px; font-size: 22px; }
.flash { position: absolute; left: 50%; top: 28%; transform: translateX(-50%); font-family: var(--font-display); font-weight: 700; font-size: 46px; color: var(--gold-hi); -webkit-text-stroke: 4px var(--ink); paint-order: stroke fill; pointer-events: none; animation: big .4s ease-out; }
.touchpads { position: absolute; inset: auto 0 0 0; height: 40%; display: none; }
@media (pointer: coarse) { .touchpads { display: flex; } }
.touchpads div { flex: 1; display: grid; place-items: end center; padding-bottom: 24px; font-size: 44px; opacity: .55; }
.results { padding: 20px 20px 18px; width: min(460px, 100%); text-align: center; }
.results h2 { font-family: var(--font-display); font-size: 34px; margin: 0 0 10px; }
.res { display: grid; grid-template-columns: 44px 1fr auto auto; gap: 8px; align-items: center; padding: 6px 10px; border-bottom: 2px dashed rgba(61,37,22,.28); text-align: left; font-size: 17px; }
.res:last-of-type { border-bottom: 0; }
.res.me { background: rgba(217,162,58,.25); border-radius: 10px; }
.res .pl { font-family: var(--font-display); font-weight: 700; font-size: 24px; }
.speedlines { position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity .2s; background: radial-gradient(ellipse at center, transparent 55%, rgba(255,255,255,.55) 100%); }
.speedlines.on { opacity: 1; }
.toast { position: absolute; left: 50%; top: 74px; transform: translateX(-50%); padding: 7px 16px; font-size: 17px; animation: pop .2s ease-out; z-index: 5; max-width: calc(100% - 24px); text-align: center; }
.playercard { position: absolute; padding: 12px 14px; display: grid; gap: 8px; transform: translate(-50%, -110%); min-width: 200px; }
.playercard h3 { margin: 0; font-family: var(--font-display); font-size: 22px; text-align: center; }
.help { padding: 20px 22px; width: min(480px, 100%); line-height: 1.4; font-size: 16px; max-height: 100%; overflow: auto; }
.help h2 { font-family: var(--font-display); margin: 0 0 8px; font-size: 30px; }
.help kbd, kbd { font: 700 14px var(--font-display); background: var(--paper-hi); border: 2px solid var(--ink); border-radius: 6px 8px 5px 7px; padding: 0 7px; box-shadow: 0 2px 0 var(--ink); }

/* ---- Server browser ---- */
.srvlist { display: grid; gap: 10px; }
.srv { border: 2.5px solid var(--ink); border-radius: var(--wob); background: var(--paper-hi); padding: 10px 12px 11px; box-shadow: 0 2px 0 rgba(61,37,22,.3), inset 0 0 14px rgba(150,100,45,.12); }
.srv-head { display: flex; align-items: center; gap: 9px; font: 700 21px/1.1 var(--font-display); }
.srv-head .srv-meta { margin-left: auto; }
.srv-meta { font: 400 15px/1.2 var(--font-body); color: var(--muted); }
.srv .srv-dot { width: 13px; height: 13px; flex: none; border-radius: 50%; border: 2px solid var(--ink); background: var(--paper-3); }
.srv.on .srv-dot { background: #62c06d; box-shadow: 0 0 0 3px rgba(98,192,109,.28); }
.srv.off .srv-dot { background: var(--red); }
.srv.wait .srv-dot { animation: srvpulse 1s ease-in-out infinite; }
@keyframes srvpulse { 50% { opacity: .3; } }
.srv-lobbies { display: grid; gap: 7px; margin-top: 10px; }
.srv-lobby { display: grid; grid-template-columns: 30px 1fr auto; align-items: center; gap: 10px; padding: 7px 9px; border-radius: 12px 10px 13px 9px / 9px 13px 10px 12px; background: rgba(61,37,22,.07); }
.srv-lobby > div { display: grid; line-height: 1.15; min-width: 0; }
.srv-lobby b { font: 700 18px var(--font-display); }
.srv-lobby .ic { width: 28px; height: 28px; color: var(--ink-soft); }
.srv-code { margin-top: 2px; }
.srv-code .field { min-width: 0; flex: 1; }
.invite-note { margin: 0 0 12px; padding: 10px 12px; border-radius: 12px; background: #fff3d6; border: 2px solid #c9a56b; text-align: center; font-size: 15px; line-height: 1.3; }
.restore { text-align: center; font-size: 15px; color: var(--muted); }
.restore summary { cursor: pointer; display: inline-block; text-decoration: underline; text-decoration-style: dotted; }
.restore[open] summary { margin-bottom: 2px; }
.srv a { color: var(--teal-dk); font-weight: 700; }

/* ---- Daily quests ---- */
.quests { position: absolute; top: calc(78px + env(safe-area-inset-top, 0px)); right: calc(14px + env(safe-area-inset-right, 0px)); width: min(300px, calc(100vw - 28px)); padding: 10px 14px 12px; cursor: pointer; }
.quests header { display: flex; justify-content: space-between; align-items: center; font: 700 21px var(--font-display); gap: 8px; }
.quests header > span:first-child { display: inline-flex; align-items: center; gap: 8px; }
.quests header .ic { width: 28px; height: 28px; }
.quests header .n { font-size: 16px; background: transparent; border: 2px solid var(--ink); border-radius: var(--wob-pill); padding: 0 12px; white-space: nowrap; }
@media (min-width: 640px) { .quests { right: calc(100px + env(safe-area-inset-right, 0px)); } }
.quests.closed .ql { display: none; }
.quests.closed { width: auto; padding: 6px 12px 7px; }
.quests.closed header { font-size: 18px; gap: 10px; }
.quests.closed header .ic { width: 24px; height: 24px; }
.quests.closed header .n { font-size: 15px; padding: 0 9px; }
.ql { margin-top: 4px; }
.quest { display: grid; grid-template-columns: 38px 1fr; gap: 3px 10px; align-items: center; padding: 8px 0 9px; font-size: 16px; line-height: 1.2; border-bottom: 2px solid rgba(61,37,22,.16); }
.quest .qi { font-size: 30px; grid-row: span 2; text-align: center; filter: drop-shadow(0 2px 1px rgba(61,37,22,.3)); }
.quest .bar { height: 11px; border: 2px solid var(--ink); border-radius: 8px 6px 9px 5px / 5px 9px 6px 8px; background: var(--paper-2); overflow: hidden; box-shadow: inset 0 2px 3px rgba(120,80,40,.25); }
.quest .bar i { display: block; height: 100%; background: repeating-linear-gradient(115deg, rgba(255,255,255,.18) 0 4px, transparent 4px 8px), var(--teal); transition: width .3s; }
.quest.done { color: var(--muted); } .quest.done .lbl { text-decoration: line-through; text-decoration-thickness: 2px; } .quest.done .bar i { background: var(--gold); }
.quests .bonus { margin-top: 9px; font-size: 15px; color: var(--ink-soft); text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px; line-height: 1.2; }
.quests .bonus .ic { width: 22px; height: 22px; color: var(--ink-soft); }
.quests .bonus.got { color: var(--pine); }
.quests .bonus.cones { border-top: 2px solid rgba(61,37,22,.22); padding-top: 8px; }
.quest-pop { position: absolute; left: 50%; top: 22%; transform: translateX(-50%); padding: 12px 22px; text-align: center; animation: big .35s ease-out; z-index: 5; font-size: 17px; }
.quest-pop b { display: block; font: 700 24px var(--font-display); }
.dock { position: absolute; right: calc(12px + env(safe-area-inset-right, 0px)); bottom: calc(80px + env(safe-area-inset-bottom, 0px)); display: grid; gap: 8px; }
.dock.plank { padding: 12px 8px 9px; }
.cone-pop { position: absolute; transform: translate(-50%, -100%); font: 700 22px var(--font-display); color: var(--gold-hi); -webkit-text-stroke: 3px var(--ink); paint-order: stroke fill; pointer-events: none; animation: float 1.4s ease-out forwards; }

/* ---- Photo mode ---- */
.photo-ui { position: absolute; inset: 0; pointer-events: none; }
.photo-top { position: absolute; top: calc(12px + env(safe-area-inset-top, 0px)); left: 12px; right: 12px; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.photo-tip { font: 400 16px var(--font-body); color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,.7); text-align: center; }
.photo-frame-guide { position: absolute; inset: 4.5% 4.5% 16% 4.5%; border: 2px dashed rgba(255,255,255,.75); border-radius: 6px; pointer-events: none; }
.photo-bar { position: absolute; left: 50%; bottom: calc(12px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); width: min(720px, calc(100% - 24px)); padding: 10px 12px; display: grid; gap: 7px; }
.photo-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.photo-row > b { font: 700 16px var(--font-display); width: 50px; }
.photo-row input.field { flex: 1; min-width: 140px; padding: 4px 10px; font-size: 17px; }
.photo-chips { display: flex; gap: 5px; flex-wrap: wrap; flex: 1; }
.photo-chips .tab { padding: 2px 10px; font-size: 14px; }
.photo-row.cam { justify-content: flex-end; }
.photo-bar.compact { width: auto; }
.photo-row.cam .shutter { margin-left: auto; font-size: 21px; padding: 10px 26px; }
.photo-flash { position: absolute; inset: 0; background: #fff; pointer-events: none; animation: flash .6s ease-out forwards; z-index: 7; }
@keyframes flash { from { opacity: .95; } to { opacity: 0; } }
.photo-result { padding: 16px; width: min(760px, 100%); max-height: 100%; overflow: auto; text-align: center; display: grid; gap: 10px; }
.photo-result h2 { font-family: var(--font-display); margin: 0; }
.photo-result img { width: 100%; max-height: 60vh; object-fit: contain; border-radius: 4px; border: 8px solid #fffdf6; box-shadow: 0 0 0 2px var(--ink), 0 6px 14px var(--shadow); transform: rotate(-.8deg); }

/* ---- Cabin ---- */
.cabin-banner { position: absolute; top: calc(12px + env(safe-area-inset-top, 0px)); left: 50%; transform: translateX(-50%); }
.inventory { position: absolute; left: 50%; bottom: calc(76px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); width: min(760px, calc(100% - 24px)); padding: 9px; display: flex; gap: 7px; overflow-x: auto; }
.inv { flex: 0 0 auto; width: 80px; background: var(--paper-tex), rgba(255,250,238,.8); border: 2px solid var(--ink); border-radius: 12px 9px 13px 8px / 9px 13px 8px 12px; padding: 4px; text-align: center; cursor: pointer; font: 700 13px/1.1 var(--font-display); position: relative; }
.inv .e { font-size: 24px; display: block; }
.inv .c { position: absolute; top: -8px; right: -8px; background: var(--gold-hi); border: 2px solid var(--ink); border-radius: 999px; font-size: 12px; min-width: 22px; padding: 0 5px; }
.inv.on { background: var(--paper-tex), #fbe7b5; outline: 3px solid var(--orange); outline-offset: 1px; }
.inv.empty { opacity: .45; }
.inv.shop { background: var(--paper-tex), var(--paper-2); }
.edit-tools { position: absolute; left: 50%; bottom: calc(160px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); display: flex; gap: 6px; }
.cabin-hint { position: absolute; left: 50%; top: calc(76px + env(safe-area-inset-top, 0px)); transform: translateX(-50%); font: 400 17px var(--font-body); color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,.8); text-align: center; width: calc(100% - 24px); pointer-events: none; }
@media (max-width: 560px) {
  .quests { top: calc(70px + env(safe-area-inset-top, 0px)); width: 212px; padding: 7px 10px 9px; }
  .quests header { font-size: 17px; white-space: nowrap; }
  .quests header .ic { width: 22px; height: 22px; }
  .quests header .n { font-size: 14px; padding: 0 8px; }
  .chatbar .btn:not(.cream) { padding: 7px 14px 6px; font-size: 16px; }
  .chatbar input.field { min-width: 0; font-size: 17px; }
  .chatlog { width: calc(100% - 96px); }
  .quest { grid-template-columns: 30px 1fr; font-size: 14px; }
  .quest .qi { font-size: 24px; }
  .photo-row > b { display: none; }
  .dock .btn.icon { width: 44px; height: 44px; font-size: 21px; }
}
/* ---- Lobbies: the game you're waiting for, and the ones other beavers are waiting for ---- */
.lobby { position: absolute; left: 50%; top: calc(74px + env(safe-area-inset-top, 0px)); transform: translateX(-50%); width: min(340px, calc(100vw - 24px)); display: grid; gap: 8px; pointer-events: none; z-index: 4; }
.lobby .card { padding: 9px 14px 10px; }
.lobby-title { display: flex; justify-content: space-between; align-items: center; gap: 6px; font: 700 19px var(--font-display); }
.lobby-title .n { font-size: 15px; border: 2px solid var(--ink); border-radius: var(--wob-pill); padding: 0 10px; }
.lobby-names { font-size: 16px; margin: 2px 0; }
.lobby-status { font-size: 15px; color: var(--muted); margin-bottom: 6px; }
.lobby-head { font: 700 17px var(--font-display); margin-bottom: 4px; }
.lobby-row { display: flex; align-items: center; gap: 8px; font-size: 15px; padding: 4px 0; }
.lobby-row + .lobby-row { border-top: 2px dashed rgba(61,37,22,.22); }
@media (max-width: 760px) { .lobby { top: auto; bottom: calc(150px + env(safe-area-inset-bottom, 0px)); } }
.has-joy .lobby { bottom: calc(230px + env(safe-area-inset-bottom, 0px)); }
@media (min-width: 761px) { .has-joy .lobby { bottom: auto; } }
/* ---- Invites, settings, friends, joystick ---- */
.invite { position: absolute; left: 50%; top: calc(74px + env(safe-area-inset-top, 0px)); transform: translateX(-50%); padding: 12px 18px; text-align: center; z-index: 8; animation: pop .2s ease-out; max-width: calc(100% - 24px); font-size: 17px; }
.settings { width: min(540px, 100%); }
.settings-body { padding: 6px 18px 18px; overflow: auto; display: grid; gap: 8px; min-height: 0; }
.settings-body h3 { font: 700 19px var(--font-display); margin: 10px 0 0; }
.setting { display: grid; grid-template-columns: 140px 1fr; align-items: center; gap: 10px; font-size: 16px; }
.setting input[type=range] { width: 100%; -webkit-appearance: none; appearance: none; height: 24px; background: transparent; cursor: pointer; }
.setting input[type=range]::-webkit-slider-runnable-track { height: 10px; border: 2px solid var(--ink); border-radius: 8px 6px 9px 5px; background: var(--paper-2); box-shadow: inset 0 2px 3px rgba(120,80,40,.25); }
.setting input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; margin-top: -8px; border-radius: 50%; background: var(--orange); border: 2.5px solid var(--ink); box-shadow: inset 0 -3px 0 rgba(0,0,0,.18), 0 2px 0 var(--ink); }
.setting input[type=range]::-moz-range-track { height: 7px; border: 2px solid var(--ink); border-radius: 8px; background: var(--paper-2); }
.setting input[type=range]::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: var(--orange); border: 2.5px solid var(--ink); }
.codebox { display: flex; justify-content: space-between; align-items: center; gap: 10px; background: var(--paper-tex), rgba(255,250,238,.75); border: 2px dashed var(--ink-soft); border-radius: 12px; padding: 8px 10px; margin-top: 6px; }
.codebox code { font: 700 17px var(--font-display); letter-spacing: 2px; }
.friend { display: flex; align-items: center; gap: 8px; background: var(--paper-tex), rgba(255,250,238,.7); border: 2px solid var(--ink); border-radius: 12px 9px 13px 8px / 9px 13px 8px 12px; padding: 6px 9px; margin-top: 6px; font-size: 16px; }
.dot { width: 12px; height: 12px; border-radius: 50%; background: #b3a28a; border: 2px solid var(--ink); flex: 0 0 auto; }
.dot.on { background: #6cbf5a; }
.badge-host { position: relative; }
.badge-host[data-badge]:not([data-badge=""])::after { content: attr(data-badge); position: absolute; top: -6px; right: -6px; background: #6cbf5a; color: var(--ink); border: 2px solid var(--ink); border-radius: 999px; font: 700 12px var(--font-display); min-width: 20px; height: 20px; display: grid; place-items: center; }
.joy { position: absolute; left: calc(18px + env(safe-area-inset-left, 0px)); bottom: calc(86px + env(safe-area-inset-bottom, 0px)); width: 120px; height: 120px; border-radius: 50%; background: rgba(245,234,210,.35); border: 3px dashed rgba(61,37,22,.6); touch-action: none; display: grid; place-items: center; }
.joy.on { background: rgba(245,234,210,.55); }
.joy-knob { width: 54px; height: 54px; border-radius: 50%; background: var(--paper-tex), var(--paper-hi); border: 3px solid var(--ink); box-shadow: inset 0 0 0 3px rgba(255,250,236,.7), 0 3px 0 var(--ink); pointer-events: none; }
.has-joy .chatlog { bottom: 220px; }
@media (max-width: 560px) { .hud-top .btn.icon { width: 40px; height: 40px; font-size: 18px; } .hud-top .btn.icon .ic { width: 21px; height: 21px; } .hud-top .btn.icon.q { font-size: 22px; } .setting { grid-template-columns: 100px 1fr; } .plank { gap: 7px; padding: 7px 9px; } .pill.coins { min-width: 0; font-size: 18px; } .coin { width: 28px; height: 28px; } }
@media (max-width: 460px) {
  .hud-top { gap: 4px; }
  .hud-top .row { gap: 4px; }
  .hud-top .pill { padding: 3px 9px 2px; font-size: 14px; }
  .hud-top .pill.coins { font-size: 16px; padding: 3px 11px 2px 3px; }
  .hud-top .row:first-child .pill:nth-child(2) { display: none; }
  .hud-top .btn.icon { width: 36px; height: 36px; font-size: 16px; }
  .hud-top .btn.icon .ic { width: 19px; height: 19px; }
  .plank { gap: 5px; padding: 6px 7px; }
  .coin { width: 24px; height: 24px; }
}
/* ---- Minimap ---- */
.minimap-wrap { position: absolute; left: calc(14px + env(safe-area-inset-left, 0px)); top: calc(70px + env(safe-area-inset-top, 0px)); display: grid; justify-items: center; gap: 8px; pointer-events: none; }
.minimap { width: 138px; height: 138px; border-radius: 50%; border: 3px solid var(--ink); background: #3d5a3a; cursor: pointer; overflow: hidden;
  box-shadow: 0 0 0 5px #8a5530, 0 0 0 8px var(--ink), 0 8px 18px var(--shadow); }
.minimap canvas { width: 100%; height: 100%; display: block; }
.minimap.big { border-radius: 16px; width: min(86vmin, 640px); height: min(86vmin, 640px); }
.minimap-wrap.big { position: absolute; inset: 0; left: 0; top: 0; place-content: center; background: rgba(30,16,6,.5); pointer-events: auto; z-index: 6; }
.clock { font-size: 15px; padding: 2px 11px 1px; margin-top: 4px; }
@media (max-width: 560px) { .minimap { width: 100px; height: 100px; box-shadow: 0 0 0 4px #8a5530, 0 0 0 6.5px var(--ink), 0 6px 14px var(--shadow); } .minimap-wrap { top: calc(62px + env(safe-area-inset-top, 0px)); } }
@keyframes pop { from { transform: translate(var(--tx, 0), 0) scale(.85); opacity: 0; } to { opacity: 1; } }
.bubble, .tag, .place { --tx: -50%; }
@keyframes big { from { transform: translateX(-50%) scale(1.6); opacity: 0; } to { transform: translateX(-50%) scale(1); opacity: 1; } }
.countdown.pop { animation: none; }
@keyframes float { from { opacity: 1; transform: translate(-50%, -100%) scale(.6); } 30% { transform: translate(-50%, -140%) scale(1.15); } to { opacity: 0; transform: translate(-50%, -260%) scale(1); } }
@media (max-width: 560px) {
  .hud-bottom .btn.icon { width: 44px; height: 44px; font-size: 21px; }
  .chatlog { bottom: 68px; }
  .action { bottom: 76px; }
}

/* ---- Village life ---- */
.npc-say { position: absolute; left: 50%; bottom: 150px; transform: translateX(-50%); width: min(520px, calc(100% - 24px)); padding: 12px 16px; display: flex; gap: 12px; align-items: flex-start; animation: pop .18s ease-out; font-size: 17px; line-height: 1.3; cursor: pointer; z-index: 40; }
.npc-say b { font-family: var(--font-display); font-size: 19px; }
.npc-face { font-size: 34px; width: 54px; height: 54px; border-radius: 50%; border: 3px solid var(--ink); background: var(--paper-2); display: grid; place-items: center; flex: none; box-shadow: inset 0 0 0 3px rgba(255,250,236,.6); }
.fishing { position: absolute; left: 50%; top: 42%; transform: translate(-50%, -50%); padding: 16px 24px; text-align: center; cursor: pointer; min-width: 250px; }
.fish-bob { font-size: 46px; animation: bob 1.6s ease-in-out infinite; }
.fishing.bite { background: var(--paper-tex), #fbe3a6; }
.fishing.bite .fish-bob { animation: dip .18s ease-in-out infinite; }
.fish-msg { font-family: var(--font-display); font-weight: 700; font-size: 19px; margin-top: 6px; }
@keyframes bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
@keyframes dip { 0%,100% { transform: translateY(0) rotate(0) } 50% { transform: translateY(10px) rotate(-12deg) } }
.item.locked { opacity: .72; }
.clubtag { font: 700 12px var(--font-display); color: #fff; border: 2px solid var(--ink); border-radius: 8px; padding: 1px 6px; -webkit-text-stroke: 0; }
.tag .clubtag { margin-right: 4px; font-size: 11px; padding: 0 4px; }
.friend.me { background: var(--paper-tex), #fbe7b5; }
.npc-mark { position: absolute; transform: translate(-50%, -100%); font: 700 24px var(--font-display); color: var(--gold-hi); -webkit-text-stroke: 2.5px var(--ink); paint-order: stroke fill; pointer-events: none; animation: bob 1.2s ease-in-out infinite; }
.bug-tap { position: absolute; transform: translate(-50%, -50%); font-size: 26px; width: 48px; height: 48px; display: grid; place-items: center; border-radius: 50%; background: rgba(255,255,255,.35); border: 2px dashed rgba(61,37,22,.5); cursor: pointer; }
.dock .btn.icon { position: relative; }
.dock .btn[data-badge]:not([data-badge=""])::after { content: attr(data-badge); position: absolute; top: -6px; right: -6px; background: var(--red); color: #fff; font: 700 12px var(--font-display); border: 2px solid var(--ink); border-radius: 999px; padding: 0 5px; }
.scoreboard { position: absolute; right: 14px; top: 70px; padding: 9px 14px; display: grid; gap: 3px; font-size: 16px; min-width: 170px; }
.scoreboard .me { color: var(--teal-dk); font-family: var(--font-display); font-weight: 700; }
.golf-hud { position: absolute; left: 50%; bottom: calc(14px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); display: grid; gap: 8px; justify-items: center; width: min(560px, calc(100% - 24px)); }
.golf-clubs { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
.golf-clubs .btn.on { outline: 3px solid var(--gold); outline-offset: 2px; border-radius: var(--wob-pill); }
.power { width: min(360px, 80vw); height: 26px; border: 3px solid var(--ink); border-radius: 13px 9px 14px 8px / 9px 14px 8px 13px; background: linear-gradient(90deg, #7fae5c, #d9a23a 60%, #b4412f); overflow: hidden; position: relative; box-shadow: inset 0 2px 4px rgba(0,0,0,.2), 0 3px 0 rgba(61,37,22,.45); }
.power i { position: absolute; top: 0; bottom: 0; width: 6px; background: var(--ink); border-radius: 3px; }
.golf-card { position: absolute; left: 12px; top: calc(12px + env(safe-area-inset-top, 0px)); padding: 10px 14px; max-width: min(320px, calc(100% - 24px)); }
.golf-card h3 { margin: 0 0 2px; font-family: var(--font-display); }
.golf-score { width: 100%; border-collapse: collapse; font-size: 15px; }
.golf-score td, .golf-score th { border: 1px solid rgba(61,37,22,.3); padding: 2px 4px; text-align: center; }
body.big-text #ui { font-size: 118%; }
body.big-text .btn { font-size: 22px; padding: 13px 28px; }
body.big-text .btn.small { font-size: 19px; padding: 8px 16px; }
body.big-text .btn.icon { width: 60px; height: 60px; font-size: 28px; padding: 0; }
body.big-text .pill { font-size: 19px; }
body.big-text .chatline, body.big-text .hint { font-size: 18px; }
body.big-text .tag { font-size: 19px; }
body.big-text .place { font-size: 18px; }

/* ---- The Word Lodge ---- */
.word-how { position: absolute; left: 50%; top: 13%; transform: translateX(-50%); padding: 10px 18px; max-width: min(460px, 90vw); text-align: center; font-size: 17px; }
.word-note { position: absolute; left: 50%; top: calc(13% + 64px); transform: translateX(-50%); padding: 6px 16px; font: 700 17px var(--font-display); text-align: center; max-width: min(420px, 90vw); opacity: 0; }
.word-note:not(:empty) { opacity: 1; }
.word-note.pop { animation: pop .22s ease-out; }
.word-hint { top: auto; bottom: calc(18px + env(safe-area-inset-bottom, 0px)); opacity: 1; font: 400 16px var(--font-body); color: var(--muted); }
.word-row { display: grid; grid-template-columns: 1fr 54px 30px; gap: 6px; align-items: center; }
.word-row .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.word-row .bar { height: 10px; border: 2px solid var(--ink); border-radius: 999px; background: var(--paper-2); overflow: hidden; }
.word-row .bar i { display: block; height: 100%; width: 0; background: var(--teal); transition: width .25s; }
.word-row.me { color: var(--teal-dk); }
.pill.urgent { background: var(--paper-tex), #e38a54; color: #fff; text-shadow: 0 1px 0 rgba(0,0,0,.25); }
.kb { position: absolute; left: 50%; bottom: calc(10px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); display: grid; gap: 5px; width: min(520px, calc(100% - 16px)); }
.kb-row { display: flex; gap: 4px; justify-content: center; }
.kb-key { flex: 1 1 0; min-width: 0; height: 48px; font: 700 18px var(--font-display); background: var(--paper-tex), var(--paper-hi); color: var(--ink); border: 2px solid var(--ink); border-radius: 8px 10px 7px 9px / 10px 7px 9px 8px; box-shadow: 0 3px 0 var(--ink); cursor: pointer; touch-action: manipulation; }
.kb-key:active { transform: translateY(3px); box-shadow: none; }
.kb-key.wide { flex: 1.6 1 0; font-size: 14px; }
.kb-key.m-g { background: var(--paper-tex), #5f9a52; color: #fff; }
.kb-key.m-y { background: var(--paper-tex), #c9a03a; color: #fff; }
.kb-key.m-b { background: var(--paper-tex), #8a7d70; color: #fff; }
@media (max-width: 560px) { .kb-key { height: 42px; font-size: 16px; } }
body.big-text .kb-key { font-size: 20px; }
`;
