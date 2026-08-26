import type { User } from "firebase/auth";

export const SESSION_IDLE_LIMIT_MS = 15 * 24 * 60 * 60 * 1000;
export const SESSION_ACTIVITY_WRITE_INTERVAL_MS = 60 * 1000;

const LAST_ACTIVE_PREFIX = "hoboi-auth-last-active:";

export function sessionActivityKey(uid: string) {
  return `${LAST_ACTIVE_PREFIX}${uid}`;
}

export function readLastActive(uid: string, storage: Pick<Storage, "getItem"> = window.localStorage) {
  const raw = storage.getItem(sessionActivityKey(uid));
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function writeLastActive(
  uid: string,
  now = Date.now(),
  storage: Pick<Storage, "setItem"> = window.localStorage,
) {
  storage.setItem(sessionActivityKey(uid), String(now));
}

export function clearLastActive(uid: string, storage: Pick<Storage, "removeItem"> = window.localStorage) {
  storage.removeItem(sessionActivityKey(uid));
}

export function isSessionIdleExpired(lastActive: number | null, now = Date.now()) {
  return lastActive !== null && now - lastActive > SESSION_IDLE_LIMIT_MS;
}

export function shouldRefreshLastActive(lastWritten: number, now = Date.now()) {
  return now - lastWritten >= SESSION_ACTIVITY_WRITE_INTERVAL_MS;
}

export function isPersistentAppUser(user: User) {
  return !user.isAnonymous;
}
