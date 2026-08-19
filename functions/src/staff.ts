import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { DEFAULT_CUSTOMER_PASSWORD, normalizeVNPhone, phoneLoginEmail, phoneVariants, requireOwner, requireStaff } from "./helpers";

// Đảm bảo phone/email/password đầy đủ trên Auth user. Dùng cho gán quyền / reset mật khẩu.
// Nếu Auth chưa có user với uid đó → tạo mới với uid đúng để giữ liên kết Firestore.
// Nếu đã có → cập nhật phone/email/password còn thiếu.
async function ensureAuthAccount(uid: string, e164: string, fullName?: string): Promise<admin.auth.UserRecord> {
  const email = phoneLoginEmail(e164);
  try {
    const cur = await admin.auth().getUser(uid);
    const update: admin.auth.UpdateRequest = {};
    if (!cur.phoneNumber) update.phoneNumber = e164;
    if (!cur.email) { update.email = email; update.emailVerified = true; }
    // Không đặt lại mật khẩu nếu đã có (tránh làm hỏng đăng nhập hiện tại).
    if (Object.keys(update).length > 0) {
      await admin.auth().updateUser(uid, update);
    }
    return cur;
  } catch (e: unknown) {
    if ((e as { code?: string })?.code !== "auth/user-not-found") throw e;
    // Chưa có Auth → tạo với đúng uid để khớp Firestore
    return await admin.auth().createUser({
      uid,
      phoneNumber: e164,
      email,
      emailVerified: true,
      password: DEFAULT_CUSTOMER_PASSWORD,
      displayName: fullName || undefined,
    });
  }
}

const REGION = "asia-southeast1";
const db = () => admin.firestore();

const ROLES = ["OWNER", "RECEPTIONIST", "COACH", "CUSTOMER", "PARENT"] as const;
type Role = (typeof ROLES)[number];
const STAFF_ROLES = ["OWNER", "RECEPTIONIST", "COACH"];

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

  const variants = phoneVariants(phone);
  if (!variants) throw new HttpsError("invalid-argument", `SĐT không hợp lệ: ${phone}`);
  const e164 = variants.e164;

  // 1) Ưu tiên tra Auth (khách đã login app).
  let user = await admin.auth().getUserByPhoneNumber(e164).catch(() => null);
  let fullName: string | undefined;
  let firestoreUid: string | undefined;

  // 2) Nếu Auth chưa có, tra Firestore (khách do nhân viên tạo trước đó ở màn Khách hàng).
  if (!user) {
    const q = await db()
      .collection("users")
      .where("phone", "in", [variants.raw, variants.local, variants.e164])
      .limit(1)
      .get();
    if (!q.empty) {
      firestoreUid = q.docs[0].id;
      fullName = String(q.docs[0].data()?.fullName ?? "") || undefined;
      // Đảm bảo Auth khớp uid này (tạo mới nếu chưa có, hoặc bổ sung phone/email nếu thiếu).
      user = await ensureAuthAccount(firestoreUid, e164, fullName);
    }
  }

  if (!user) {
    throw new HttpsError(
      "not-found",
      `Không tìm thấy khách hàng với SĐT ${e164}. Hãy vào mục Khách hàng để tạo trước, sau đó quay lại gán quyền.`,
    );
  }

  await admin.auth().setCustomUserClaims(user.uid, { role });
  await db().doc(`users/${user.uid}`).set({ role, phone: e164, ...(fullName ? { fullName } : {}) }, { merge: true });

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
// createCustomerByPhone: staff (Owner + Lễ tân). Tạo Auth user (nếu chưa có) + doc Firestore.
// updateCustomerName: staff (Owner + Lễ tân). Đổi tên khách bất kỳ.
// deleteCustomer: Owner-only. Xóa Firestore doc + Auth user. Audit log để truy vết.
export const createCustomerByPhone = onCall({ region: REGION }, async (req) => {
  const actorUid = requireStaff(req);
  const raw = String(req.data?.phone ?? "").trim();
  const fullName = String(req.data?.fullName ?? "").trim();
  const e164 = normalizeVNPhone(raw);
  if (!e164)
    throw new HttpsError("invalid-argument", "SĐT không hợp lệ. Nhập 10 số bắt đầu bằng 0.");

  if (fullName.length > 60) throw new HttpsError("invalid-argument", "Tên tối đa 60 ký tự.");

  const email = phoneLoginEmail(e164);
  let authUser = await getAuthUserForCustomer(e164, email);
  if (!authUser) {
    try {
      authUser = await admin.auth().createUser({
        phoneNumber: e164,
        email,
        emailVerified: true,
        password: DEFAULT_CUSTOMER_PASSWORD,
        displayName: fullName || undefined,
      });
    } catch (e2) {
      throw new HttpsError("internal", `Tạo Auth user thất bại: ${(e2 as Error).message}`);
    }
  } else {
    await ensureCustomerPasswordCredential(authUser.uid, e164, email, fullName || authUser.displayName || undefined);
  }

  const ref = db().doc(`users/${authUser.uid}`);
  const lockRef = db().doc(`phoneUnique/${e164.replace(/\D/g, "")}`);
  const now = admin.firestore.Timestamp.now();
  const result = await db().runTransaction(async (tx) => {
    const [snap, lock] = await Promise.all([tx.get(ref), tx.get(lockRef)]);
    if (lock.exists && lock.data()?.uid !== authUser.uid)
      throw new HttpsError("already-exists", "SĐT này vừa được tạo ở tài khoản khác. Vui lòng tải lại danh sách.");
    if (snap.exists) {
      const cur = snap.data()!;
      if (cur.role && STAFF_ROLES.includes(cur.role as string))
        throw new HttpsError("already-exists", `SĐT này đã thuộc vai trò ${cur.role}, không thể tạo khách hàng.`);
      if (fullName) tx.set(ref, { fullName, updatedAt: now }, { merge: true });
    } else {
      tx.set(ref, {
        id: authUser.uid,
        phone: e164,
        fullName: fullName || authUser.displayName || "",
        role: "CUSTOMER",
        fcmTokens: [],
        disabled: false,
        createdAt: now,
        _createdByOwner: true,
      });
    }
    tx.set(lockRef, { uid: authUser.uid, phone: e164, updatedAt: now }, { merge: true });
    tx.set(db().collection("auditLogs").doc(), {
      actorId: actorUid,
      action: "CREATE_CUSTOMER",
      targetType: "user",
      targetId: authUser.uid,
      description: snap.exists
        ? `Nhân viên cập nhật hồ sơ khách ${e164}`
        : `Nhân viên tạo khách hàng ${fullName || e164} với mật khẩu mặc định`,
      detail: { phone: e164, fullName, alreadyExists: snap.exists, initialPassword: "DEFAULT_123456" },
      at: now,
    });
    return { alreadyExists: snap.exists };
  });

  return { ok: true, uid: authUser.uid, alreadyExists: result.alreadyExists };
});

