import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { normalizeVNPhone, phoneLoginEmail, phoneVariants } from "./helpers";

const REGION = "asia-southeast1";
const db = () => admin.firestore();
const FV = admin.firestore.FieldValue;

function assertPassword(value: unknown) {
  const password = String(value ?? "");
  if (password.length < 6) throw new HttpsError("invalid-argument", "Mật khẩu cần có ít nhất 6 ký tự.");
  return password;
}

async function findExistingProfileByPhone(e164: string) {
  const variants = phoneVariants(e164);
  const values = [...new Set(variants ? [variants.raw, variants.local, variants.e164] : [e164])];
  const snap = await db().collection("users").where("phone", "in", values).limit(1).get();
  return snap.empty ? null : snap.docs[0];
}

async function assertPhoneNotRegistered(e164: string, allowedUid?: string) {
  const email = phoneLoginEmail(e164);
  try {
    const emailUser = await admin.auth().getUserByEmail(email);
    if (emailUser.uid !== allowedUid) {
      throw new HttpsError("already-exists", "Số điện thoại này đã có tài khoản. Vui lòng đăng nhập hoặc chọn Quên mật khẩu.");
    }
  } catch (e: unknown) {
    if ((e as HttpsError).code === "already-exists") throw e;
    if ((e as { code?: string })?.code !== "auth/user-not-found") {
      throw new HttpsError("internal", `Không kiểm tra được tài khoản đăng nhập: ${(e as Error).message}`);
    }
  }

  try {
    const phoneUser = await admin.auth().getUserByPhoneNumber(e164);
    if (phoneUser.uid !== allowedUid) {
      throw new HttpsError("already-exists", "Số điện thoại này đã được xác minh trên tài khoản khác. Vui lòng đăng nhập hoặc báo lễ tân hỗ trợ.");
    }
  } catch (e: unknown) {
    if ((e as HttpsError).code === "already-exists") throw e;
    if ((e as { code?: string })?.code !== "auth/user-not-found") {
      throw new HttpsError("internal", `Không kiểm tra được số điện thoại Auth: ${(e as Error).message}`);
    }
  }

  const existingProfile = await findExistingProfileByPhone(e164);
  if (existingProfile && existingProfile.id !== allowedUid) {
    throw new HttpsError("already-exists", "Số điện thoại này đã có hồ sơ trong hệ thống. Vui lòng đăng nhập hoặc chọn Quên mật khẩu.");
  }
}

export const prepareCustomerRegistration = onCall({ region: REGION, cors: true }, async (req) => {
  const e164 = normalizeVNPhone(String(req.data?.phone ?? ""));
  if (!e164) throw new HttpsError("invalid-argument", "SĐT không hợp lệ. Nhập 10 số bắt đầu bằng 0.");
  await assertPhoneNotRegistered(e164);
  return { ok: true, email: phoneLoginEmail(e164) };
});

