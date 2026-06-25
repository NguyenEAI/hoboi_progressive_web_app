import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { normalizeVNPhone, phoneVariants, requireOwner, requireStaff } from "./helpers";

const REGION = "asia-southeast1";
const db = () => admin.firestore();

const ROLES = ["OWNER", "RECEPTIONIST", "COACH", "CUSTOMER", "PARENT"] as const;
type Role = (typeof ROLES)[number];

/**
 * Gán vai trò cho user (Owner-only).
 * Đặt custom claim + cập nhật doc /users/{uid}.role.
 * Nếu role=COACH và có coachId, liên kết coaches/{id}.userId.
 */
export const setUserRole = onCall({ region: REGION }, async (req) => {
  const callerRole = req.auth?.token?.role;
  if (callerRole !== "OWNER")
    throw new HttpsError("permission-denied", "Chỉ Owner được gán vai trò");

  const { phone, role, coachId } = req.data as { phone: string; role: Role; coachId?: string };
  if (!phone || !ROLES.includes(role))
    throw new HttpsError("invalid-argument", "Thiếu SĐT hoặc vai trò không hợp lệ");

  // Chuẩn hóa SĐT về E.164 (+84...). Firebase getUserByPhoneNumber yêu cầu E.164.
  const e164 = normalizeVNPhone(phone);
  if (!e164) throw new HttpsError("invalid-argument", `SĐT không hợp lệ: ${phone}`);

  const user = await admin.auth().getUserByPhoneNumber(e164).catch(() => null);
  if (!user) throw new HttpsError("not-found", `Không tìm thấy tài khoản với SĐT ${e164}. Người đó phải đăng nhập app 1 lần trước.`);

  await admin.auth().setCustomUserClaims(user.uid, { role });
  await db().doc(`users/${user.uid}`).set({ role }, { merge: true });

  if (role === "COACH" && coachId) {
    await db().doc(`coaches/${coachId}`).set({ userId: user.uid }, { merge: true });
  }

  // Audit log
  await db().collection("auditLogs").add({
    actorId: req.auth!.uid, action: "SET_USER_ROLE",
    targetType: "user", targetId: user.uid,
    detail: { phone, role, coachId: coachId ?? null },
    at: admin.firestore.Timestamp.now(),
  });

  return { ok: true, uid: user.uid, role };
});

/**
 * Gỡ quyền: hạ role về CUSTOMER + clear custom claim.
 * Bảo vệ: không cho Owner tự gỡ chính mình; phải còn ≥1 OWNER khác.
 */
export const revokeUserRole = onCall({ region: REGION }, async (req) => {
  const callerRole = req.auth?.token?.role;
  if (callerRole !== "OWNER")
    throw new HttpsError("permission-denied", "Chỉ Owner được gỡ quyền");

  const { targetUid } = req.data as { targetUid: string };
  if (!targetUid) throw new HttpsError("invalid-argument", "Thiếu targetUid");
  if (targetUid === req.auth!.uid)
    throw new HttpsError("failed-precondition", "Không thể tự gỡ quyền của chính mình");

  const targetRef = db().doc(`users/${targetUid}`);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) throw new HttpsError("not-found", "Không tìm thấy user");
  const fromRole = (targetSnap.data()!.role as Role) ?? "CUSTOMER";
  if (fromRole === "CUSTOMER")
    throw new HttpsError("failed-precondition", "User này đã ở vai trò CUSTOMER");

  if (fromRole === "OWNER") {
    const owners = await db().collection("users").where("role", "==", "OWNER").get();
    if (owners.size <= 1)
      throw new HttpsError("failed-precondition", "Phải còn ít nhất 1 OWNER khác trong hệ thống");
  }

  await admin.auth().setCustomUserClaims(targetUid, { role: "CUSTOMER" });
  await targetRef.set({ role: "CUSTOMER" }, { merge: true });

  // Nếu user trước là COACH, gỡ liên kết coaches/{...}.userId
  if (fromRole === "COACH") {
    const linked = await db().collection("coaches").where("userId", "==", targetUid).get();
    const batch = db().batch();
    linked.forEach((d) => batch.update(d.ref, { userId: null }));
    if (!linked.empty) await batch.commit();
  }

  await db().collection("auditLogs").add({
    actorId: req.auth!.uid, action: "REVOKE_ROLE",
    targetType: "user", targetId: targetUid,
    detail: { from: fromRole, to: "CUSTOMER" },
    at: admin.firestore.Timestamp.now(),
  });
  return { ok: true, uid: targetUid, from: fromRole };
});