export const resetCustomerPasswordToDefault = onCall({ region: REGION }, async (req) => {
  const ownerUid = requireOwner(req);
  const uid = String(req.data?.uid ?? "").trim();
  if (!uid) throw new HttpsError("invalid-argument", "Thiếu uid khách hàng");
  if (uid === ownerUid) throw new HttpsError("failed-precondition", "Không đặt lại mật khẩu của chính mình tại đây.");

  const ref = db().doc(`users/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Không tìm thấy khách hàng");
  const data = snap.data()!;
  const role = data.role as string | undefined;
  if (role && STAFF_ROLES.includes(role))
    throw new HttpsError("failed-precondition", "Không được đặt lại mật khẩu tài khoản nhân sự ở màn khách hàng.");
  const e164 = normalizeVNPhone(String(data.phone ?? ""));
  if (!e164) throw new HttpsError("failed-precondition", "Hồ sơ khách chưa có SĐT hợp lệ.");

  await ensureCustomerPasswordCredential(uid, e164, phoneLoginEmail(e164), String(data.fullName ?? "") || undefined);
  await db().collection("auditLogs").add({
    actorId: ownerUid,
    action: "RESET_CUSTOMER_PASSWORD",
    targetType: "user",
    targetId: uid,
    description: `Owner đặt lại mật khẩu khách ${data.fullName || e164} về mặc định`,
    detail: { phone: e164, passwordPolicy: "DEFAULT_123456" },
    at: admin.firestore.Timestamp.now(),
  });
  return { ok: true };
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
    description: `Nhân viên đổi tên khách từ "${oldName || "chưa đặt"}" sang "${fullName}"`,
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
    description: `Owner xóa khách hàng ${data.fullName || data.phone || uid}`,
    detail: { phone: data.phone ?? null, fullName: data.fullName ?? null },
    at: admin.firestore.Timestamp.now(),
  });
  return { ok: true };
});

async function getAuthUserForCustomer(e164: string, email: string): Promise<admin.auth.UserRecord | null> {
  const [byEmail, byPhone] = await Promise.all([
    admin.auth().getUserByEmail(email).catch((e: unknown) => {
      if ((e as { code?: string })?.code === "auth/user-not-found") return null;
      throw new HttpsError("internal", `Lỗi tra Auth email: ${(e as Error).message}`);
    }),
    admin.auth().getUserByPhoneNumber(e164).catch((e: unknown) => {
      if ((e as { code?: string })?.code === "auth/user-not-found") return null;
      throw new HttpsError("internal", `Lỗi tra Auth SĐT: ${(e as Error).message}`);
    }),
  ]);
  if (byEmail && byPhone && byEmail.uid !== byPhone.uid) {
    throw new HttpsError("already-exists", "SĐT này đang nằm ở hai tài khoản Auth khác nhau. Vui lòng xử lý trùng tài khoản trước khi tạo khách.");
  }
  return byEmail ?? byPhone;
}

async function ensureCustomerPasswordCredential(uid: string, e164: string, email: string, displayName?: string) {
  const update: admin.auth.UpdateRequest = {
    email,
    emailVerified: true,
    password: DEFAULT_CUSTOMER_PASSWORD,
    disabled: false,
  };
  const current = await admin.auth().getUser(uid);
  if (!current.phoneNumber) update.phoneNumber = e164;
  if (displayName) update.displayName = displayName;
  try {
    await admin.auth().updateUser(uid, update);
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "auth/email-already-exists" || code === "auth/phone-number-already-exists") {
      throw new HttpsError("already-exists", "SĐT này đã thuộc tài khoản khác trong Firebase Auth.");
    }
    throw new HttpsError("internal", `Cập nhật tài khoản đăng nhập thất bại: ${(e as Error).message}`);
  }
}

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
