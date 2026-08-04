import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { normalizeVNPhone, phoneVariants, requireOwner } from "./helpers";

const REGION = "asia-southeast1";
const db = () => admin.firestore();
const FV = admin.firestore.FieldValue;

const CUSTOMER_ROLES = new Set(["CUSTOMER", "PARENT", undefined, null]);
const PROFILE_FIELDS = ["fullName", "phone", "address", "dob", "heightCm", "audience", "disabled"] as const;
const AUDIENCES = new Set(["CHILD_UNDER_140", "CHILD_OVER_140", "ADULT"]);
const MEMBERSHIP_STATUSES = new Set(["ACTIVE", "EXPIRED", "SUSPENDED"]);
const PACKAGE_STATUSES = new Set(["ACTIVE", "DEPLETED", "EXPIRED", "SUSPENDED"]);
const COURSE_STATUSES = new Set(["PENDING", "ACTIVE", "COMPLETED", "EXPIRED", "CANCELLED"]);
const PASS_PHOTO_MAX_BYTES = 4 * 1024 * 1024;

type ServiceKind = "MEMBERSHIP" | "PACKAGE" | "COURSE";

function requireStaffActor(req: any): { actorId: string; role: string } {
  if (!req.auth) throw new HttpsError("unauthenticated", "Cần đăng nhập");
  const role = String(req.auth.token.role ?? "");
  if (!["OWNER", "RECEPTIONIST"].includes(role)) {
    throw new HttpsError("permission-denied", "Không đủ quyền");
  }
  return { actorId: req.auth.uid, role };
}

export function assertReason(reason: unknown): string {
  const value = String(reason ?? "").trim();
  if (value.length < 3) {
    throw new HttpsError("invalid-argument", "Bắt buộc nhập lý do thay đổi");
  }
  if (value.length > 500) {
    throw new HttpsError("invalid-argument", "Lý do tối đa 500 ký tự");
  }
  return value;
}

export function buildCustomerProfilePatch(rawPatch: unknown): Record<string, unknown> {
  if (!rawPatch || typeof rawPatch !== "object") {
    throw new HttpsError("invalid-argument", "Thiếu dữ liệu hồ sơ cần cập nhật");
  }
  const raw = rawPatch as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  if ("fullName" in raw) {
    const fullName = String(raw.fullName ?? "").trim();
    if (!fullName) throw new HttpsError("invalid-argument", "Tên không được trống");
    if (fullName.length > 60) throw new HttpsError("invalid-argument", "Tên tối đa 60 ký tự");
    patch.fullName = fullName;
  }
  if ("phone" in raw) {
    const phone = normalizeVNPhone(String(raw.phone ?? ""));
    if (!phone) throw new HttpsError("invalid-argument", "SĐT không hợp lệ");
    patch.phone = phone;
  }
  if ("address" in raw) {
    const address = String(raw.address ?? "").trim();
    if (address.length > 160) throw new HttpsError("invalid-argument", "Địa chỉ tối đa 160 ký tự");
    patch.address = address || null;
  }
  if ("dob" in raw) patch.dob = parseDateOrNull(raw.dob, "Ngày sinh không hợp lệ");
  if ("heightCm" in raw) {
    if (raw.heightCm === "" || raw.heightCm === null || raw.heightCm === undefined) {
      patch.heightCm = null;
    } else {
      const height = Math.floor(Number(raw.heightCm));
      if (!Number.isFinite(height) || height < 60 || height > 220) {
        throw new HttpsError("invalid-argument", "Chiều cao phải từ 60 đến 220cm");
      }
      patch.heightCm = height;
    }
  }
  if ("audience" in raw) {
    const audience = String(raw.audience ?? "");
    if (audience && !AUDIENCES.has(audience)) throw new HttpsError("invalid-argument", "Nhóm khách không hợp lệ");
    patch.audience = audience || null;
  }
  if ("disabled" in raw) patch.disabled = Boolean(raw.disabled);

  rejectUnknownKeys(raw, PROFILE_FIELDS);
  if (!Object.keys(patch).length) throw new HttpsError("invalid-argument", "Không có trường nào để cập nhật");
  return patch;
}

