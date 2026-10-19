import type { ClientMsg, ServerMsg } from "@beaver/shared";

/** Anything that speaks the game protocol: the real WebSocket server, or the offline simulation. */
export interface Net {
  readonly mode: "online" | "offline";
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
      for (const l of this.listeners) l(m);
    };
    this.ws.onclose = () => {
      clearInterval(this.ping);
      for (const l of this.closeListeners) l();
    };
    this.ping = window.setInterval(() => this.send({ t: "ping" }), 20000);
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
