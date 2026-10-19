import { createHmac, randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { NAME_MAX } from "@beaver/shared";

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export function validateUsername(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const n = name.trim();
  return /^[A-Za-z0-9_]{3,}$/.test(n) && n.length <= NAME_MAX ? n : null;
}

export function validatePassword(pw: unknown): pw is string {
  return typeof pw === "string" && pw.length >= 8 && pw.length <= 128;
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 32);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [algo, saltHex, keyHex] = stored.split("$");
  if (algo !== "scrypt" || !saltHex || !keyHex) return false;
  const key = await scrypt(pw, Buffer.from(saltHex, "hex"), 32);
  const expected = Buffer.from(keyHex, "hex");
  return expected.length === key.length && timingSafeEqual(expected, key);
}

/** Minimal signed session token: base64url(userId.expiry).signature */
export function signSession(userId: string, secret: string, ttlS = 60 * 60 * 24 * 30, now = Date.now()): string {
  const body = Buffer.from(`${userId}.${Math.floor(now / 1000) + ttlS}`).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySession(token: string, secret: string, now = Date.now()): string | null {
  const [body, sig] = String(token).split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  const [userId, exp] = Buffer.from(body, "base64url").toString().split(".");
  if (!userId || Number(exp) * 1000 < now) return null;
  return userId;
}
