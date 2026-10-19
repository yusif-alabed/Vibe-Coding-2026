import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, signSession, validatePassword, validateUsername, verifyPassword, verifySession } from "./auth";

describe("auth", () => {
  it("validates usernames and passwords", () => {
    assert.equal(validateUsername("Maple_42"), "Maple_42");
    assert.equal(validateUsername("ab"), null);
    assert.equal(validateUsername("bad name!"), null);
    assert.equal(validatePassword("short"), false);
    assert.equal(validatePassword("long enough pw"), true);
  });

  it("hashes and verifies passwords", async () => {
    const h = await hashPassword("pinecones!");
    assert.equal(await verifyPassword("pinecones!", h), true);
    assert.equal(await verifyPassword("wrong", h), false);
  });

  it("signs sessions that expire and can't be forged", () => {
    const t = signSession("user-1", "secret", 60, 0);
    assert.equal(verifySession(t, "secret", 1000), "user-1");
    assert.equal(verifySession(t, "other-secret", 1000), null);
    assert.equal(verifySession(t, "secret", 61_000), null);
    assert.equal(verifySession(t.replace(/^./, "x"), "secret", 1000), null);
  });
});
