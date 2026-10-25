import { EMOTES, type Look, type PlayerInfo, type ServerMsg } from "@beaver/shared";
import { compose, lerp, lerpAngle } from "../engine/math";
import type { Renderer } from "../engine/renderer";
import { h } from "../ui/dom";
import { newTrack, pushSample, sampleAt, type Track } from "./smoothing";
import { drawBeaver, emoteReaction, getBeaverMeshes, type Expression } from "./beaver";
import type { Ctx } from "./scene";

interface Other {
  id: string; name: string; look: Look;
  x: number; z: number; ry: number; tx: number; tz: number; tr: number;
  walk: number; moving: number;
  jumpT: number; waveT: number; cheerT: number; talkT: number;
  expr: Expression; exprT: number; seed: number;
  tag: HTMLElement; bubble: HTMLElement | null; bubbleUntil: number;
  track: Track;
}

/**
 * The other beavers in a small shared space (the summit, a cabin): they walk where the server
 * says, wave and hop when they emote, and say things in speech bubbles. The village has its own,
 * much richer version of this in `HubScene`.
 */
export class Others {
  private list = new Map<string, Other>();
  private time = 0;

  constructor(private ctx: Ctx, private labels: HTMLElement, players: PlayerInfo[] = []) {
    for (const p of players) this.add(p);
  }

  get size() {
    return this.list.size;
  }

  has(id: string) {
    return this.list.has(id);
  }

  private add(p: PlayerInfo) {
    if (p.id === this.ctx.state.you || this.list.has(p.id)) return;
    const tag = h("div.tag", {}, [p.club ? h("span.clubtag", { style: { background: p.club.color } }, p.club.tag) : null, p.name]);
    this.labels.append(tag);
    this.list.set(p.id, {
      id: p.id, name: p.name, look: p.look, x: p.x, z: p.z, ry: p.ry, tx: p.x, tz: p.z, tr: p.ry,
      walk: 0, moving: 0, jumpT: 0, waveT: 1.2, cheerT: 0, talkT: 0, expr: "happy", exprT: 1.2,
      seed: [...p.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 1000, 7) / 100,
      tag, bubble: null, bubbleUntil: 0, track: newTrack(p.x, p.z),
    });
  }

  private remove(id: string) {
    const o = this.list.get(id);
    if (!o) return;
    o.tag.remove();
    o.bubble?.remove();
    this.list.delete(id);
  }

  /** Handles the presence messages. Returns true if `m` was one of them. */
  handle(m: ServerMsg): boolean {
    switch (m.t) {
      case "joined":
        this.add(m.p);
        return true;
      case "left":
        this.remove(m.id);
        return true;
      case "state":
        for (const [id, x, z, ry] of m.p) {
          const o = this.list.get(id);
          if (o) { o.tx = x; o.tz = z; o.tr = ry; pushSample(o.track, x, z, undefined, m.ts); }
        }
        return true;
      case "look": {
        const o = this.list.get(m.id);
        if (o) o.look = m.look;
        return !!o;
      }
      case "chat": {
        const o = this.list.get(m.id);
        if (!o) return false;
        o.bubble?.remove();
        o.bubble = h("div.bubble", {}, m.text);
        this.labels.append(o.bubble);
        o.bubbleUntil = this.time + 5;
        o.talkT = Math.min(2.2, 0.6 + m.text.length * 0.05);
        return true;
      }
      case "emote": {
        const o = this.list.get(m.id);
        if (!o) return false;
        const react = emoteReaction(m.i);
        o.expr = react.expr;
        o.exprT = 2.2;
        if (react.hop) o.jumpT = 1;
        if (react.wave) o.waveT = 1.6;
        if (react.cheer) o.cheerT = 1.8;
        const el = h("div.emote", {}, EMOTES[m.i] ?? "");
        el.style.left = o.tag.style.left;
        el.style.top = o.tag.style.top;
        this.labels.append(el);
        setTimeout(() => el.remove(), 1600);
        return true;
      }
    }
    return false;
  }

  update(dt: number) {
    this.time += dt;
    for (const o of this.list.values()) {
      // Drawn slightly in the past, sliding evenly between server updates (see smoothing.ts).
      const px = o.x, pz = o.z;
      const p = sampleAt(o.track);
      o.x = p.x; o.z = p.z;
      const d = Math.hypot(o.x - px, o.z - pz) / Math.max(dt, 1e-4) * 0.05;
      o.ry = lerpAngle(o.ry, o.tr, Math.min(1, dt * 12));
      o.moving = lerp(o.moving, d > 0.05 ? 1 : 0, Math.min(1, dt * 8));
      o.walk += dt * 11 * o.moving;
      o.jumpT = Math.max(0, o.jumpT - dt * 2.2);
      o.waveT = Math.max(0, o.waveT - dt);
      o.cheerT = Math.max(0, o.cheerT - dt);
      o.talkT = Math.max(0, o.talkT - dt);
      o.exprT = Math.max(0, o.exprT - dt);
      if (o.bubble && this.time > o.bubbleUntil) { o.bubble.remove(); o.bubble = null; }
    }
  }

  /** Draws everyone, standing on `groundY`. `shadow` draws a blob under each beaver. */
  draw(r: Renderer, groundY: (x: number, z: number) => number, shadow?: (x: number, y: number, z: number) => void) {
    for (const o of this.list.values()) {
      const y = groundY(o.x, o.z);
      shadow?.(o.x, y, o.z);
      drawBeaver(r, getBeaverMeshes(r, o.look), compose(o.x, y, o.z, o.ry), {
        walk: o.walk, moving: o.moving, swim: 0, sled: 0, time: this.time, seed: o.seed,
        jump: o.jumpT > 0 ? Math.sin(o.jumpT * Math.PI) : 0,
        wave: Math.min(1, o.waveT), cheer: Math.min(1, o.cheerT), talk: o.talkT > 0 ? 1 : 0,
        expr: o.exprT > 0 ? o.expr : "neutral",
      });
    }
  }

  /** Moves name tags and bubbles over their beavers (call after the frame is drawn). */
  placeLabels(r: Renderer, groundY: (x: number, z: number) => number, hidden = false) {
    for (const o of this.list.values()) {
      const y = groundY(o.x, o.z);
      const s = hidden ? null : r.project(o.x, y + 2.75, o.z);
      for (const [el, lift] of [[o.tag, 0], [o.bubble, 26]] as const) {
        if (!el) continue;
        el.style.display = s ? "" : "none";
        if (s) { el.style.left = `${s.x}px`; el.style.top = `${s.y - lift}px`; }
      }
    }
  }

  dispose() {
    for (const id of [...this.list.keys()]) this.remove(id);
  }
}

/** A chat box for the small shared spaces: Enter to focus, Enter again to send. */
export function chatBar(ctx: Ctx): { el: HTMLElement; focus: () => void } {
  const input = h("input.field.pe", { placeholder: "Say something nice…", maxLength: 120, enterKeyHint: "send" }) as HTMLInputElement;
  const send = () => {
    const text = input.value.trim();
    if (text) ctx.net.send({ t: "chat", text });
    input.value = "";
    input.blur();
  };
  input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") send();
    if (e.key === "Escape") input.blur();
  });
  return { el: h("div.chatbar", {}, [input, h("button.btn.pe", { onclick: send }, "Send")]), focus: () => input.focus() };
}
