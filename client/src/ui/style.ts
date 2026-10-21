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
:root { color-scheme: light; }
button, input { color: var(--ink); }
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
.quick button { text-align: left; font: 700 15px var(--font-body); color: var(--ink); background: #fff; border: 2px solid var(--ink); border-radius: 12px; padding: 8px 10px; cursor: pointer; }
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
.tab { font: 600 14px var(--font-display); color: var(--ink); background: var(--cream-2); border: 2.5px solid var(--ink); border-radius: 999px; padding: 5px 12px; cursor: pointer; }
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
/* Invites, settings, friends, joystick */
.invite { position: absolute; left: 50%; top: calc(64px + env(safe-area-inset-top, 0px)); transform: translateX(-50%); padding: 12px 16px; text-align: center; z-index: 8; animation: pop .2s ease-out; max-width: calc(100% - 24px); }
.settings { width: min(520px, 100%); }
.settings-body { padding: 4px 16px 16px; overflow: auto; display: grid; gap: 8px; }
.settings-body h3 { font: 700 16px var(--font-display); margin: 8px 0 0; }
.setting { display: grid; grid-template-columns: 130px 1fr; align-items: center; gap: 10px; font-weight: 800; font-size: 14px; }
.setting input[type=range] { width: 100%; accent-color: var(--teal); }
.codebox { display: flex; justify-content: space-between; align-items: center; gap: 10px; background: #fff; border: 2.5px solid var(--ink); border-radius: 12px; padding: 8px 10px; margin-top: 6px; }
.codebox code { font: 800 16px ui-monospace, monospace; letter-spacing: 1px; }
.friend { display: flex; align-items: center; gap: 8px; background: #fff; border: 2.5px solid var(--ink); border-radius: 12px; padding: 6px 8px; margin-top: 6px; }
.dot { width: 12px; height: 12px; border-radius: 50%; background: #b9ada0; border: 2px solid var(--ink); flex: 0 0 auto; }
.dot.on { background: #4cd964; }
.badge-host { position: relative; }
.badge-host[data-badge]:not([data-badge=""])::after { content: attr(data-badge); position: absolute; top: -6px; right: -6px; background: #4cd964; color: var(--ink); border: 2px solid var(--ink); border-radius: 999px; font: 800 11px var(--font-body); min-width: 18px; height: 18px; display: grid; place-items: center; }
.joy { position: absolute; left: calc(18px + env(safe-area-inset-left, 0px)); bottom: calc(86px + env(safe-area-inset-bottom, 0px)); width: 120px; height: 120px; border-radius: 50%; background: rgba(255,250,240,.35); border: 3px solid rgba(59,37,27,.55); touch-action: none; display: grid; place-items: center; }
.joy.on { background: rgba(255,250,240,.5); }
.joy-knob { width: 54px; height: 54px; border-radius: 50%; background: var(--cream); border: 3px solid var(--ink); box-shadow: 0 3px 0 var(--ink); pointer-events: none; }
.has-joy .chatlog { bottom: 220px; }
@media (max-width: 560px) { .hud-top .row .btn.icon { width: 40px; height: 40px; font-size: 18px; } .setting { grid-template-columns: 100px 1fr; } }
@media (max-width: 460px) {
  .hud-top { gap: 4px; }
  .hud-top .row { gap: 4px; }
  .hud-top .pill { padding: 4px 9px; font-size: 13px; }
  .hud-top .pill.coins { font-size: 15px; }
  .hud-top .row:first-child .pill:nth-child(2) { display: none; }
  .hud-top .row .btn.icon { width: 36px; height: 36px; font-size: 16px; }
}
/* Minimap */
.minimap-wrap { position: absolute; left: calc(12px + env(safe-area-inset-left, 0px)); top: calc(64px + env(safe-area-inset-top, 0px)); display: grid; justify-items: center; gap: 6px; pointer-events: none; }
.minimap { width: 138px; height: 138px; border-radius: 50%; border: 3px solid var(--ink); box-shadow: 0 4px 0 var(--ink), 0 8px 20px var(--shadow); background: #3d5a3a; cursor: pointer; overflow: hidden; }
.minimap canvas { width: 100%; height: 100%; display: block; }
.minimap.big { border-radius: 20px; width: min(86vmin, 640px); height: min(86vmin, 640px); }
.minimap-wrap.big { position: absolute; inset: 0; left: 0; top: 0; place-content: center; background: rgba(46,28,18,.4); pointer-events: auto; z-index: 6; }
.clock { font-size: 13px; padding: 3px 10px; }
@media (max-width: 560px) { .minimap { width: 104px; height: 104px; } .minimap-wrap { top: calc(56px + env(safe-area-inset-top, 0px)); } }
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

/* Village life */
.npc-say { position: absolute; left: 50%; bottom: 150px; transform: translateX(-50%); width: min(520px, calc(100% - 24px)); padding: 12px 14px; display: flex; gap: 12px; align-items: flex-start; animation: pop .18s ease-out; font-weight: 600; line-height: 1.35; cursor: pointer; z-index: 40; }
.npc-say b { font-family: var(--font-display); font-size: 17px; }
.npc-face { font-size: 34px; width: 52px; height: 52px; border-radius: 50%; border: 3px solid var(--ink); background: var(--cream-2); display: grid; place-items: center; flex: none; }
.fishing { position: absolute; left: 50%; top: 42%; transform: translate(-50%, -50%); padding: 16px 22px; text-align: center; cursor: pointer; min-width: 240px; }
.fish-bob { font-size: 46px; animation: bob 1.6s ease-in-out infinite; }
.fishing.bite { background: #fff1b8; }
.fishing.bite .fish-bob { animation: dip .18s ease-in-out infinite; }
.fish-msg { font-family: var(--font-display); font-weight: 600; font-size: 18px; margin-top: 6px; }
@keyframes bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
@keyframes dip { 0%,100% { transform: translateY(0) rotate(0) } 50% { transform: translateY(10px) rotate(-12deg) } }
.item.locked { opacity: .72; }
.clubtag { font: 700 12px var(--font-display); color: #fff; border: 2px solid var(--ink); border-radius: 8px; padding: 1px 6px; -webkit-text-stroke: 0; }
.tag .clubtag { margin-right: 4px; font-size: 11px; padding: 0 4px; }
.friend.me { background: #fff1b8; border-radius: 10px; }
.npc-mark { position: absolute; transform: translate(-50%, -100%); font: 700 22px var(--font-display); color: var(--gold); -webkit-text-stroke: 2px var(--ink); paint-order: stroke fill; pointer-events: none; animation: bob 1.2s ease-in-out infinite; }
.bug-tap { position: absolute; transform: translate(-50%, -50%); font-size: 26px; width: 48px; height: 48px; display: grid; place-items: center; border-radius: 50%; background: rgba(255,255,255,.35); border: 2px dashed rgba(59,37,27,.5); cursor: pointer; }
.dock .btn.icon { position: relative; }
.dock .btn[data-badge]:not([data-badge=""])::after { content: attr(data-badge); position: absolute; top: -6px; right: -6px; background: var(--red); color: #fff; font-size: 12px; border: 2px solid var(--ink); border-radius: 999px; padding: 0 5px; }
.scoreboard { position: absolute; right: 14px; top: 64px; padding: 8px 12px; display: grid; gap: 3px; font-weight: 700; font-size: 14px; min-width: 160px; }
.scoreboard .me { color: var(--teal-dk); }
.golf-hud { position: absolute; left: 50%; bottom: calc(14px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); display: grid; gap: 8px; justify-items: center; width: min(560px, calc(100% - 24px)); }
.golf-clubs { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
.golf-clubs .btn.on { outline: 3px solid var(--gold); outline-offset: 2px; }
.power { width: min(360px, 80vw); height: 26px; border: 3px solid var(--ink); border-radius: 999px; background: linear-gradient(90deg, #7fd27a, #f5c242 60%, #e2483d); overflow: hidden; position: relative; box-shadow: 0 3px 0 var(--ink); }
.power i { position: absolute; top: 0; bottom: 0; width: 6px; background: var(--ink); border-radius: 3px; }
.golf-card { position: absolute; left: 12px; top: calc(12px + env(safe-area-inset-top, 0px)); padding: 10px 14px; max-width: min(320px, calc(100% - 24px)); }
.golf-card h3 { margin: 0 0 2px; font-family: var(--font-display); }
.golf-score { width: 100%; border-collapse: collapse; font-size: 13px; }
.golf-score td, .golf-score th { border: 1px solid #d8c8b0; padding: 2px 4px; text-align: center; }
body.big-text #ui { font-size: 118%; }
body.big-text .btn { font-size: 20px; padding: 13px 20px; }
body.big-text .btn.small { font-size: 17px; padding: 9px 13px; }
body.big-text .btn.icon { width: 60px; height: 60px; font-size: 28px; }
body.big-text .pill { font-size: 18px; }
body.big-text .chatline, body.big-text .hint { font-size: 16px; }
body.big-text .tag { font-size: 17px; }
body.big-text .place { font-size: 18px; }

/* ---- The Word Lodge ---- */
.word-how { position: absolute; left: 50%; top: 13%; transform: translateX(-50%); padding: 10px 16px; max-width: min(460px, 90vw); text-align: center; font-weight: 700; font-size: 14px; }
.word-note { position: absolute; left: 50%; top: calc(13% + 64px); transform: translateX(-50%); padding: 7px 14px; font-weight: 800; text-align: center; max-width: min(420px, 90vw); opacity: 0; }
.word-note:not(:empty) { opacity: 1; }
.word-note.pop { animation: pop .22s ease-out; }
.word-hint { top: auto; bottom: calc(18px + env(safe-area-inset-bottom, 0px)); opacity: 1; font-size: 13px; color: var(--muted); }
.word-row { display: grid; grid-template-columns: 1fr 54px 30px; gap: 6px; align-items: center; }
.word-row .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.word-row .bar { height: 9px; border: 2px solid var(--ink); border-radius: 999px; background: #fff; overflow: hidden; }
.word-row .bar i { display: block; height: 100%; width: 0; background: var(--teal); transition: width .25s; }
.word-row.me { color: var(--teal-dk); }
.pill.urgent { background: var(--orange); color: #fff; }
.kb { position: absolute; left: 50%; bottom: calc(10px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); display: grid; gap: 5px; width: min(520px, calc(100% - 16px)); }
.kb-row { display: flex; gap: 4px; justify-content: center; }
.kb-key { flex: 1 1 0; min-width: 0; height: 46px; font: 800 15px var(--font-ui); background: var(--cream); color: var(--ink); border: 2.5px solid var(--ink); border-radius: 8px; box-shadow: 0 3px 0 var(--ink); cursor: pointer; touch-action: manipulation; }
.kb-key:active { transform: translateY(3px); box-shadow: none; }
.kb-key.wide { flex: 1.6 1 0; font-size: 12px; }
.kb-key.m-g { background: #6aaa64; color: #fff; }
.kb-key.m-y { background: #c9b458; color: #fff; }
.kb-key.m-b { background: #787c7e; color: #fff; }
@media (max-width: 560px) { .kb-key { height: 42px; font-size: 14px; } }
body.big-text .kb-key { font-size: 17px; }
`
