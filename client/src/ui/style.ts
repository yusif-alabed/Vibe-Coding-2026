/** UI styles: rounded storybook stickers — clean, friendly, and easy to read at a glance. */
export const CSS = `
:root {
  --ink: #3b251b; --cream: #fffaf0; --cream-2: #f7e8c9; --teal: #31bbb8; --teal-dk: #178c98;
  --orange: #ff8a3d; --red: #e2483d; --gold: #f5c242; --sky: #4f9be0; --muted: #7a6656;
  --pine: #286a51; --lake: #35c6c7; --shadow: rgba(46,28,18,.18);
  --font-display: "Fredoka", "Baloo 2", ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif;
  --font-body: "Nunito", ui-rounded, system-ui, sans-serif;
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; overflow: hidden; background: #ffd9b0; font-family: var(--font-body); color: var(--ink); -webkit-tap-highlight-color: transparent; }
#game { position: fixed; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
#ui { position: fixed; inset: 0; pointer-events: none; }
#ui .pe { pointer-events: auto; }
.card { background: linear-gradient(145deg, #fffefb, var(--cream)); border: 3px solid var(--ink); border-radius: 24px; box-shadow: 0 5px 0 var(--ink), 0 15px 35px var(--shadow); }
.btn { font-family: var(--font-display); font-weight: 700; font-size: 17px; letter-spacing: .2px; color: #fff; background: var(--teal);
  border: 3px solid var(--ink); border-radius: 999px; padding: 10px 16px; box-shadow: 0 4px 0 var(--ink); cursor: pointer;
  transition: transform .06s, box-shadow .06s, filter .15s; white-space: nowrap; }
.btn:hover { filter: brightness(1.06); }
.btn:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--ink); }
.btn:disabled { background: #b9ada0; cursor: default; }
.btn.orange { background: var(--orange); } .btn.red { background: var(--red); } .btn.cream { background: var(--cream); color: var(--ink); }
.btn.gold { background: var(--gold); color: var(--ink); }
.btn.small { font-size: 14px; padding: 6px 10px; border-radius: 11px; box-shadow: 0 3px 0 var(--ink); }
.btn.icon { width: 50px; height: 50px; padding: 0; font-size: 24px; display: grid; place-items: center; }
input.field { font: 600 17px var(--font-body); color: var(--ink); background: #fff; border: 3px solid var(--ink); border-radius: 12px; padding: 10px 12px; outline: none; width: 100%; }
input.field:focus { box-shadow: 0 0 0 3px #7ff3f0; }

/* Title screen */
.title { position: absolute; inset: 0; display: grid; place-items: center; padding: 16px; background: radial-gradient(circle at 50% 20%, rgba(255,255,255,.22), transparent 38%), linear-gradient(180deg, rgba(79,155,224,.08), rgba(18,43,45,.32)); }
.title .card { width: min(440px, 100%); padding: 22px 22px 20px; text-align: center; }
.logo { font-family: var(--font-display); font-weight: 700; font-size: clamp(40px, 9vw, 58px); line-height: .95; margin: 0 0 4px;
  color: #fff; -webkit-text-stroke: 3px var(--ink); paint-order: stroke fill; text-shadow: 0 5px 0 var(--ink), 0 12px 22px rgba(46,28,18,.25); letter-spacing: 1px; }
.logo span { color: var(--gold); }
.tagline { font-weight: 700; color: var(--muted); margin: 6px 0 16px; }
.label { font-family: var(--font-display); font-weight: 600; text-align: left; margin: 12px 0 6px; font-size: 15px; }
.swatches { display: flex; gap: 8px; flex-wrap: wrap; }
.swatch { width: 40px; height: 40px; border-radius: 50%; border: 3px solid var(--ink); cursor: pointer; box-shadow: 0 3px 0 var(--ink); transition: transform .12s; }
.swatch:hover { transform: translateY(-2px) rotate(-4deg); }
.swatch.on { outline: 3px solid var(--gold); outline-offset: 2px; }
.row { display: flex; gap: 8px; align-items: center; }
.stack { display: grid; gap: 10px; margin-top: 16px; }
.hint { font-size: 13px; color: var(--muted); margin-top: 12px; line-height: 1.4; }
.hint b { color: var(--ink); }

/* HUD */
.hud-top { position: absolute; top: calc(12px + env(safe-area-inset-top, 0px)); left: calc(12px + env(safe-area-inset-left, 0px)); right: calc(12px + env(safe-area-inset-right, 0px)); display: flex; justify-content: space-between; gap: 8px; align-items: flex-start; }
.pill { font-family: var(--font-display); font-weight: 600; background: linear-gradient(145deg, #fffdf7, var(--cream)); border: 3px solid var(--ink); border-radius: 999px; padding: 6px 14px; box-shadow: 0 4px 0 var(--ink), 0 7px 18px var(--shadow); font-size: 15px; display: inline-flex; gap: 8px; align-items: center; white-space: nowrap; }
.pill.coins { background: var(--gold); font-size: 18px; }
.hud-bottom { position: absolute; left: calc(12px + env(safe-area-inset-left, 0px)); right: calc(12px + env(safe-area-inset-right, 0px)); bottom: calc(12px + env(safe-area-inset-bottom, 0px)); display: flex; gap: 8px; align-items: flex-end; }
.chatbar { flex: 1; display: flex; gap: 8px; max-width: 560px; }
.chatlog { position: absolute; left: 12px; bottom: 76px; width: min(420px, calc(100% - 24px)); display: flex; flex-direction: column; gap: 4px; }
.chatline { background: rgba(255,247,232,.92); border: 2px solid var(--ink); border-radius: 12px; padding: 4px 10px; font-size: 14px; font-weight: 600; width: fit-content; max-width: 100%; animation: pop .18s ease-out; }
.chatline b { font-family: var(--font-display); }
.chatline.sys { background: #dff7f5; }
.action { position: absolute; left: 50%; bottom: 84px; transform: translateX(-50%); }
.menu { position: absolute; bottom: 74px; right: 12px; padding: 10px; display: grid; gap: 6px; max-width: min(320px, calc(100vw - 24px)); }
.emotes { grid-template-columns: repeat(4, 1fr); }
.emotes button { font-size: 26px; background: #fff; border: 2px solid var(--ink); border-radius: 12px; padding: 6px; cursor: pointer; }
.quick button { text-align: left; font: 700 15px var(--font-body); background: #fff; border: 2px solid var(--ink); border-radius: 12px; padding: 8px 10px; cursor: pointer; }
.quick button:hover, .emotes button:hover { background: #fff2cc; }

/* World labels */
.tag { position: absolute; transform: translate(-50%, -100%); font-family: var(--font-display); font-weight: 700; font-size: 14px; color: #fff;
  -webkit-text-stroke: 3px var(--ink); paint-order: stroke fill; white-space: nowrap; pointer-events: none; }
.tag.me { color: var(--gold); }
.place { position: absolute; transform: translate(-50%, -100%); background: var(--cream); border: 2.5px solid var(--ink); border-radius: 999px; padding: 3px 11px; font: 700 13px var(--font-display); box-shadow: 0 3px 0 var(--ink); white-space: nowrap; pointer-events: none; }
.bubble { position: absolute; transform: translate(-50%, -100%); background: #fff; border: 2.5px solid var(--ink); border-radius: 14px; padding: 5px 10px; font-weight: 700; font-size: 14px; max-width: 220px; text-align: center; box-shadow: 0 3px 0 var(--ink); pointer-events: none; animation: pop .18s ease-out; }
.bubble::after { content: ""; position: absolute; left: 50%; bottom: -9px; width: 12px; height: 12px; background: #fff; border-right: 2.5px solid var(--ink); border-bottom: 2.5px solid var(--ink); transform: translateX(-50%) rotate(45deg); }
.emote { position: absolute; transform: translate(-50%, -100%); font-size: 34px; pointer-events: none; animation: float 1.6s ease-out forwards; }

/* Panels */
.overlay { position: absolute; inset: 0; display: grid; place-items: center; padding: 14px; background: rgba(46,28,18,.35); }
.panel { width: min(560px, 100%); max-height: min(640px, 100%); display: flex; flex-direction: column; overflow: hidden; }
.panel header { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px 6px; }
.panel h2 { font-family: var(--font-display); margin: 0; font-size: 26px; }
.tabs { display: flex; gap: 6px; padding: 6px 16px 10px; flex-wrap: wrap; }
.tab { font: 600 14px var(--font-display); background: var(--cream-2); border: 2.5px solid var(--ink); border-radius: 999px; padding: 5px 12px; cursor: pointer; }
.tab.on { background: var(--ink); color: var(--cream); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; padding: 4px 16px 16px; overflow: auto; }
.item { background: #fff; border: 2.5px solid var(--ink); border-radius: 14px; padding: 10px; display: grid; gap: 6px; justify-items: center; text-align: center; }
.item .ico { width: 56px; height: 56px; border-radius: 14px; border: 2.5px solid var(--ink); display: grid; place-items: center; font-size: 28px; }
.item .nm { font: 600 14px var(--font-display); }
.price { font-weight: 800; font-size: 13px; }

/* Race HUD */
.countdown { position: absolute; inset: 0; display: grid; place-items: center; font-family: var(--font-display); font-weight: 700; font-size: min(28vw, 180px); color: #fff; -webkit-text-stroke: 6px var(--ink); paint-order: stroke fill; text-shadow: 0 10px 0 var(--ink); pointer-events: none; }
.countdown.pop { animation: big .5s ease-out; }
.place-big { font-family: var(--font-display); font-weight: 700; font-size: 44px; color: #fff; -webkit-text-stroke: 4px var(--ink); paint-order: stroke fill; line-height: 1; }
.progress { position: absolute; left: 50%; top: 14px; transform: translateX(-50%); width: min(420px, 60vw); height: 22px; }
.progress .track { position: absolute; inset: 0; background: var(--cream); border: 3px solid var(--ink); border-radius: 999px; box-shadow: 0 3px 0 var(--ink); }
.progress .dot { position: absolute; top: 50%; width: 16px; height: 16px; border-radius: 50%; border: 2.5px solid var(--ink); transform: translate(-50%, -50%); background: #ccc; transition: left .1s linear; }
.progress .dot.me { background: var(--gold); width: 20px; height: 20px; z-index: 2; }
.progress .flag { position: absolute; right: -6px; top: -10px; font-size: 22px; }
.flash { position: absolute; left: 50%; top: 28%; transform: translateX(-50%); font-family: var(--font-display); font-weight: 700; font-size: 44px; color: var(--gold); -webkit-text-stroke: 4px var(--ink); paint-order: stroke fill; pointer-events: none; animation: big .4s ease-out; }
.touchpads { position: absolute; inset: auto 0 0 0; height: 40%; display: none; }
@media (pointer: coarse) { .touchpads { display: flex; } }
.touchpads div { flex: 1; display: grid; place-items: end center; padding-bottom: 24px; font-size: 44px; opacity: .55; }
.results { padding: 18px; width: min(460px, 100%); text-align: center; }
.results h2 { font-family: var(--font-display); font-size: 32px; margin: 0 0 10px; }
.res { display: grid; grid-template-columns: 44px 1fr auto auto; gap: 8px; align-items: center; padding: 8px 10px; border: 2.5px solid var(--ink); border-radius: 12px; background: #fff; margin-top: 6px; text-align: left; font-weight: 700; }
.res.me { background: #fff2cc; }
.res .pl { font-family: var(--font-display); font-size: 22px; }
.speedlines { position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity .2s; background: radial-gradient(ellipse at center, transparent 55%, rgba(255,255,255,.55) 100%); }
.speedlines.on { opacity: 1; }
.toast { position: absolute; left: 50%; top: 70px; transform: translateX(-50%); padding: 8px 14px; font-weight: 800; animation: pop .2s ease-out; z-index: 5; max-width: calc(100% - 24px); text-align: center; }
.playercard { position: absolute; padding: 12px; display: grid; gap: 8px; transform: translate(-50%, -110%); min-width: 190px; }
.playercard h3 { margin: 0; font-family: var(--font-display); font-size: 20px; text-align: center; }
.help { padding: 18px 20px; width: min(460px, 100%); line-height: 1.5; }
.help h2 { font-family: var(--font-display); margin: 0 0 8px; }
.help kbd { font: 700 13px var(--font-body); background: #fff; border: 2px solid var(--ink); border-radius: 6px; padding: 1px 6px; box-shadow: 0 2px 0 var(--ink); }
/* Daily quests */
.quests { position: absolute; top: calc(68px + env(safe-area-inset-top, 0px)); right: calc(12px + env(safe-area-inset-right, 0px)); width: min(270px, calc(100vw - 24px)); padding: 8px 10px 10px; border-radius: 18px; cursor: pointer; }
.quests header { display: flex; justify-content: space-between; align-items: center; font: 700 15px var(--font-display); gap: 6px; }
.quests header .n { font-size: 13px; background: var(--cream-2); border: 2px solid var(--ink); border-radius: 999px; padding: 0 8px; }
.quests.closed .ql { display: none; }
.quest { display: grid; grid-template-columns: 24px 1fr; gap: 2px 6px; align-items: center; margin-top: 7px; font-size: 13px; font-weight: 700; }
.quest .qi { font-size: 18px; grid-row: span 2; text-align: center; }
.quest .bar { height: 8px; border: 2px solid var(--ink); border-radius: 999px; background: #fff; overflow: hidden; }
.quest .bar i { display: block; height: 100%; background: var(--teal); transition: width .3s; }
.quest.done { color: var(--muted); } .quest.done .lbl { text-decoration: line-through; } .quest.done .bar i { background: var(--gold); }
.quests .bonus { margin-top: 8px; font-size: 12px; font-weight: 800; color: var(--muted); text-align: center; }
.quests .bonus.got { color: var(--pine); }
.quest-pop { position: absolute; left: 50%; top: 22%; transform: translateX(-50%); padding: 12px 20px; text-align: center; animation: big .35s ease-out; z-index: 5; }
.quest-pop b { display: block; font: 700 22px var(--font-display); }
.dock { position: absolute; right: calc(12px + env(safe-area-inset-right, 0px)); bottom: calc(80px + env(safe-area-inset-bottom, 0px)); display: grid; gap: 8px; }
.cone-pop { position: absolute; transform: translate(-50%, -100%); font: 700 20px var(--font-display); color: var(--gold); -webkit-text-stroke: 3px var(--ink); paint-order: stroke fill; pointer-events: none; animation: float 1.4s ease-out forwards; }

/* Photo mode */
.photo-ui { position: absolute; inset: 0; pointer-events: none; }
.photo-top { position: absolute; top: calc(12px + env(safe-area-inset-top, 0px)); left: 12px; right: 12px; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.photo-tip { font: 700 13px var(--font-body); color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,.6); text-align: center; }
.photo-frame-guide { position: absolute; inset: 4.5% 4.5% 16% 4.5%; border: 2px dashed rgba(255,255,255,.75); border-radius: 6px; pointer-events: none; }
.photo-bar { position: absolute; left: 50%; bottom: calc(12px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); width: min(720px, calc(100% - 24px)); padding: 10px 12px; display: grid; gap: 7px; border-radius: 20px; }
.photo-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.photo-row > b { font: 700 14px var(--font-display); width: 46px; }
.photo-row input.field { flex: 1; min-width: 140px; padding: 5px 10px; font-size: 15px; }
.photo-chips { display: flex; gap: 5px; flex-wrap: wrap; flex: 1; }
.photo-chips .tab { padding: 3px 10px; font-size: 13px; }
.photo-row.cam { justify-content: flex-end; }
.photo-bar.compact { width: auto; }
.photo-row.cam .shutter { margin-left: auto; font-size: 19px; padding: 9px 22px; }
.photo-flash { position: absolute; inset: 0; background: #fff; pointer-events: none; animation: flash .6s ease-out forwards; z-index: 7; }
@keyframes flash { from { opacity: .95; } to { opacity: 0; } }
.photo-result { padding: 16px; width: min(760px, 100%); max-height: 100%; overflow: auto; text-align: center; display: grid; gap: 10px; }
.photo-result h2 { font-family: var(--font-display); margin: 0; }
.photo-result img { width: 100%; max-height: 60vh; object-fit: contain; border-radius: 10px; }

/* Cabin */
.cabin-banner { position: absolute; top: calc(12px + env(safe-area-inset-top, 0px)); left: 50%; transform: translateX(-50%); }
.inventory { position: absolute; left: 50%; bottom: calc(76px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); width: min(760px, calc(100% - 24px)); padding: 8px; display: flex; gap: 6px; overflow-x: auto; border-radius: 18px; }
.inv { flex: 0 0 auto; width: 78px; background: #fff; border: 2.5px solid var(--ink); border-radius: 12px; padding: 4px; text-align: center; cursor: pointer; font: 700 11px var(--font-display); position: relative; }
.inv .e { font-size: 24px; display: block; }
.inv .c { position: absolute; top: -7px; right: -7px; background: var(--gold); border: 2px solid var(--ink); border-radius: 999px; font-size: 11px; min-width: 20px; padding: 0 4px; }
.inv.on { background: #fff2cc; outline: 3px solid var(--orange); }
.inv.empty { opacity: .45; }
.inv.shop { background: var(--cream-2); }
.edit-tools { position: absolute; left: 50%; bottom: calc(158px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); display: flex; gap: 6px; }
.cabin-hint { position: absolute; left: 50%; top: calc(66px + env(safe-area-inset-top, 0px)); transform: translateX(-50%); font: 700 14px var(--font-body); color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,.7); text-align: center; width: calc(100% - 24px); pointer-events: none; }
@media (max-width: 560px) {
  .quests { top: calc(62px + env(safe-area-inset-top, 0px)); width: 210px; }
  .photo-row > b { display: none; }
  .dock .btn.icon { width: 44px; height: 44px; font-size: 21px; }
}
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
`;