export function buildServicePatch(kind: ServiceKind, rawPatch: unknown, current: Record<string, unknown>): Record<string, unknown> {
  if (!rawPatch || typeof rawPatch !== "object") {
    throw new HttpsError("invalid-argument", "Thiếu dữ liệu dịch vụ cần cập nhật");
  }
  const raw = rawPatch as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  if (kind === "MEMBERSHIP") {
    rejectUnknownKeys(raw, ["status", "endDate"]);
    if ("status" in raw) patch.status = checkedStatus(raw.status, MEMBERSHIP_STATUSES);
    if ("endDate" in raw) patch.endDate = parseDate(raw.endDate, "Ngày hết hạn không hợp lệ");
  } else if (kind === "PACKAGE") {
    rejectUnknownKeys(raw, ["status", "totalSessions", "remainingSessions", "startDate", "expiryDate"]);
    if ("status" in raw) patch.status = checkedStatus(raw.status, PACKAGE_STATUSES);
    if ("totalSessions" in raw) patch.totalSessions = checkedInt(raw.totalSessions, "Tổng lượt", 0, 999);
    if ("remainingSessions" in raw) patch.remainingSessions = checkedInt(raw.remainingSessions, "Lượt còn lại", 0, 999);
    if ("startDate" in raw) patch.startDate = parseDate(raw.startDate, "Ngày kích hoạt không hợp lệ");
    if ("expiryDate" in raw) patch.expiryDate = parseDate(raw.expiryDate, "Ngày hết hạn không hợp lệ");
    const total = Number(patch.totalSessions ?? current.totalSessions ?? 0);
    const remaining = Number(patch.remainingSessions ?? current.remainingSessions ?? 0);
    if (remaining > total) throw new HttpsError("invalid-argument", "Lượt còn lại không được lớn hơn tổng lượt");
  } else {
    rejectUnknownKeys(raw, ["status", "totalSessions", "attendedSessions", "startDate", "expiryDate"]);
    if ("status" in raw) patch.status = checkedStatus(raw.status, COURSE_STATUSES);
    if ("totalSessions" in raw) patch.totalSessions = checkedInt(raw.totalSessions, "Tổng buổi", 0, 999);
    if ("attendedSessions" in raw) patch.attendedSessions = checkedInt(raw.attendedSessions, "Buổi đã học", 0, 999);
    if ("startDate" in raw) patch.startDate = parseDate(raw.startDate, "Ngày bắt đầu không hợp lệ");
    if ("expiryDate" in raw) patch.expiryDate = parseDate(raw.expiryDate, "Ngày hết hạn không hợp lệ");
    const total = Number(patch.totalSessions ?? current.totalSessions ?? 0);
    const attended = Number(patch.attendedSessions ?? current.attendedSessions ?? 0);
    if (attended > total) throw new HttpsError("invalid-argument", "Buổi đã học không được lớn hơn tổng buổi");
  }

  if (!Object.keys(patch).length) throw new HttpsError("invalid-argument", "Không có trường nào để cập nhật");
  return patch;
}

export function pickBeforeAfter(
  before: Record<string, unknown>,
  patch: Record<string, unknown>,
): { before: Record<string, unknown>; after: Record<string, unknown>; fields: string[] } {
  const prev: Record<string, unknown> = {};
  const next: Record<string, unknown> = {};
  for (const key of Object.keys(patch)) {
    prev[key] = before[key] ?? null;
    next[key] = patch[key] ?? null;
  }
  return { before: prev, after: next, fields: Object.keys(patch) };
}