export const completeCustomerRegistration = onCall({ region: REGION, cors: true }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Cần đăng nhập để hoàn tất đăng ký.");
  const uid = req.auth.uid;
  const e164 = normalizeVNPhone(String(req.data?.phone ?? ""));
  if (!e164) throw new HttpsError("invalid-argument", "SĐT không hợp lệ. Nhập 10 số bắt đầu bằng 0.");
  const fullName = String(req.data?.fullName ?? "").trim();
  if (fullName.length > 60) throw new HttpsError("invalid-argument", "Tên tối đa 60 ký tự.");

  const authUser = await admin.auth().getUser(uid);
  if ((authUser.email ?? "").toLowerCase() !== phoneLoginEmail(e164)) {
    throw new HttpsError("permission-denied", "Tài khoản đăng nhập không khớp với SĐT đăng ký.");
  }
  await assertPhoneNotRegistered(e164, uid);

  const lockRef = db().doc(`phoneUnique/${e164.replace(/\D/g, "")}`);
  const userRef = db().doc(`users/${uid}`);
  const now = admin.firestore.Timestamp.now();
  await db().runTransaction(async (tx) => {
    const [lock, profile] = await Promise.all([tx.get(lockRef), tx.get(userRef)]);
    if (lock.exists && lock.data()?.uid !== uid) {
      throw new HttpsError("already-exists", "Số điện thoại này vừa được đăng ký. Vui lòng đăng nhập hoặc chọn Quên mật khẩu.");
    }
    if (profile.exists && profile.data()?.phone && profile.data()?.phone !== e164) {
      throw new HttpsError("failed-precondition", "Tài khoản này đã gắn với SĐT khác.");
    }
    tx.set(lockRef, { uid, phone: e164, updatedAt: now }, { merge: true });
    tx.set(userRef, {
      id: uid,
      fullName,
      phone: e164,
      role: "CUSTOMER",
      active: true,
      disabled: false,
      fcmTokens: profile.data()?.fcmTokens ?? [],
      createdAt: profile.data()?.createdAt ?? now,
      updatedAt: now,
    }, { merge: true });
    tx.set(db().collection("auditLogs").doc(), {
      actorId: uid,
      action: "CUSTOMER_REGISTERED",
      targetType: "user",
      targetId: uid,
      description: `Khách hàng ${fullName || e164} đăng ký tài khoản`,
      detail: { phone: e164, fullName: fullName || null },
      at: now,
    });
  });

  await admin.auth().updateUser(uid, { displayName: fullName || undefined }).catch(() => undefined);
  await admin.auth().setCustomUserClaims(uid, { role: "CUSTOMER" });
  return { ok: true };
});

export const resetCustomerPasswordAfterOtp = onCall({ region: REGION, cors: true }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Cần xác minh OTP trước khi đặt lại mật khẩu.");
  const e164 = normalizeVNPhone(String(req.data?.phone ?? ""));
  if (!e164) throw new HttpsError("invalid-argument", "SĐT không hợp lệ. Nhập 10 số bắt đầu bằng 0.");
  const password = assertPassword(req.data?.password);

  const tokenPhone = String(req.auth.token.phone_number ?? "");
  const caller = await admin.auth().getUser(req.auth.uid);
  if (tokenPhone !== e164 && caller.phoneNumber !== e164) {
    throw new HttpsError("permission-denied", "OTP vừa xác minh không khớp với SĐT cần đặt lại mật khẩu.");
  }

  const email = phoneLoginEmail(e164);
  let target: admin.auth.UserRecord | null = null;
  try {
    target = await admin.auth().getUserByEmail(email);
  } catch (e: unknown) {
    if ((e as { code?: string })?.code !== "auth/user-not-found") {
      throw new HttpsError("internal", `Không tìm được tài khoản đăng nhập: ${(e as Error).message}`);
    }
  }

  if (!target) {
    const profile = await findExistingProfileByPhone(e164);
    if (profile) target = await admin.auth().getUser(profile.id).catch(() => null);
  }
  if (!target) target = caller;

  const update: admin.auth.UpdateRequest = {
    email,
    password,
    emailVerified: true,
    disabled: false,
  };
  if (!target.phoneNumber || target.uid === caller.uid) update.phoneNumber = e164;
  await admin.auth().updateUser(target.uid, update);

  const profileSnap = await db().doc(`users/${target.uid}`).get();
  if (!profileSnap.exists) {
    await db().doc(`users/${target.uid}`).set({
      id: target.uid,
      phone: e164,
      fullName: target.displayName ?? caller.displayName ?? "",
      role: "CUSTOMER",
      fcmTokens: [],
      disabled: false,
      createdAt: FV.serverTimestamp(),
      _synced: true,
    }, { merge: true });
  }

  await db().collection("auditLogs").add({
    actorId: target.uid,
    action: "CUSTOMER_PASSWORD_RESET_BY_OTP",
    targetType: "user",
    targetId: target.uid,
    description: `Khách hàng ${e164} đặt lại mật khẩu sau OTP`,
    detail: { phone: e164, otpUid: req.auth.uid, canonicalUid: target.uid },
    at: admin.firestore.Timestamp.now(),
  });
  return { ok: true, uid: target.uid };
});
