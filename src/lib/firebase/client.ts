// Firebase client SDK — khởi tạo 1 lần, dùng toàn app.
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { browserLocalPersistence, getAuth, setPersistence, type Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFunctions, type Functions } from "firebase/functions";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FB_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FB_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FB_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FB_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FB_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FB_APP_ID,
};

export const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);
// Giữ đăng nhập khi đóng/mở lại app. Nếu trình duyệt chặn bộ nhớ lâu dài,
// Firebase sẽ giữ cơ chế mặc định thay vì làm hỏng luồng đăng nhập.
export const authPersistenceReady = typeof window === "undefined"
  ? Promise.resolve()
  : setPersistence(auth, browserLocalPersistence).catch((error) => {
      console.warn("Không bật được chế độ giữ đăng nhập lâu dài", error);
    });

if (process.env.NEXT_PUBLIC_E2E_DISABLE_APP_VERIFICATION === "1") {
  auth.settings.appVerificationDisabledForTesting = true;
}

// Bật bộ nhớ tạm nội bộ (IndexedDB) cho Firestore để giảm độ trễ khi mở lại app.
// Lần đầu vẫn tải mạng; các lần sau đọc từ máy trong ~0.1s rồi đồng bộ ngầm.
// Nếu trình duyệt không hỗ trợ (Safari private, storage bị chặn), rơi về chế độ mặc định.
function createDb(): Firestore {
  if (typeof window === "undefined") {
    return getFirestore(app);
  }
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    // đã initialize trước đó hoặc trình duyệt không hỗ trợ → dùng bản mặc định
    return getFirestore(app);
  }
}

export const db: Firestore = createDb();
export const storage: FirebaseStorage = getStorage(app);
// Cloud Functions khu vực asia-southeast1 (gần VN)
export const functions: Functions = getFunctions(app, "asia-southeast1");
