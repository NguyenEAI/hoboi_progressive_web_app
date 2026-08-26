import assert from "node:assert/strict";
import test from "node:test";
import {
  SESSION_ACTIVITY_WRITE_INTERVAL_MS,
  SESSION_IDLE_LIMIT_MS,
  clearLastActive,
  isSessionIdleExpired,
  readLastActive,
  sessionActivityKey,
  shouldRefreshLastActive,
  writeLastActive,
} from "../../src/lib/authSession";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) { return values.get(key) ?? null; },
    setItem(key: string, value: string) { values.set(key, value); },
    removeItem(key: string) { values.delete(key); },
  };
}

test("stores last activity per account", () => {
  const storage = memoryStorage();
  writeLastActive("user-a", 1234, storage);
  writeLastActive("user-b", 5678, storage);
  assert.equal(readLastActive("user-a", storage), 1234);
  assert.equal(readLastActive("user-b", storage), 5678);
  clearLastActive("user-a", storage);
  assert.equal(readLastActive("user-a", storage), null);
  assert.equal(sessionActivityKey("user-b").includes("user-b"), true);
});

test("expires only after more than 15 days idle", () => {
  const now = 2_000_000_000_000;
  assert.equal(isSessionIdleExpired(null, now), false);
  assert.equal(isSessionIdleExpired(now - SESSION_IDLE_LIMIT_MS, now), false);
  assert.equal(isSessionIdleExpired(now - SESSION_IDLE_LIMIT_MS - 1, now), true);
});

test("throttles activity writes to once per minute", () => {
  const now = 2_000_000_000_000;
  assert.equal(shouldRefreshLastActive(now, now + SESSION_ACTIVITY_WRITE_INTERVAL_MS - 1), false);
  assert.equal(shouldRefreshLastActive(now, now + SESSION_ACTIVITY_WRITE_INTERVAL_MS), true);
});