// v2.4 (E1) — Tra khách hàng theo SĐT. Server normalize + 2-stage lookup.
// v2.4.1 (Owner feedback): nếu Auth có user nhưng Firestore không có → AUTO-CREATE doc placeholder
//   (đảo lại quyết định cũ "chỉ báo lỗi"). Lễ tân thao tác được ngay; khách cũng xuất hiện ở
//   /admin/customers. Audit log để Owner truy vết.
export const searchCustomerByPhone = onCall({ region: REGION }, async (req) => {
  const callerUid = requireStaff(req);
  const raw = String(req.data?.phone ?? "").trim();
  const variants = phoneVariants(raw);
  if (!variants)
    throw new HttpsError("invalid-argument", "SĐT không hợp lệ. Nhập 10 số bắt đầu bằng 0.");

  // 1) Tra Firestore
  const q = await db()
    .collection("users")
    .where("phone", "in", [variants.raw, variants.local, variants.e164])
    .limit(1)
    .get();
  if (!q.empty) {
    const u = q.docs[0];
    return { found: true, id: u.id, ...(u.data() as Record<string, unknown>) };
  }

  // 2) Fallback Auth — auto-create doc placeholder nếu Auth có user
  let authUser: admin.auth.UserRecord;
  try {
    authUser = await admin.auth().getUserByPhoneNumber(variants.e164);
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "auth/user-not-found")
      throw new HttpsError(
        "not-found",
        "not-found: Khách chưa từng đăng ký với SĐT này. Yêu cầu khách mở app + đăng nhập 1 lần trước.",
      );
    throw new HttpsError("internal", `Lỗi tra Firebase Auth: ${(e as Error).message}`);
  }

  const ref = db().doc(`users/${authUser.uid}`);
  await ref.set(
    {
      phone: variants.e164,
      fullName: authUser.displayName ?? "",
      role: "CUSTOMER",
      fcmTokens: [],
      disabled: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      _synced: true,
    },
    { merge: true },
  );
  await db().collection("auditLogs").add({
    actorId: callerUid,
    action: "AUTO_CREATE_USER_FROM_AUTH",
    targetType: "user",
    targetId: authUser.uid,
    detail: { phone: variants.e164, via: "searchCustomerByPhone" },
    at: admin.firestore.Timestamp.now(),
  });

  const data = (await ref.get()).data() ?? {};
  return { found: true, id: authUser.uid, autoCreated: true, ...data };
});

// v2.5 — CRUD khách hàng (manage từ /admin/customers).
// createCustomerByPhone: Owner-only. Tạo Auth user (nếu chưa có) + doc Firestore.
// updateCustomerName: staff (Owner + Lễ tân). Đổi tên khách bất kỳ.
// deleteCustomer: Owner-only. Xóa Firestore doc + Auth user. Audit log để truy vết.
export const createCustomerByPhone = onCall({ region: REGION }, async (req) => {
  const ownerUid = requireOwner(req);
  const raw = String(req.data?.phone ?? "").trim();
  const fullName = String(req.data?.fullName ?? "").trim();
  const e164 = normalizeVNPhone(raw);
  if (!e164)
    throw new HttpsError("invalid-argument", "SĐT không hợp lệ. Nhập 10 số bắt đầu bằng 0.");

  let authUser: admin.auth.UserRecord;
  try {
    authUser = await admin.auth().getUserByPhoneNumber(e164);
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code !== "auth/user-not-found")
      throw new HttpsError("internal", `Lỗi tra Auth: ${(e as Error).message}`);
    try {
      authUser = await admin.auth().createUser({ phoneNumber: e164, displayName: fullName || undefined });
    } catch (e2) {
      throw new HttpsError("internal", `Tạo Auth user thất bại: ${(e2 as Error).message}`);
    }
  }

  const ref = db().doc(`users/${authUser.uid}`);
  const snap = await ref.get();
  if (snap.exists) {
    const cur = snap.data()!;
    if (cur.role && ["OWNER", "RECEPTIONIST", "COACH"].includes(cur.role as string))
      throw new HttpsError("already-exists", `SĐT này đã thuộc vai trò ${cur.role}, không thể tạo khách hàng.`);
    // Đã có doc CUSTOMER/PARENT → chỉ cập nhật tên nếu owner cung cấp
    if (fullName) await ref.set({ fullName }, { merge: true });
  } else {
    await ref.set({
      id: authUser.uid,
      phone: e164,
      fullName: fullName || authUser.displayName || "",
      role: "CUSTOMER",
      fcmTokens: [],
      disabled: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      _createdByOwner: true,
    });
  }

  await db().collection("auditLogs").add({
    actorId: ownerUid,
    action: "CREATE_CUSTOMER",
    targetType: "user",
    targetId: authUser.uid,
    detail: { phone: e164, fullName, alreadyExists: snap.exists },
    at: admin.firestore.Timestamp.now(),
  });

  return { ok: true, uid: authUser.uid, alreadyExists: snap.exists };
});

