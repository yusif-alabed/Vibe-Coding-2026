/** Keyboard + pointer/touch input. Works with mouse, trackpad and phones. */
export class Input {
  keys = new Set<string>();
  /** Accumulated camera drag since last read (pixels). */
  dragX = 0;
  zoom = 0;
  /** Last tap (not drag) in canvas CSS pixels. */
  tap: { x: number; y: number } | null = null;
  /** For the race: -1..1 from holding the left/right half of the screen. */
  touchSteer = 0;
  private pointers = new Map<number, { x: number; y: number; sx: number; sy: number; moved: boolean }>();

  constructor(private el: HTMLElement) {
    window.addEventListener("keydown", (e) => {
      if (isTyping(e)) return;
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener("blur", () => this.keys.clear());
    el.addEventListener("pointerdown", (e) => {
      el.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false });
      this.updateTouchSteer();
    });
    el.addEventListener("pointermove", (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      p.x = e.clientX;
      p.y = e.clientY;
      if (Math.hypot(p.x - p.sx, p.y - p.sy) > 8) p.moved = true;
      if (p.moved) this.dragX += dx;
      this.updateTouchSteer();
    });
    const end = (e: PointerEvent) => {
      const p = this.pointers.get(e.pointerId);
      if (p && !p.moved) {
        const r = el.getBoundingClientRect();
        this.tap = { x: e.clientX - r.left, y: e.clientY - r.top };
      }
      this.pointers.delete(e.pointerId);
      this.updateTouchSteer();
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("wheel", (e) => {
      this.zoom += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private updateTouchSteer() {
    let s = 0;
    const w = this.el.clientWidth;
    for (const p of this.pointers.values()) s += p.x < w / 2 ? -1 : 1;
    this.touchSteer = Math.max(-1, Math.min(1, s));
  }

  down(...names: string[]) {
    return names.some((n) => this.keys.has(n));
  }

  consumeDrag() {
    const d = this.dragX;
    this.dragX = 0;
    return d;
  }
  consumeZoom() {
    const z = this.zoom;
    this.zoom = 0;
    return z;
  }
  consumeTap() {
    const t = this.tap;
    this.tap = null;
    return t;
  }
}

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA");
}
