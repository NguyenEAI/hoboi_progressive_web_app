"use client";

// v2.4.2 — Lắng nghe /users/{uid}/notifications realtime → show toast trên MỌI màn hình.
// Mount 1 lần ở root layout. Chỉ trigger toast cho notification có createdAt > session start.

import { useEffect, useRef } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { useToast } from "@/components/Toast";
import { toDate } from "@/lib/utils";

const TOAST_KIND_MAP: Record<string, "success" | "error" | "info"> = {
  SERVICE_ACTIVATED: "success",
  CHILD_ATTENDED: "success",
  COURSE_COMPLETED: "success",
  COURSE_EXPIRED: "error",
  COURSE_REMAINING: "info",
  EXPIRY_WARNING: "info",
  PENDING_PAYMENT: "info",
  COACH_OFF: "error",
  GENERAL: "info",
};

export function NotificationListener() {
  const { profile } = useAuthUser();
  const toast = useToast();
  const sessionStartRef = useRef<number>(Date.now());
  const seenIdsRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);

  useEffect(() => {
    if (!profile) return;
    sessionStartRef.current = Date.now();
    seenIdsRef.current = new Set();
    firstLoadRef.current = true;

    const q = query(
      collection(db, `users/${profile.id}/notifications`),
      orderBy("createdAt", "desc"),
    );
    return onSnapshot(
      q,
      (snap) => {
        // Lần load đầu: chỉ mark id đã thấy, không spam toast các noti cũ
        if (firstLoadRef.current) {
          for (const d of snap.docs) seenIdsRef.current.add(d.id);
          firstLoadRef.current = false;
          return;
        }
        // Các noti mới (id chưa từng thấy + createdAt > session start)
        for (const d of snap.docs) {
          if (seenIdsRef.current.has(d.id)) continue;
          seenIdsRef.current.add(d.id);
          const data = d.data();
          const created = toDate(data.createdAt).getTime();
          if (Number.isNaN(created) || created < sessionStartRef.current) continue;
          const kind = TOAST_KIND_MAP[data.type as string] ?? "info";
          const text = `${data.title ?? "Thông báo"}${data.body ? " · " + data.body : ""}`;
          toast.show(text, kind);
        }
      },
      (e) => console.warn("[NotificationListener] error:", e),
    );
  }, [profile, toast]);

  return null;
}