export const updateCustomerName = onCall({ region: REGION }, async (req) => {
  const actorUid = requireStaff(req);
  const uid = String(req.data?.uid ?? "").trim();
  const fullName = String(req.data?.fullName ?? "").trim();
  if (!uid) throw new HttpsError("invalid-argument", "Thiếu uid");
  if (!fullName) throw new HttpsError("invalid-argument", "Tên không được trống");
  if (fullName.length > 60) throw new HttpsError("invalid-argument", "Tên tối đa 60 ký tự");

  const ref = db().doc(`users/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Không tìm thấy khách");
  const oldName = (snap.data()?.fullName as string) ?? "";

  await ref.set({ fullName }, { merge: true });
  await db().collection("auditLogs").add({
    actorId: actorUid,
    action: "UPDATE_CUSTOMER_NAME",
    targetType: "user",
    targetId: uid,
    detail: { from: oldName, to: fullName },
    at: admin.firestore.Timestamp.now(),
  });
  return { ok: true };
});

export const deleteCustomer = onCall({ region: REGION }, async (req) => {
  const ownerUid = requireOwner(req);
  const uid = String(req.data?.uid ?? "").trim();
  if (!uid) throw new HttpsError("invalid-argument", "Thiếu uid");
  if (uid === ownerUid) throw new HttpsError("failed-precondition", "Không thể tự xóa chính mình");

  const ref = db().doc(`users/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Không tìm thấy khách");
  const data = snap.data()!;
  const role = data.role as string | undefined;
  if (role && ["OWNER", "RECEPTIONIST", "COACH"].includes(role))
    throw new HttpsError(
      "failed-precondition",
      `Tài khoản đang giữ vai trò ${role}. Hãy gỡ quyền trước khi xóa.`,
    );

  await ref.delete();
  try {
    await admin.auth().deleteUser(uid);
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code !== "auth/user-not-found")
      console.warn("deleteCustomer: Auth delete failed", e);
  }
  await db().collection("auditLogs").add({
    actorId: ownerUid,
    action: "DELETE_CUSTOMER",
    targetType: "user",
    targetId: uid,
    detail: { phone: data.phone ?? null, fullName: data.fullName ?? null },
    at: admin.firestore.Timestamp.now(),
  });
  return { ok: true };
});

// v2.4.1 — Đồng bộ tất cả Firebase Auth users → Firestore docs (Owner-only).
// Quét toàn bộ user trong Auth, tạo doc placeholder cho ai chưa có /users/{uid}.
// Trả số doc mới tạo + tổng quét.
export const syncAllAuthUsersToFirestore = onCall({ region: REGION }, async (req) => {
  const role = req.auth?.token?.role;
  if (role !== "OWNER")
    throw new HttpsError("permission-denied", "Chỉ Owner được đồng bộ");

  let created = 0;
  let scanned = 0;
  let nextPageToken: string | undefined;
  do {
    const page = await admin.auth().listUsers(1000, nextPageToken);
    scanned += page.users.length;
    let pageCreated = 0;
    const batch = db().batch();
    for (const u of page.users) {
      if (!u.phoneNumber) continue;
      const ref = db().doc(`users/${u.uid}`);
      const snap = await ref.get();
      if (snap.exists) continue;
      batch.set(ref, {
        phone: u.phoneNumber,
        fullName: u.displayName ?? "",
        role: "CUSTOMER",
        fcmTokens: [],
        disabled: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        _synced: true,
      });
      pageCreated++;
    }
    if (pageCreated > 0) {
      await batch.commit();
      created += pageCreated;
    }
    nextPageToken = page.pageToken;
  } while (nextPageToken);

  await db().collection("auditLogs").add({
    actorId: req.auth!.uid,
    action: "SYNC_AUTH_USERS",
    targetType: "system",
    targetId: "users",
    detail: { scanned, created },
    at: admin.firestore.Timestamp.now(),
  });

  return { ok: true, scanned, created };
});