export const ownerUpdateCustomerProfile = onCall({ region: REGION, cors: true }, async (req) => {
  const actorId = requireOwner(req);
  const uid = String(req.data?.uid ?? "").trim();
  const reason = assertReason(req.data?.reason);
  if (!uid) throw new HttpsError("invalid-argument", "Thiếu uid khách hàng");

  const ref = db().doc(`users/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Không tìm thấy khách hàng");
  const current = snap.data() ?? {};
  if (!CUSTOMER_ROLES.has(current.role as string | undefined)) {
    throw new HttpsError("failed-precondition", "Chỉ được sửa hồ sơ khách hàng/phụ huynh");
  }

  const patch = buildCustomerProfilePatch(req.data?.patch);
  if (typeof patch.phone === "string" && patch.phone !== current.phone) {
    await assertPhoneAvailable(uid, patch.phone);
    try {
      // Màn đăng nhập chuyển SĐT thành địa chỉ đăng nhập nội bộ. Đổi cả hai
      // để khách vẫn vào app được bằng chính SĐT mới, nhưng không hề hiển thị địa chỉ này.
      await admin.auth().updateUser(uid, {
        phoneNumber: patch.phone,
        email: `phone-${patch.phone.replace(/\D/g, "")}@login.hoboiapp.com`,
      });
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === "auth/user-not-found") {
        throw new HttpsError("failed-precondition", "Không tìm thấy Auth user để đổi SĐT");
      }
      throw new HttpsError("internal", `Đổi SĐT Auth thất bại: ${(e as Error).message}`);
    }
  }
  if (typeof patch.fullName === "string") {
    await admin.auth().updateUser(uid, { displayName: patch.fullName }).catch(() => undefined);
  }

  const now = admin.firestore.Timestamp.now();
  const diff = pickBeforeAfter(current, patch);
  await ref.set({ ...patch, updatedAt: FV.serverTimestamp(), updatedBy: actorId }, { merge: true });
  await db().collection("auditLogs").add({
    actorId,
    action: "OWNER_UPDATE_CUSTOMER_PROFILE",
    targetType: "user",
    targetId: uid,
    detail: { reason, ...diff },
    at: now,
  });
  return { ok: true, fields: diff.fields };
});

export const ownerUpdateCustomerService = onCall({ region: REGION, cors: true }, async (req) => {
  const actorId = requireOwner(req);
  const customerId = String(req.data?.customerId ?? "").trim();
  const serviceId = String(req.data?.serviceId ?? "").trim();
  const kind = String(req.data?.kind ?? "") as ServiceKind;
  const reason = assertReason(req.data?.reason);
  if (!customerId || !serviceId) throw new HttpsError("invalid-argument", "Thiếu khách hàng hoặc dịch vụ");
  if (!["MEMBERSHIP", "PACKAGE", "COURSE"].includes(kind)) throw new HttpsError("invalid-argument", "Loại dịch vụ không hợp lệ");

  const col = kind === "MEMBERSHIP" ? "memberships" : kind === "PACKAGE" ? "ticketPackages" : "enrollments";
  const ref = db().doc(`${col}/${serviceId}`);
  const now = admin.firestore.Timestamp.now();
  const result = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Không tìm thấy dịch vụ");
    const current = snap.data() ?? {};
    assertServiceBelongsToCustomer(kind, current, customerId);
    const patch = buildServicePatch(kind, req.data?.patch, current);
    const diff = pickBeforeAfter(current, patch);
    tx.update(ref, {
      ...patch,
      updatedAt: now,
      updatedBy: actorId,
      ownerAdjustmentHistory: FV.arrayUnion({
        at: now,
        by: actorId,
        reason,
        fields: diff.fields,
        before: diff.before,
        after: diff.after,
      }),
    });
    tx.set(db().collection("auditLogs").doc(), {
      actorId,
      action: "OWNER_UPDATE_CUSTOMER_SERVICE",
      targetType: kind,
      targetId: serviceId,
      detail: { customerId, reason, ...diff },
      at: now,
    });
    return { ok: true, fields: diff.fields };
  });
  return result;
});

export const updateMembershipPassPhoto = onCall({ region: REGION, cors: true }, async (req) => {
  const { actorId, role } = requireStaffActor(req);
  const customerId = String(req.data?.customerId ?? "").trim();
  const membershipId = String(req.data?.membershipId ?? "").trim();
  const reason = assertReason(req.data?.reason);
  if (!customerId || !membershipId) throw new HttpsError("invalid-argument", "Thiếu khách hàng hoặc vé thời hạn");

  const ref = db().doc(`memberships/${membershipId}`);
  const now = admin.firestore.Timestamp.now();
  const result = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Không tìm thấy vé thời hạn");
    const current = snap.data() ?? {};
    assertServiceBelongsToCustomer("MEMBERSHIP", current, customerId);
    const passPhoto = await validateMembershipPassPhoto(
      actorId,
      customerId,
      String(current.holderKind ?? ""),
      String(current.holderId ?? ""),
      req.data?.passPhoto,
    );
    const before = current.passPhoto ?? null;
    tx.update(ref, {
      passPhoto,
      updatedAt: now,
      updatedBy: actorId,
      photoUpdateHistory: FV.arrayUnion({
        at: now,
        by: actorId,
        role,
        reason,
        before,
        after: passPhoto,
      }),
    });
    tx.set(db().collection("auditLogs").doc(), {
      actorId,
      action: "UPDATE_MEMBERSHIP_PASS_PHOTO",
      targetType: "membership",
      targetId: membershipId,
      description: "Cập nhật ảnh vé thời hạn",
      detail: { customerId, reason, before, after: passPhoto },
      at: now,
    });
    return { ok: true, passPhoto };
  });
  return result;
});

async function assertPhoneAvailable(uid: string, phone: string) {
  try {
    const authUser = await admin.auth().getUserByPhoneNumber(phone);
    if (authUser.uid !== uid) throw new HttpsError("already-exists", "SĐT đã thuộc tài khoản khác trong Auth");
  } catch (e: unknown) {
    if ((e as HttpsError).code === "already-exists") throw e;
    const code = (e as { code?: string })?.code;
    if (code && code !== "auth/user-not-found") throw new HttpsError("internal", `Tra Auth thất bại: ${(e as Error).message}`);
  }
  const variants = phoneVariants(phone);
  const values = [...new Set(variants ? [variants.raw, variants.local, variants.e164] : [phone])];
  const matches = await db().collection("users").where("phone", "in", values).get();
  const other = matches.docs.find((doc) => doc.id !== uid);
  if (other) throw new HttpsError("already-exists", "SĐT đã thuộc hồ sơ khách khác");
}

function assertServiceBelongsToCustomer(kind: ServiceKind, data: Record<string, unknown>, customerId: string) {
  if (kind === "COURSE") {
    if (data.studentId === customerId || data.parentId === customerId) return;
  } else if (data.userId === customerId) {
    return;
  }
  throw new HttpsError("permission-denied", "Dịch vụ không thuộc khách hàng này");
}

async function validateMembershipPassPhoto(
  actorId: string,
  customerId: string,
  beneficiaryKind: string,
  beneficiaryId: string,
  rawPhoto: unknown,
) {
  const storagePath = String((rawPhoto as { storagePath?: unknown } | undefined)?.storagePath ?? "").replace(/^\/+/, "");
  if (!storagePath) throw new HttpsError("invalid-argument", "Thiếu ảnh thẻ mới");
  if (storagePath.includes("..") || storagePath.endsWith("/"))
    throw new HttpsError("invalid-argument", "Đường dẫn ảnh không hợp lệ");
  if (!["USER", "CHILD"].includes(beneficiaryKind) || !beneficiaryId)
    throw new HttpsError("failed-precondition", "Vé thời hạn thiếu thông tin người dùng vé");

  const expectedPrefix = `passPhotos/${customerId}/${beneficiaryKind}/${beneficiaryId}/drafts/`;
  if (!storagePath.startsWith(expectedPrefix))
    throw new HttpsError("permission-denied", "Ảnh thẻ không thuộc đúng khách/người dùng vé");

  const file = admin.storage().bucket().file(storagePath);
  const [exists] = await file.exists();
  if (!exists) throw new HttpsError("failed-precondition", "Ảnh thẻ chưa upload thành công");

  const [metadata] = await file.getMetadata();
  const contentType = String(metadata.contentType ?? "");
  const sizeBytes = Number(metadata.size ?? 0);
  if (!/^image\/(jpeg|png|webp)$/.test(contentType))
    throw new HttpsError("invalid-argument", "Ảnh thẻ phải là JPG, PNG hoặc WebP");
  if (!sizeBytes || sizeBytes > PASS_PHOTO_MAX_BYTES)
    throw new HttpsError("invalid-argument", "Ảnh thẻ tối đa 4MB");

  return {
    storagePath,
    contentType,
    sizeBytes,
    uploadedBy: actorId,
  };
}

function checkedStatus(value: unknown, allowed: Set<string>) {
  const status = String(value ?? "");
  if (!allowed.has(status)) throw new HttpsError("invalid-argument", "Trạng thái không hợp lệ");
  return status;
}

function checkedInt(value: unknown, label: string, min: number, max: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new HttpsError("invalid-argument", `${label} phải từ ${min} đến ${max}`);
  }
  return n;
}

function parseDateOrNull(value: unknown, message: string) {
  if (value === "" || value === null || value === undefined) return null;
  return parseDate(value, message);
}

function parseDate(value: unknown, message: string) {
  const d = new Date(String(value ?? ""));
  if (!Number.isFinite(d.getTime())) throw new HttpsError("invalid-argument", message);
  return admin.firestore.Timestamp.fromDate(d);
}

function rejectUnknownKeys(raw: Record<string, unknown>, allowed: readonly string[]) {
  const allowedSet = new Set(allowed);
  const bad = Object.keys(raw).find((k) => !allowedSet.has(k));
  if (bad) throw new HttpsError("invalid-argument", `Trường không được phép cập nhật: ${bad}`);
}
