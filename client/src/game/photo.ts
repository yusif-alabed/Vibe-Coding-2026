import type { Vec3 } from "../engine/math";
import { h, toast } from "../ui/dom";
import { fillSpriteText } from "../ui/sprites";
import type { Expression } from "./beaver";
import type { Ctx } from "./scene";

/**
 * Photo mode: hides the HUD, frees the camera (orbit, tilt, zoom), lets your beaver hold a pose,
 * adds a colour filter and an optional postcard frame, then snaps the picture to a downloadable image.
 * Scenes call update() each frame, use camera() for the view, pose() for their own beaver,
 * and afterRender() right after the renderer has finished the frame.
 */

export const PHOTO_FILTERS: { name: string; css: string }[] = [
  { name: "Natural", css: "none" },
  { name: "Golden", css: "sepia(.25) saturate(1.3) brightness(1.05) contrast(1.04) hue-rotate(-6deg)" },
  { name: "Film", css: "contrast(1.12) saturate(.82) sepia(.2) brightness(1.03)" },
  { name: "Vivid", css: "saturate(1.6) contrast(1.1)" },
  { name: "Mono", css: "grayscale(1) contrast(1.18) brightness(1.06)" },
  { name: "Dreamy", css: "brightness(1.12) saturate(1.25) contrast(.88) blur(.5px)" },
];

export interface PhotoPose { expr: Expression; wave: number; cheer: number; jump: number; label: string }

const POSES: { label: string; make: (t: number) => Omit<PhotoPose, "label"> }[] = [
  { label: "🙂 Smile", make: () => ({ expr: "happy", wave: 0, cheer: 0, jump: 0 }) },
  { label: "👋 Wave", make: () => ({ expr: "happy", wave: 1, cheer: 0, jump: 0 }) },
  { label: "🙌 Cheer", make: () => ({ expr: "excited", wave: 0, cheer: 1, jump: 0 }) },
  { label: "🦘 Mid-hop", make: () => ({ expr: "excited", wave: 0, cheer: 0.6, jump: 0.85 }) },
  { label: "😮 Surprised", make: () => ({ expr: "surprised", wave: 0, cheer: 0, jump: 0 }) },
  { label: "😎 Cool", make: () => ({ expr: "determined", wave: 0, cheer: 0, jump: 0 }) },
];

export class PhotoMode {
  active = false;
  private yaw = 0;
  private pitch = 0.22;
  private dist = 7;
  private lift = 0;
  private filter = 1;
  private frame = true;
  private poseIdx = 1;
  private compact = false;
  private caption = "";
  private el: HTMLElement | null = null;
  private shot = false;
  private modal: HTMLElement | null = null;

  constructor(
    private ctx: Ctx,
    private hud: HTMLElement,
    private opts: { place: () => string; onShot: () => void; minDist?: number; maxDist?: number; maxPitch?: number },
  ) {}

  open(yaw: number, dist = 7) {
    if (this.active) return;
    this.active = true;
    this.yaw = yaw;
    this.dist = Math.max(this.opts.minDist ?? 2.5, Math.min(this.opts.maxDist ?? 22, dist));
    this.pitch = 0.22;
    this.lift = 0;
    this.caption = this.opts.place();
    this.hud.style.visibility = "hidden";
    this.build();
    this.applyFilter();
    window.addEventListener("keydown", this.onKey);
  }

  close() {
    if (!this.active) return;
    this.active = false;
    this.hud.style.visibility = "";
    this.el?.remove();
    this.el = null;
    this.modal?.remove();
    this.modal = null;
    this.ctx.r.canvas.style.filter = "";
    window.removeEventListener("keydown", this.onKey);
  }

