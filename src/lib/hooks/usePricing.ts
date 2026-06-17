"use client";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { PricingSettings } from "@/types/pricing";
import {
  PASS_PRICES as FALLBACK_PASS,
  PACKAGE_PRICES as FALLBACK_PACKAGE,
  SWIM_COURSE_PRICE as FALLBACK_COURSE,
  SINGLE_TICKET_PRICES as FALLBACK_SINGLE,
} from "@/lib/constants";

// Đọc bảng giá realtime từ /settings/pricing.
// Nếu doc chưa tồn tại (chưa seed), dùng giá hardcode trong constants.ts để app vẫn chạy.
export function usePricing() {
  const [pricing, setPricing] = useState<PricingSettings>({
    pass: FALLBACK_PASS,
    package: FALLBACK_PACKAGE,
    swimCourse: FALLBACK_COURSE,
    singleTicket: FALLBACK_SINGLE,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings/pricing"), (snap) => {
      if (snap.exists()) setPricing(snap.data() as PricingSettings);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  return { pricing, loading };
}
