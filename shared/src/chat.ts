import { CHAT } from "./constants";

/**
 * Chat safety: a word filter that sees through simple disguises (l33t, repeated letters, dots),
 * plus a block on sharing personal info (emails, phone numbers, links).
 * The word list is intentionally short; extend it in one place.
 */
const BLOCKED_WORDS = [
  "damn", "hell", "crap", "stupid", "idiot", "dumb", "loser", "shut up", "hate you",
  "kill", "die", "ugly", "fat", "sucks", "wtf", "stfu",
];

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s", "!": "i" };

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[013457@$!]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-z ]/g, "")
    .replace(/(.)\1{2,}/g, "$1$1");
}

const PERSONAL_INFO = [
  /[\w.+-]+@[\w-]+\.[\w.]+/, // email
  /(\+?\d[\s-]?){7,}/, // phone-ish digit runs
  /(https?:\/\/|www\.)\S+/i, // links
];

export type FilterResult = { ok: true; text: string } | { ok: false; reason: "empty" | "too_long" | "personal_info" };

export function filterChat(raw: string): FilterResult {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return { ok: false, reason: "empty" };
  if (text.length > CHAT.maxLength) return { ok: false, reason: "too_long" };
  if (PERSONAL_INFO.some((re) => re.test(text))) return { ok: false, reason: "personal_info" };
  // Replace each blocked word (checked against a normalized copy, word by word) with stars.
  const words = text.split(" ");
  const out = words.map((w) => {
    const n = normalize(w);
    return BLOCKED_WORDS.some((b) => !b.includes(" ") && n === b) ? "★".repeat(Math.max(3, w.length)) : w;
  });
  let joined = out.join(" ");
  // Multi-word phrases.
  const norm = normalize(joined);
  for (const phrase of BLOCKED_WORDS.filter((b) => b.includes(" "))) {
    if (norm.includes(phrase)) joined = "★★★";
  }
  return { ok: true, text: joined };
}

/** Per-player token bucket + duplicate detection. One instance per player on the server. */
export class ChatRateLimiter {
  private tokens: number = CHAT.burst;
  private last: number;
  private lastText = "";
  private lastTextAt = -Infinity;

  constructor(now = Date.now()) {
    this.last = now;
  }

  /** Returns true if the message may be sent. */
  allow(text: string, now = Date.now()): boolean {
    const refill = (now - this.last) / CHAT.refillMs;
    this.tokens = Math.min(CHAT.burst, this.tokens + refill);
    this.last = now;
    const lower = text.toLowerCase().trim();
    if (lower === this.lastText && now - this.lastTextAt < CHAT.duplicateWindowMs) return false;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    this.lastText = lower;
    this.lastTextAt = now;
    return true;
  }
}

/** Predefined messages: always safe, still rate limited. */
export const QUICK_CHAT = [
  "Hi there! 👋",
  "Want to be friends?",
  "Race you down the hill! 🛷",
  "Nice hat!",
  "Follow me!",
  "Meet at the lodge ☕",
  "GG! Good game!",
  "See you later! 🦫",
] as const;

export const EMOTES = ["👋", "😄", "❤️", "🎉", "😮", "🦫", "🌲", "⛄", "💃"] as const;
