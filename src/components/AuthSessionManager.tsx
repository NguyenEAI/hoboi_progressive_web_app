"use client";

import { useEffect } from "react";
import { onAuthStateChanged, signOut, type Unsubscribe } from "firebase/auth";
import { auth, authPersistenceReady } from "@/lib/firebase/client";
import {
  clearLastActive,
  isPersistentAppUser,
  isSessionIdleExpired,
  readLastActive,
  shouldRefreshLastActive,
  writeLastActive,
} from "@/lib/authSession";

export function AuthSessionManager() {
  useEffect(() => {
    let disposed = false;
    let unsubscribeAuth: Unsubscribe | null = null;
    let detachActivity: (() => void) | null = null;

    void authPersistenceReady.then(() => {
      if (disposed) return;

      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        detachActivity?.();
        detachActivity = null;
        if (!user || !isPersistentAppUser(user)) return;

        const now = Date.now();
        const lastActive = readLastActive(user.uid);
        if (isSessionIdleExpired(lastActive, now)) {
          clearLastActive(user.uid);
          await signOut(auth).catch(() => undefined);
          return;
        }

        writeLastActive(user.uid, now);
        let lastWritten = now;
        const markActive = () => {
          const activeAt = Date.now();
          if (!shouldRefreshLastActive(lastWritten, activeAt)) return;
          writeLastActive(user.uid, activeAt);
          lastWritten = activeAt;
        };
        const markVisible = () => {
          if (document.visibilityState === "visible") markActive();
        };

        window.addEventListener("pointerdown", markActive, { passive: true });
        window.addEventListener("keydown", markActive);
        window.addEventListener("touchstart", markActive, { passive: true });
        document.addEventListener("visibilitychange", markVisible);

        detachActivity = () => {
          window.removeEventListener("pointerdown", markActive);
          window.removeEventListener("keydown", markActive);
          window.removeEventListener("touchstart", markActive);
          document.removeEventListener("visibilitychange", markVisible);
        };
      });
    });

    return () => {
      disposed = true;
      detachActivity?.();
      unsubscribeAuth?.();
    };
  }, []);

  return null;
}
