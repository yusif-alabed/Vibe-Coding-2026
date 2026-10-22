import { CASINO, ROULETTE_RED, SLOT_SYMBOLS, type CasinoGame, type RouletteBet, type ServerMsg } from "@beaver/shared";
import type { Ctx } from "../game/scene";
import { h } from "./dom";

/**
 * 🍀 The Lucky Lodge: slots, roulette and blackjack for in-game coins only. Every result comes
 * from the server; this panel just shows it. The house rules (small bets, a daily loss cap) are
 * printed right on the felt so nobody is surprised.
 */

type Card = { r: number; s: number };
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function card(c: Card) {
  if (!c.r) return h("div", { style: "width:42px;height:60px;border:2.5px solid var(--ink);border-radius:8px;background:repeating-linear-gradient(45deg,#c8473a 0 6px,#a23a30 6px 12px)" });
  const red = c.s === 1 || c.s === 2;
  return h("div", { style: `width:42px;height:60px;border:2.5px solid var(--ink);border-radius:8px;background:#fff;display:grid;place-items:center;font-weight:800;font-size:18px;color:${red ? "#c8323a" : "#2e2b2a"}` }, `${RANKS[c.r]}${SUITS[c.s]}`);
}

export interface CasinoPanel { el: HTMLElement; result(m: Extract<ServerMsg, { t: "casino" }>): void }