  private onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === "INPUT") return;
    if (e.key === "Escape") { e.stopImmediatePropagation(); this.modal ? this.closeModal() : this.close(); }
    if (e.key === " " || e.key.toLowerCase() === "p") { e.preventDefault(); this.snap(); }
  };

  private build() {
    const chips = <T,>(items: T[], label: (t: T) => string, isOn: (i: number) => boolean, pick: (i: number) => void) =>
      h("div.photo-chips", {}, items.map((it, i) => h("button.tab" + (isOn(i) ? ".on" : ""), { onclick: () => { pick(i); this.build(); } }, label(it))));
    const caption = h("input.field", { value: this.caption, maxLength: 40, placeholder: "Caption" }) as HTMLInputElement;
    caption.addEventListener("input", () => { this.caption = caption.value; });
    caption.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") caption.blur(); });
    const panel = h("div.photo-ui", {}, [
      h("div.photo-top.pe", {}, [
        h("div.pill", {}, "📷 Photo mode"),
        h("div.photo-tip", {}, "Drag to orbit · scroll to zoom · ▲▼ to tilt"),
        h("button.btn.cream.small", { onclick: () => this.close() }, "✕ Exit"),
      ]),
      this.frame ? h("div.photo-frame-guide") : null,
      h("div.card.photo-bar.pe" + (this.compact ? ".compact" : ""), {}, this.compact ? [
        h("div.photo-row.cam", {}, [
          h("button.btn.cream.small", { onclick: () => { this.compact = false; this.build(); } }, "▴ Pose & filters"),
          h("button.btn.orange.shutter", { title: "Take photo (Space)", onclick: () => this.snap() }, "📸 Snap!"),
        ]),
      ] : [
        h("div.photo-row", {}, [h("b", {}, "Pose"), chips(POSES, (p) => p.label, (i) => i === this.poseIdx, (i) => { this.poseIdx = i; })]),
        h("div.photo-row", {}, [h("b", {}, "Filter"), chips(PHOTO_FILTERS, (f) => f.name, (i) => i === this.filter, (i) => { this.filter = i; this.applyFilter(); })]),
        h("div.photo-row", {}, [
          h("b", {}, "Frame"),
          h("button.tab" + (this.frame ? ".on" : ""), { onclick: () => { this.frame = !this.frame; this.build(); } }, this.frame ? "🖼️ Postcard" : "None"),
          this.frame ? caption : null,
        ]),
        h("div.photo-row.cam", {}, [
          h("button.btn.cream.small", { title: "Tilt up", onclick: () => { this.pitch = Math.min(this.opts.maxPitch ?? 1.2, this.pitch + 0.12); } }, "▲"),
          h("button.btn.cream.small", { title: "Tilt down", onclick: () => { this.pitch = Math.max(-0.05, this.pitch - 0.12); } }, "▼"),
          h("button.btn.cream.small", { title: "Closer", onclick: () => { this.dist = Math.max(this.opts.minDist ?? 2.5, this.dist - 1); } }, "＋"),
          h("button.btn.cream.small", { title: "Further", onclick: () => { this.dist = Math.min(this.opts.maxDist ?? 22, this.dist + 1); } }, "－"),
          h("button.btn.cream.small", { title: "Hide options", onclick: () => { this.compact = true; this.build(); } }, "▾ Hide"),
          h("button.btn.orange.shutter", { title: "Take photo (Space)", onclick: () => this.snap() }, "📸 Snap!"),
        ]),
      ]),
    ]);
    if (this.el) this.el.replaceWith(panel);
    else this.ctx.ui.append(panel);
    this.el = panel;
  }

  private applyFilter() {
    const f = PHOTO_FILTERS[this.filter].css;
    this.ctx.r.canvas.style.filter = f === "none" ? "" : f;
  }

  /** Orbit controls. Call once per frame while active. */
  update(dt: number) {
    const inp = this.ctx.input;
    this.yaw -= inp.consumeDrag() * 0.006;
    this.pitch = Math.max(-0.05, Math.min(this.opts.maxPitch ?? 1.2, this.pitch + inp.consumeDragY() * 0.005));
    this.dist = Math.max(this.opts.minDist ?? 2.5, Math.min(this.opts.maxDist ?? 22, this.dist + inp.consumeZoom() * 0.7));
    inp.consumeTap();
    if (inp.down("q", "arrowleft", "a")) this.yaw += dt * 1.5;
    if (inp.down("e", "arrowright", "d")) this.yaw -= dt * 1.5;
    if (inp.down("w", "arrowup")) this.pitch = Math.min(this.opts.maxPitch ?? 1.2, this.pitch + dt * 0.8);
    if (inp.down("s", "arrowdown")) this.pitch = Math.max(-0.05, this.pitch - dt * 0.8);
    if (inp.down("r")) this.lift = Math.min(3, this.lift + dt * 2);
    if (inp.down("f")) this.lift = Math.max(-0.8, this.lift - dt * 2);
  }

  /** Camera orbiting the given focus point (usually your beaver's chest). */
  camera(focus: Vec3): { eye: Vec3; target: Vec3 } {
    const c = Math.cos(this.pitch);
    const target: Vec3 = [focus[0], focus[1] + this.lift - (this.compact ? 0.15 : 0.55) * Math.min(1, this.dist / 6), focus[2]];
    return {
      eye: [target[0] + Math.sin(this.yaw) * c * this.dist, target[1] + Math.sin(this.pitch) * this.dist, target[2] + Math.cos(this.yaw) * c * this.dist],
      target,
    };
  }

  pose(): PhotoPose {
    const p = POSES[this.poseIdx];
    return { ...p.make(0), label: p.label };
  }

  snap() {
    if (!this.active || this.modal) return;
    this.shot = true;
  }

  /** Must be called right after the renderer finishes the frame, so the canvas still holds the picture. */
  afterRender() {
    if (!this.shot) return;
    this.shot = false;
    let url: string;
    try {
      url = this.capture();
    } catch (e) {
      console.error(e);
      toast(this.ctx.ui, "Couldn't save that photo on this device.");
      return;
    }
    this.ctx.sound.play("shutter");
    const flash = h("div.photo-flash");
    this.ctx.ui.append(flash);
    setTimeout(() => flash.remove(), 600);
    this.opts.onShot();
    this.showModal(url);
  }

  private capture(): string {
    const src = this.ctx.r.canvas;
    const scale = Math.min(1, 1920 / src.width);
    const w = Math.round(src.width * scale), hgt = Math.round(src.height * scale);
    const pad = this.frame ? Math.round(Math.min(w, hgt) * 0.045) : 0;
    const bottom = this.frame ? Math.round(Math.min(w, hgt) * 0.16) : 0;
    const out = document.createElement("canvas");
    out.width = w + pad * 2;
    out.height = hgt + pad + bottom + (this.frame ? pad : 0);
    const g = out.getContext("2d")!;
    if (this.frame) {
      const grad = g.createLinearGradient(0, 0, out.width, out.height);
      grad.addColorStop(0, "#fffdf6");
      grad.addColorStop(1, "#f6e8cb");
      g.fillStyle = grad;
      g.fillRect(0, 0, out.width, out.height);
    }
    const f = PHOTO_FILTERS[this.filter].css;
    if (f !== "none" && "filter" in g) g.filter = f;
    g.drawImage(src, pad, pad, w, hgt);
    g.filter = "none";
    if (this.frame) {
      // Soft vignette inside the photo, then a thin ink edge.
      const v = g.createRadialGradient(pad + w / 2, pad + hgt / 2, Math.min(w, hgt) * 0.45, pad + w / 2, pad + hgt / 2, Math.max(w, hgt) * 0.72);
      v.addColorStop(0, "rgba(40,20,10,0)");
      v.addColorStop(1, "rgba(40,20,10,0.28)");
      g.fillStyle = v;
      g.fillRect(pad, pad, w, hgt);
      g.strokeStyle = "#3b251b";
      g.lineWidth = Math.max(2, w / 500);
      g.strokeRect(pad, pad, w, hgt);
      const size = Math.round(bottom * 0.36);
      g.fillStyle = "#3b251b";
      g.textBaseline = "middle";
      g.font = `700 ${size}px Fredoka, "Baloo 2", ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif`;
      fillSpriteText(g, this.caption.trim() || "Beaver Banff", pad * 1.4, hgt + pad + bottom * 0.52, size);
      g.font = `700 ${Math.round(size * 0.55)}px Nunito, ui-rounded, system-ui, sans-serif`;
      g.textAlign = "right";
      g.fillStyle = "#7a6656";
      const date = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
      fillSpriteText(g, `🦫 Beaver Banff · ${date}`, out.width - pad * 1.4, hgt + pad + bottom * 0.55, Math.round(size * 0.55));
    }
    return out.toDataURL("image/jpeg", 0.92);
  }

  private showModal(url: string) {
    const name = `beaver-banff-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}.jpg`;
    const share = async () => {
      try {
        const blob = await (await fetch(url)).blob();
        const file = new File([blob], name, { type: "image/jpeg" });
        const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
        if (nav.share && nav.canShare?.({ files: [file] })) await nav.share({ files: [file], title: "Beaver Banff" });
        else toast(this.ctx.ui, "Sharing isn't available here — use Save instead.");
      } catch { /* cancelled */ }
    };
    this.modal = h("div.overlay.pe", { style: "z-index:6", onclick: (e: Event) => { if (e.target === this.modal) this.closeModal(); } }, h("div.card.photo-result", {}, [
      h("h2", {}, "Nice shot! 📸"),
      h("img", { src: url, alt: "Your photo" }),
      h("div.row", { style: "justify-content:center;flex-wrap:wrap" }, [
        h("a.btn.gold", { href: url, download: name, style: "text-decoration:none" }, "⬇️ Save photo"),
        "share" in navigator ? h("button.btn", { onclick: share }, "📤 Share") : null,
        h("button.btn.cream", { onclick: () => this.closeModal() }, "📷 Take another"),
        h("button.btn.cream", { onclick: () => this.close() }, "Done"),
      ]),
      h("div.hint", {}, "Tip: you can also right-click or long-press the picture to save it."),
    ]));
    this.ctx.ui.append(this.modal);
  }

  private closeModal() {
    this.modal?.remove();
    this.modal = null;
  }

  dispose() {
    this.close();
  }
}
