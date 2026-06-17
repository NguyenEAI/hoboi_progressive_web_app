"use client";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { app, db } from "./client";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";

export async function registerFcm(uid: string) {
  if (!(await isSupported())) return;
  const messaging = getMessaging(app);
  const swReg = await navigator.serviceWorker.ready;
  const token = await getToken(messaging, {
    vapidKey: process.env.NEXT_PUBLIC_FB_VAPID_KEY,
    serviceWorkerRegistration: swReg,
  });
  if (token) {
    await updateDoc(doc(db, "users", uid), { fcmTokens: arrayUnion(token) });
  }
  onMessage(messaging, (payload) => {
    new Notification(payload.notification?.title ?? "Hồ Bơi", {
      body: payload.notification?.body,
      icon: "/icons/icon-192.png",
    });
  });
}
