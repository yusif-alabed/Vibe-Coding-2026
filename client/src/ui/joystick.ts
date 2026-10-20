import { h } from "./dom";

/** On-screen thumbstick for phones and tablets. x/y are -1..1 (y up = forward). */
export class Joystick {
  x = 0;
  y = 0;
  readonly el: HTMLElement;
  private knob: HTMLElement;
  private id: number | null = null;
  private cx = 0;
  private cy = 0;

  constructor(parent: HTMLElement) {
    this.knob = h("div.joy-knob");
    this.el = h("div.joy.pe", {}, this.knob);
    parent.append(this.el);
    const R = 46;
    const move = (e: PointerEvent) => {
      if (e.pointerId !== this.id) return;
      let dx = e.clientX - this.cx, dy = e.clientY - this.cy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
      this.x = dx / R;
      this.y = -dy / R;
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      e.preventDefault();
    };
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.id) return;
      this.id = null;
      this.x = this.y = 0;
      this.knob.style.transform = "";
      this.el.classList.remove("on");
    };
    this.el.addEventListener("pointerdown", (e) => {
      this.id = e.pointerId;
      const r = this.el.getBoundingClientRect();
      this.cx = r.left + r.width / 2;
      this.cy = r.top + r.height / 2;
      this.el.setPointerCapture(e.pointerId);
      this.el.classList.add("on");
      move(e);
      e.preventDefault();
    });
    this.el.addEventListener("pointermove", move);
    this.el.addEventListener("pointerup", end);
    this.el.addEventListener("pointercancel", end);
  }

  dispose() {
    this.el.remove();
  }
}