export function openCasino(ctx: Ctx, root: HTMLElement, onClose: () => void, tab: CasinoGame = "slots"): CasinoPanel {
  let game: CasinoGame = tab;
  let bet = 5;
  let choice: RouletteBet = "red";
  let busy = false;
  let bj: any = null;
  const note = h("div.hint", { style: "margin:8px 0 0;min-height:20px;font-weight:700" }, "");
  const table = h("div", { style: "display:grid;gap:10px;justify-items:center;padding:12px;border:3px solid var(--ink);border-radius:16px;background:#2f7a4a;color:#fff;min-height:150px" });
  const tabs = h("div.row", { style: "justify-content:center;gap:6px;flex-wrap:wrap" });
  const betEl = h("b", {}, "");
  const send = (extra: Record<string, unknown> = {}) => {
    if (busy) return;
    busy = true;
    note.textContent = "";
    ctx.net.send({ t: "casino", game, bet, ...extra } as never);
    window.setTimeout(() => { busy = false; }, 600);
  };
  const betRow = h("div.row", { style: "justify-content:center;gap:8px;align-items:center" }, [
    h("button.btn.cream.small", { onclick: () => { bet = Math.max(CASINO.minBet, bet - (bet > 5 ? 5 : 1)); draw(); } }, "−"),
    h("span", {}, ["Bet 🪙", betEl]),
    h("button.btn.cream.small", { onclick: () => { bet = Math.min(CASINO.maxBet, bet + (bet >= 5 ? 5 : 1)); draw(); } }, "+"),
  ]);

  function draw() {
    betEl.textContent = String(bet);
    tabs.replaceChildren(...(["slots", "roulette", "blackjack"] as CasinoGame[]).map((g) =>
      h(`button.btn.small${g === game ? ".orange" : ".cream"}`, { onclick: () => { game = g; draw(); } }, g === "slots" ? "🎰 Slots" : g === "roulette" ? "🎡 Roulette" : "🃏 Blackjack")));
    if (game === "slots") {
      table.replaceChildren(
        h("div", { style: "font-size:13px;opacity:.9" }, `Three of a kind: ${SLOT_SYMBOLS.map((s) => `${s.s}×${s.triple}`).join(" ")} · any pair ×1.5`),
        h("div.reels", { style: "display:flex;gap:8px" }, [0, 1, 2].map(() => h("div.reel", { style: "width:64px;height:72px;border:3px solid var(--ink);border-radius:12px;background:#fff;display:grid;place-items:center;font-size:40px" }, "❔"))),
        h("button.btn.orange", { onclick: () => { spin(); send(); } }, "Pull the lever"),
      );
    } else if (game === "roulette") {
      const pick = (c: RouletteBet, label: string, bg: string) => h(`button.btn.small`, { style: `background:${bg};color:#fff;${choice === c ? "outline:3px solid #ffd93b" : ""}`, onclick: () => { choice = c; draw(); } }, label);
      const nums = h("div", { style: "display:grid;grid-template-columns:repeat(12,1fr);gap:2px;width:100%" }, Array.from({ length: 36 }, (_, i) => {
        const n = i + 1;
        return h("button", { style: `border:1.5px solid #fff;border-radius:4px;padding:2px 0;font-weight:800;font-size:11px;color:#fff;background:${ROULETTE_RED.has(n) ? "#c8323a" : "#2e2b2a"};${choice === n ? "outline:3px solid #ffd93b" : ""}`, onclick: () => { choice = n; draw(); } }, String(n));
      }));
      table.replaceChildren(
        h("div.wheel", { style: "width:72px;height:72px;border-radius:50%;border:4px solid var(--ink);background:conic-gradient(#c8323a 0 10%,#2e2b2a 0 20%,#c8323a 0 30%,#2e2b2a 0 40%,#3f8a5a 0 45%,#c8323a 0 55%,#2e2b2a 0 65%,#c8323a 0 75%,#2e2b2a 0 85%,#c8323a 0 100%);display:grid;place-items:center;font-weight:800;font-size:22px" }, h("span", { style: "background:#fff;color:var(--ink);border-radius:50%;width:38px;height:38px;display:grid;place-items:center" }, "?")),
        h("div.row", { style: "gap:4px;flex-wrap:wrap;justify-content:center" }, [
          pick("red", "Red ×2", "#c8323a"), pick("black", "Black ×2", "#2e2b2a"), pick("odd", "Odd ×2", "#5b3a24"), pick("even", "Even ×2", "#5b3a24"), pick("low", "1–18 ×2", "#5b3a24"), pick("high", "19–36 ×2", "#5b3a24"), pick(0, "0 ×36", "#3f8a5a"),
        ]),
        nums,
        h("div", { style: "font-size:12px;opacity:.9" }, "A single number pays ×36."),
        h("button.btn.orange", { onclick: () => { spinWheel(); send({ choice }); } }, "Spin the wheel"),
      );
    } else {
      const live = bj && !bj.done;
      table.replaceChildren(
        h("div", { style: "font-size:13px;opacity:.9" }, "Dealer stands on 17 · Blackjack pays 3:2"),
        h("div", {}, `Dealer${bj?.dv != null ? ` · ${bj.dv}` : ""}`),
        h("div.row", { style: "gap:6px" }, (bj?.dealer ?? [{ r: 0, s: 0 }, { r: 0, s: 0 }]).map(card)),
        h("div", {}, `You${bj ? ` · ${bj.pv}` : ""}`),
        h("div.row", { style: "gap:6px" }, (bj?.player ?? []).map(card)),
        h("div.row", { style: "gap:6px;flex-wrap:wrap;justify-content:center" }, live ? [
          h("button.btn.orange.small", { onclick: () => send({ action: "hit" }) }, "Hit"),
          h("button.btn.cream.small", { onclick: () => send({ action: "stand" }) }, "Stand"),
          bj.player.length === 2 ? h("button.btn.cream.small", { onclick: () => send({ action: "double" }) }, "Double") : "",
        ] : [h("button.btn.orange", { onclick: () => send({ action: "deal" }) }, "Deal")]),
      );
    }
    betRow.style.display = game === "blackjack" && bj && !bj.done ? "none" : "";
  }

  let spinTimer = 0;
  function spin() {
    clearInterval(spinTimer);
    const reels = [...table.querySelectorAll<HTMLElement>(".reel")];
    spinTimer = window.setInterval(() => { for (const r of reels) r.textContent = SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)].s; }, 70);
    ctx.sound.play("countdown", 0.4);
  }
  function spinWheel() {
    const w = table.querySelector<HTMLElement>(".wheel");
    if (w) { w.style.transition = "transform .8s ease-out"; w.style.transform = `rotate(${720 + Math.random() * 360}deg)`; }
  }

  const body = h("div.settings-body", {}, [
    h("div.hint", { style: "margin:0 0 10px" }, `Play for fun with the coins you've earned around Banff. Coins here can't be bought and can't be cashed out. Bets are 🪙${CASINO.minBet}–${CASINO.maxBet}, and the Lodge closes your table after you're down 🪙${CASINO.dailyLoss} in a day.`),
    tabs, h("div", { style: "height:10px" }), table, h("div", { style: "height:10px" }), betRow, note,
  ]);
  const el = h("div.overlay.pe", { onclick: (e: Event) => { if (e.target === el) close(); } }, h("div.card.panel.settings", {}, [
    h("header", {}, [h("h2", {}, "🍀 The Lucky Lodge"), h("button.btn.cream.small", { onclick: () => close() }, "✕")]),
    body,
  ]));
  const close = () => { clearInterval(spinTimer); el.remove(); onClose(); };
  root.append(el);
  draw();

  return {
    el,
    result(m) {
      busy = false;
      if (!m.ok) { clearInterval(spinTimer); note.textContent = m.note ?? "Can't do that."; if (m.game === "blackjack" && m.data) { bj = m.data; draw(); } return; }
      const d = m.data as any;
      const delta = m.delta ?? 0;
      if (m.game === "slots") {
        window.setTimeout(() => {
          clearInterval(spinTimer);
          const reels = [...table.querySelectorAll<HTMLElement>(".reel")];
          reels.forEach((r, i) => (r.textContent = d.reels[i]));
          note.textContent = d.win > 0 ? `You win 🪙${d.win}!` : "No luck this time.";
          if (d.win > 0) ctx.sound.play(d.win >= bet * 5 ? "quest" : "coin");
        }, 650);
      } else if (m.game === "roulette") {
        window.setTimeout(() => {
          const w = table.querySelector<HTMLElement>(".wheel span");
          if (w) { w.textContent = String(d.n); w.style.color = d.n === 0 ? "#3f8a5a" : d.red ? "#c8323a" : "#2e2b2a"; }
          note.textContent = d.win > 0 ? `${d.n}! You win 🪙${d.win}!` : `${d.n}. Not this time.`;
          if (d.win > 0) ctx.sound.play("coin");
        }, 800);
      } else {
        bj = d;
        draw();
        if (bj.done) {
          note.textContent = bj.outcome === "blackjack" ? `Blackjack! +🪙${bj.payout}` : bj.outcome === "win" ? `You win 🪙${bj.payout}!` : bj.outcome === "push" ? "Push: your bet comes back." : "Dealer wins.";
          if (delta > 0) ctx.sound.play("coin");
        }
      }
    },
  };
}
