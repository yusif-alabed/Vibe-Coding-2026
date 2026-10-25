import type { ClientMsg, ServerMsg } from "@beaver/shared";

/** Anything that speaks the game protocol: the real WebSocket server, or the offline simulation. */
export interface Net {
  readonly mode: "online" | "offline";
  /** Round-trip time to the server in ms (online only; null until the first answer). */
  readonly rtt?: number | null;
  send(msg: ClientMsg): void;
  onMessage(cb: (msg: ServerMsg) => void): void;
  onClose(cb: () => void): void;
  close(): void;
}

export class OnlineNet implements Net {
  readonly mode = "online" as const;
  private ws: WebSocket;
  private listeners: ((m: ServerMsg) => void)[] = [];
  private closeListeners: (() => void)[] = [];
  private queue: string[] = [];
  private ping: number;
  private pingSentAt = 0;
  /** Smoothed round-trip time in ms, null until the server has answered once. */
  rtt: number | null = null;

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.onopen = () => {
      for (const q of this.queue) this.ws.send(q);
      this.queue = [];
    };
    this.ws.onmessage = (e) => {
      let m: ServerMsg;
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      if (m.t === "pong" && this.pingSentAt) {
        const ms = performance.now() - this.pingSentAt;
        this.pingSentAt = 0;
        this.rtt = this.rtt === null ? ms : this.rtt * 0.7 + ms * 0.3;
      }
      for (const l of this.listeners) l(m);
    };
    this.ws.onclose = () => {
      clearInterval(this.ping);
      for (const l of this.closeListeners) l();
    };
    // Every few seconds: keeps idle connections alive through proxies and measures the ping.
    this.ping = window.setInterval(() => {
      if (this.ws.readyState !== WebSocket.OPEN) return;
      this.pingSentAt = performance.now();
      this.send({ t: "ping" });
    }, 2500);
  }

  send(msg: ClientMsg): void {
    const s = JSON.stringify(msg);
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(s);
    else if (this.ws.readyState === WebSocket.CONNECTING) this.queue.push(s);
  }
  onMessage(cb: (m: ServerMsg) => void) {
    this.listeners.push(cb);
  }
  onClose(cb: () => void) {
    this.closeListeners.push(cb);
  }
  close() {
    this.ws.close();
  }
}
