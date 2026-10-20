import type { Ctx } from "../game/scene";
import { savePrefs, type Prefs } from "../prefs";
import { h, toast } from "./dom";

/**
 * Shared overlay panels: ⚙️ Settings (sound, graphics, time of day, controls, your codes)
 * and 👥 Friends (friends list, friend codes, parties).
 */

function overlay(root: HTMLElement, onClose: () => void, ...children: HTMLElement[]) {
  const el = h("div.overlay.pe", { onclick: (e: Event) => { if (e.target === el) onClose(); } }, children);
  root.append(el);
  return el;
}

function segmented<T extends string>(value: T, options: [T, string][], pick: (v: T) => void) {
  const wrap = h("div.tabs", { style: "padding:0" });
  const draw = (v: T) => wrap.replaceChildren(...options.map(([k, label]) => h("button.tab" + (k === v ? ".on" : ""), { onclick: () => { pick(k); draw(k); } }, label)));
  draw(value);
  return wrap;
}

function slider(label: string, value: number, onInput: (v: number) => void) {
  const input = h("input", { type: "range", min: "0", max: "100", value: String(Math.round(value * 100)) }) as HTMLInputElement;
  input.addEventListener("input", () => onInput(Number(input.value) / 100));
  return h("label.setting", {}, [h("span", {}, label), input]);
}

function copyText(root: HTMLElement, text: string) {
  try {
    void navigator.clipboard?.writeText(text);
    toast(root, "Copied! 📋");
  } catch {
    toast(root, text, 6000);
  }
}

export function openSettings(ctx: Ctx, root: HTMLElement, onChange: () => void): HTMLElement {
  const close = () => el.remove();
  const p = ctx.prefs;
  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => {
    p[k] = v;
    savePrefs(p);
    ctx.r.quality = p.graphics;
    onChange();
  };
  const s = ctx.sound.settings;
  const acct = ctx.state.account;
  const solo = !acct;
  const codeBox = (title: string, value: string, hint: string) => h("div.codebox", {}, [
    h("div", {}, [h("b", {}, title), h("div.hint", { style: "margin:2px 0 0" }, hint)]),
    h("button.btn.small.cream", { onclick: () => copyText(root, value) }, [h("code", {}, value), " 📋"]),
  ]);
  const el = overlay(root, close, h("div.card.panel.settings", {}, [
    h("header", {}, [h("h2", {}, "⚙️ Settings"), h("button.btn.cream.small", { onclick: close }, "✕")]),
    h("div.settings-body", {}, [
      h("h3", {}, "🔊 Sound"),
      slider("Music", s.music, (v) => { s.music = v; ctx.sound.apply(); }),
      slider("Sound effects", s.sfx, (v) => { s.sfx = v; ctx.sound.apply(); ctx.sound.play("click"); }),
      slider("Nature sounds", s.ambience, (v) => { s.ambience = v; ctx.sound.apply(); }),
      h("h3", {}, "🎨 Graphics"),
      segmented(p.graphics, [["high", "✨ Beautiful"], ["low", "⚡ Fast (older phones)"]], (v) => set("graphics", v)),
      h("h3", {}, "🌗 Time of day"),
      segmented(p.time, [["auto", "🔄 Real cycle"], ["golden", "🌅 Golden hour"], ["day", "☀️ Day"], ["night", "🌙 Night"]], (v) => set("time", v)),
      h("h3", {}, "🕹️ Touch joystick"),
      segmented(p.joystick, [["auto", "Auto"], ["on", "On"], ["off", "Off"]], (v) => set("joystick", v)),
      h("h3", {}, "💾 Your beaver"),
      solo
        ? h("div.hint", {}, "Solo progress is saved in this browser. Play online to get a recovery code for other devices.")
        : h("div", {}, [
            codeBox("Friend code", acct.friendCode, "Share it so friends can add you."),
            codeBox("Recovery code", acct.recoveryCode, "Keep it secret! Enter it on another device to bring your beaver along."),
          ]),
    ]),
  ]));
  return el;
}

export function openFriends(ctx: Ctx, root: HTMLElement): { el: HTMLElement; refresh: () => void } {
  const close = () => el.remove();
  const body = h("div.settings-body");
  const code = h("input.field", { placeholder: "Friend code", maxLength: 6, style: "text-transform:uppercase" }) as HTMLInputElement;
  code.addEventListener("keydown", (e) => e.stopPropagation());
  const refresh = () => {
    const st = ctx.state;
    const party = st.party;
    const inParty = party.members.length > 0;
    const me = st.account?.pid;
    body.replaceChildren(
      h("h3", {}, "🎉 Party"),
      inParty
        ? h("div", {}, [
            ...party.members.map((m) => h("div.friend", {}, [
              h("span.dot" + (m.online ? ".on" : "")),
              h("b", {}, m.name + (m.pid === party.leader ? " 👑" : "") + (m.pid === me ? " (you)" : "")),
            ])),
            h("div.hint", {}, party.leader === me ? "You're the leader: when you join a race, your party comes too!" : "When the leader joins a race, you'll race together."),
            h("button.btn.small.cream", { onclick: () => ctx.net.send({ t: "partyLeave" }) }, "Leave party"),
          ])
        : h("div.hint", {}, "Invite friends to a party to race together. Parties hold up to 4 beavers."),
      h("h3", {}, `🤝 Friends (${st.friends.filter((f) => f.online).length} online)`),
      st.friends.length
        ? h("div", {}, st.friends.slice().sort((a, b) => Number(b.online) - Number(a.online)).map((f) => h("div.friend", {}, [
            h("span.dot" + (f.online ? ".on" : "")),
            h("div", { style: "flex:1;min-width:0" }, [h("b", {}, f.name), h("div.hint", { style: "margin:0" }, f.online ? f.where ?? "Online" : "Offline")]),
            f.online && f.joinable ? h("button.btn.small", { onclick: () => { ctx.net.send({ t: "joinFriend", pid: f.pid }); close(); } }, "Join") : null,
            f.online && !party.members.some((m) => m.pid === f.pid) ? h("button.btn.small.gold", { onclick: () => ctx.net.send({ t: "partyInvite", pid: f.pid }) }, "🎉 Party") : null,
            h("button.btn.small.cream", { title: "Remove friend", onclick: () => ctx.net.send({ t: "friendRemove", pid: f.pid }) }, "✕"),
          ])))
        : h("div.hint", {}, "No friends yet — tap another beaver and choose 🤝 Add friend, or enter their friend code below."),
      h("h3", {}, "➕ Add by friend code"),
      h("div.row", {}, [code, h("button.btn.small", { onclick: () => { if (code.value.trim()) ctx.net.send({ t: "friendRequest", code: code.value.trim() }); code.value = ""; } }, "Send")]),
      st.account ? h("div.hint", {}, ["Your friend code: ", h("b", {}, st.account.friendCode)]) : h("div.hint", {}, "In solo mode the bot beavers are happy to be your friends!"),
    );
  };
  refresh();
  const el = overlay(root, close, h("div.card.panel.settings", {}, [
    h("header", {}, [h("h2", {}, "👥 Friends"), h("button.btn.cream.small", { onclick: close }, "✕")]),
    body,
  ]));
  return { el, refresh };
}
