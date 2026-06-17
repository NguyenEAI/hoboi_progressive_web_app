importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "__FB_API_KEY__",
  authDomain: "__FB_AUTH_DOMAIN__",
  projectId: "__FB_PROJECT_ID__",
  messagingSenderId: "__FB_SENDER_ID__",
  appId: "__FB_APP_ID__",
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(payload.notification?.title ?? "Hồ Bơi", {
    body: payload.notification?.body,
    icon: "/icons/icon-192.png",
  });
});
