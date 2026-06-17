"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User as FBUser } from "firebase/auth";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import type { User } from "@/types";

// Tạo doc /users/{uid} KHI CHƯA TỒN TẠI. KHÔNG đụng vào doc đã có (giữ role/fullName/v.v.).
// Thay cho Cloud Function onUserCreate (vốn cần Identity Platform).
async function ensureUserDoc(fb: FBUser) {
  const ref = doc(db, "users", fb.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return; // ĐÃ CÓ → không làm gì (tránh ghi đè role)
  await setDoc(ref, {
    id: fb.uid,
    role: "CUSTOMER",
    fullName: fb.displayName ?? "",
    phone: fb.phoneNumber ?? "",
    email: fb.email ?? null,
    fcmTokens: [],
    disabled: false,
    createdAt: serverTimestamp(),
  });
}

export function useAuthUser() {
  const [fbUser, setFbUser] = useState<FBUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setFbUser(u);
      if (!u) { setProfile(null); setLoading(false); return; }
      // Đảm bảo user doc tồn tại (idempotent với merge:true)
      try { await ensureUserDoc(u); } catch { /* rules có thể chặn nếu doc đã tồn tại của người khác — bỏ qua */ }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!fbUser) return;
    const ref = doc(db, "users", fbUser.uid);
    const unsub = onSnapshot(ref, (snap) => {
      setProfile(snap.exists() ? ({ id: snap.id, ...snap.data() } as User) : null);
      setLoading(false);
    });
    return () => unsub();
  }, [fbUser]);

  return { fbUser, profile, loading };
}
