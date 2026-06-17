"use client";
import { useEffect, useState } from "react";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import type { Coach } from "@/types";

// Tìm hồ sơ HLV gắn với tài khoản đang đăng nhập (coaches.userId == uid)
export function useCoach() {
  const { profile } = useAuthUser();
  const [coach, setCoach] = useState<Coach | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    getDocs(query(collection(db, "coaches"), where("userId", "==", profile.id), limit(1)))
      .then((s) => { setCoach(s.empty ? null : (s.docs[0].data() as Coach)); setLoading(false); });
  }, [profile]);

  return { coach, loading };
}

// Tạo link nhắn Zalo có sẵn nội dung (mở app Zalo / Zalo web)
export function zaloLink(phone: string, text: string): string {
  const p = phone.replace(/\D/g, "").replace(/^84/, "0");
  return `https://zalo.me/${p}?${new URLSearchParams({ body: text }).toString()}`;
}
