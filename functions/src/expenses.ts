// ============================================================
// Chi tiêu của hồ — callables cho Owner + Lễ tân
// Ghi mới / sửa / xoá khoản chi + quản lý mẫu chi cố định hằng tháng.
// ============================================================
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

const REGION = "asia-southeast1";
const db = () => admin.firestore();
const FV = admin.firestore.FieldValue;

const EXPENSE_CATEGORIES = new Set([
  "ELECTRICITY",
  "WATER",
  "CHEMICALS",
  "STAFF_SALARY",
  "COACH_SALARY",
  "SUPPLIES",
  "MAINTENANCE",
  "CLEANING",
  "MARKETING",
  "RENT",
  "TELECOM",
  "TAX",
  "HOSPITALITY",
  "OTHER",
]);

const PAYMENT_METHODS = new Set(["CASH", "TRANSFER", "CARD"]);
const PAID_BY = new Set(["OWNER", "RECEPTIONIST", "OTHER"]);

const RECEPTIONIST_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

export type ExpenseInput = {
  date?: string; // YYYY-MM-DD
  amount?: number | string;
  category?: string;
  note?: string;
  paymentMethod?: string;
  paidBy?: string;
  paidByName?: string;
  receiptPhoto?: { storagePath: string; contentType?: string; sizeBytes?: number } | null;
};

export type ValidateResult = {
  atDate: Date;
  amount: number;
  category: string;
  note: string;
  paymentMethod: string;
  paidBy: string;
  paidByName: string | null;
  receiptPhoto: { storagePath: string; contentType?: string; sizeBytes?: number } | null;
};

export function validateExpenseInput(input: ExpenseInput): ValidateResult {
  const dateStr = String(input.date ?? "").trim();
  let atDate: Date;
  if (!dateStr) atDate = new Date();
  else {
    const [y, m, d] = dateStr.split("-").map((x) => Number(x));
    if (!y || !m || !d)
      throw new HttpsError("invalid-argument", "Ngày chi không hợp lệ");
    atDate = new Date(y, m - 1, d, 12, 0, 0, 0);
    if (isNaN(atDate.getTime()))
      throw new HttpsError("invalid-argument", "Ngày chi không hợp lệ");
  }

  const amountRaw = input.amount;
  const amount = typeof amountRaw === "string" ? Number(amountRaw.replace(/[.,\s]/g, "")) : Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0)
    throw new HttpsError("invalid-argument", "Số tiền phải lớn hơn 0");
  if (amount > 1_000_000_000)
    throw new HttpsError("invalid-argument", "Số tiền quá lớn (tối đa 1 tỷ)");

  const category = String(input.category ?? "").trim();
  if (!EXPENSE_CATEGORIES.has(category))
    throw new HttpsError("invalid-argument", "Loại chi không hợp lệ");

  const paymentMethod = String(input.paymentMethod ?? "CASH").trim();
  if (!PAYMENT_METHODS.has(paymentMethod))
    throw new HttpsError("invalid-argument", "Hình thức trả không hợp lệ");

  const paidBy = String(input.paidBy ?? "OWNER").trim();
  if (!PAID_BY.has(paidBy))
    throw new HttpsError("invalid-argument", "Người trả không hợp lệ");

  const note = String(input.note ?? "").trim().slice(0, 300);
  const paidByName = String(input.paidByName ?? "").trim().slice(0, 60) || null;
  const receiptPhoto = input.receiptPhoto
    ? {
      storagePath: String(input.receiptPhoto.storagePath ?? "").trim(),
      ...(input.receiptPhoto.contentType ? { contentType: String(input.receiptPhoto.contentType) } : {}),
      ...(typeof input.receiptPhoto.sizeBytes === "number" ? { sizeBytes: input.receiptPhoto.sizeBytes } : {}),
    }
    : null;
  if (receiptPhoto && !receiptPhoto.storagePath)
    throw new HttpsError("invalid-argument", "Ảnh hoá đơn không hợp lệ");

  return { atDate, amount, category, note, paymentMethod, paidBy, paidByName, receiptPhoto };
}

function requireStaffRole(req: { auth?: { uid: string; token?: Record<string, unknown> } | null }): {
  uid: string;
  role: "OWNER" | "RECEPTIONIST";
} {
  if (!req.auth) throw new HttpsError("unauthenticated", "Cần đăng nhập");
  const role = req.auth.token?.role as string | undefined;
  if (role !== "OWNER" && role !== "RECEPTIONIST")
    throw new HttpsError("permission-denied", "Chỉ Chủ hoặc Lễ tân được ghi chi tiêu");
  return { uid: req.auth.uid, role: role as "OWNER" | "RECEPTIONIST" };
}

async function actorName(uid: string): Promise<string> {
  try {
    const snap = await db().doc(`users/${uid}`).get();
    return String(snap.data()?.fullName ?? "").trim() || uid.slice(0, 6);
  } catch {
    return uid.slice(0, 6);
  }
}

export type EditPermissionInput = {
  role: "OWNER" | "RECEPTIONIST";
  actorUid: string;
  createdBy: string;
  createdAtMs: number;
  nowMs: number;
};

export function canModifyExpense({ role, actorUid, createdBy, createdAtMs, nowMs }: EditPermissionInput): boolean {
  if (role === "OWNER") return true;
  if (actorUid !== createdBy) return false;
  if (!Number.isFinite(createdAtMs)) return false;
  return nowMs - createdAtMs <= RECEPTIONIST_EDIT_WINDOW_MS;
}

// ============ createExpense ============
export const createExpense = onCall({ region: REGION }, async (req) => {
  const { uid, role } = requireStaffRole(req);
  const validated = validateExpenseInput(req.data as ExpenseInput);
  const name = await actorName(uid);

  const ref = db().collection("expenses").doc();
  const now = admin.firestore.Timestamp.now();
  const atTs = admin.firestore.Timestamp.fromDate(validated.atDate);

  const historyEntry = {
    at: now,
    by: uid,
    byName: name,
    action: "CREATE" as const,
    after: {
      amount: validated.amount,
      category: validated.category,
      note: validated.note,
      paymentMethod: validated.paymentMethod,
      paidBy: validated.paidBy,
      paidByName: validated.paidByName,
      at: atTs,
      receiptPhoto: validated.receiptPhoto,
    },
  };

  await ref.set({
    id: ref.id,
    at: atTs,
    amount: validated.amount,
    category: validated.category,
    note: validated.note,
    paymentMethod: validated.paymentMethod,
    paidBy: validated.paidBy,
    paidByName: validated.paidByName,
    receiptPhoto: validated.receiptPhoto,
    createdBy: uid,
    createdByRole: role,
    createdByName: name,
    createdAt: FV.serverTimestamp(),
    deletedAt: null,
    history: [historyEntry],
  });

  await db().collection("auditLogs").add({
    actorId: uid,
    action: "EXPENSE_CREATED",
    targetType: "expense",
    targetId: ref.id,
    description: `Ghi chi tiêu: ${validated.category} · ${validated.amount.toLocaleString("vi-VN")}₫${validated.note ? ` · ${validated.note}` : ""}`,
    detail: {
      amount: validated.amount,
      category: validated.category,
      note: validated.note,
      paymentMethod: validated.paymentMethod,
      paidBy: validated.paidBy,
      paidByName: validated.paidByName,
      atDate: validated.atDate.toISOString().slice(0, 10),
      hasReceiptPhoto: Boolean(validated.receiptPhoto),
    },
    at: now,
  });

  return { ok: true, id: ref.id };
});

// ============ updateExpense ============
export const updateExpense = onCall({ region: REGION }, async (req) => {
  const { uid, role } = requireStaffRole(req);
  const data = req.data as ExpenseInput & { id: string };
  const id = String(data.id ?? "").trim();
  if (!id) throw new HttpsError("invalid-argument", "Thiếu id khoản chi");

  const validated = validateExpenseInput(data);
  const name = await actorName(uid);

  const ref = db().doc(`expenses/${id}`);
  const now = admin.firestore.Timestamp.now();

  const before = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Không tìm thấy khoản chi");
    const cur = snap.data()!;
    if (cur.deletedAt) throw new HttpsError("failed-precondition", "Khoản chi đã bị xoá, không sửa được");

    const createdAt = cur.createdAt as admin.firestore.Timestamp | undefined;
    const createdAtMs = createdAt?.toMillis?.() ?? 0;
    if (!canModifyExpense({
      role,
      actorUid: uid,
      createdBy: String(cur.createdBy ?? ""),
      createdAtMs,
      nowMs: now.toMillis(),
    })) {
      throw new HttpsError(
        "permission-denied",
        role === "OWNER"
          ? "Không đủ quyền sửa khoản chi này"
          : "Chỉ sửa được khoản chi bạn tự ghi và trong vòng 24 giờ",
      );
    }

    const historyEntry = {
      at: now,
      by: uid,
      byName: name,
      action: "UPDATE" as const,
      before: {
        amount: cur.amount ?? null,
        category: cur.category ?? null,
        note: cur.note ?? "",
        paymentMethod: cur.paymentMethod ?? null,
        paidBy: cur.paidBy ?? null,
        paidByName: cur.paidByName ?? null,
        at: cur.at ?? null,
        receiptPhoto: cur.receiptPhoto ?? null,
      },
      after: {
        amount: validated.amount,
        category: validated.category,
        note: validated.note,
        paymentMethod: validated.paymentMethod,
        paidBy: validated.paidBy,
        paidByName: validated.paidByName,
        at: admin.firestore.Timestamp.fromDate(validated.atDate),
        receiptPhoto: validated.receiptPhoto,
      },
    };

    tx.update(ref, {
      at: admin.firestore.Timestamp.fromDate(validated.atDate),
      amount: validated.amount,
      category: validated.category,
      note: validated.note,
      paymentMethod: validated.paymentMethod,
      paidBy: validated.paidBy,
      paidByName: validated.paidByName,
      receiptPhoto: validated.receiptPhoto,
      updatedAt: FV.serverTimestamp(),
      updatedBy: uid,
      history: FV.arrayUnion(historyEntry),
    });
    return cur;
  });

  await db().collection("auditLogs").add({
    actorId: uid,
    action: "EXPENSE_UPDATED",
    targetType: "expense",
    targetId: id,
    description: `Sửa khoản chi: ${validated.category} · ${validated.amount.toLocaleString("vi-VN")}₫`,
    detail: {
      before: {
        amount: before.amount ?? null,
        category: before.category ?? null,
        note: before.note ?? "",
      },
      after: {
        amount: validated.amount,
        category: validated.category,
        note: validated.note,
      },
    },
    at: now,
  });

  return { ok: true };
});

// ============ deleteExpense ============
export const deleteExpense = onCall({ region: REGION }, async (req) => {
  const { uid, role } = requireStaffRole(req);
  const { id, reason } = req.data as { id?: string; reason?: string };
  const clean = String(id ?? "").trim();
  const cleanReason = String(reason ?? "").trim();
  if (!clean) throw new HttpsError("invalid-argument", "Thiếu id khoản chi");
  if (!cleanReason) throw new HttpsError("invalid-argument", "Vui lòng nhập lý do xoá");

  const name = await actorName(uid);
  const now = admin.firestore.Timestamp.now();
  const ref = db().doc(`expenses/${clean}`);

  const before = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Không tìm thấy khoản chi");
    const cur = snap.data()!;
    if (cur.deletedAt) throw new HttpsError("failed-precondition", "Khoản chi đã bị xoá");

    const createdAt = cur.createdAt as admin.firestore.Timestamp | undefined;
    const createdAtMs = createdAt?.toMillis?.() ?? 0;
    if (!canModifyExpense({
      role,
      actorUid: uid,
      createdBy: String(cur.createdBy ?? ""),
      createdAtMs,
      nowMs: now.toMillis(),
    })) {
      throw new HttpsError(
        "permission-denied",
        role === "OWNER"
          ? "Không đủ quyền xoá khoản chi này"
          : "Chỉ xoá được khoản chi bạn tự ghi và trong vòng 24 giờ",
      );
    }

    const historyEntry = {
      at: now,
      by: uid,
      byName: name,
      action: "DELETE" as const,
      reason: cleanReason,
      before: {
        amount: cur.amount ?? null,
        category: cur.category ?? null,
        note: cur.note ?? "",
      },
    };
    tx.update(ref, {
      deletedAt: FV.serverTimestamp(),
      deletedBy: uid,
      deleteReason: cleanReason,
      history: FV.arrayUnion(historyEntry),
    });
    return cur;
  });

  await db().collection("auditLogs").add({
    actorId: uid,
    action: "EXPENSE_DELETED",
    targetType: "expense",
    targetId: clean,
    description: `Xoá khoản chi: ${before.category ?? "?"} · ${Number(before.amount ?? 0).toLocaleString("vi-VN")}₫ · ${cleanReason}`,
    detail: {
      reason: cleanReason,
      amount: before.amount ?? null,
      category: before.category ?? null,
      note: before.note ?? "",
    },
    at: now,
  });

  return { ok: true };
});

// ============ Template chi cố định ============
export const upsertExpenseTemplate = onCall({ region: REGION }, async (req) => {
  const { uid, role } = requireStaffRole(req);
  if (role !== "OWNER")
    throw new HttpsError("permission-denied", "Chỉ Chủ được sửa danh sách chi cố định");
  const data = req.data as {
    id?: string;
    name: string;
    category: string;
    typicalAmount?: number;
    note?: string;
    active?: boolean;
  };
  const name = String(data.name ?? "").trim();
  if (!name) throw new HttpsError("invalid-argument", "Thiếu tên khoản chi cố định");
  const category = String(data.category ?? "").trim();
  if (!EXPENSE_CATEGORIES.has(category))
    throw new HttpsError("invalid-argument", "Loại chi không hợp lệ");
  const typicalAmount = Number(data.typicalAmount ?? 0);
  if (!Number.isFinite(typicalAmount) || typicalAmount < 0)
    throw new HttpsError("invalid-argument", "Số tiền dự kiến không hợp lệ");
  const note = String(data.note ?? "").trim().slice(0, 200);
  const active = data.active !== false;

  const ref = data.id
    ? db().doc(`expenseTemplates/${data.id}`)
    : db().collection("expenseTemplates").doc();
  const now = admin.firestore.Timestamp.now();

  await ref.set(
    {
      id: ref.id,
      name,
      category,
      typicalAmount,
      note,
      active,
      updatedAt: FV.serverTimestamp(),
      ...(data.id ? {} : { createdBy: uid, createdAt: FV.serverTimestamp() }),
    },
    { merge: true },
  );

  await db().collection("auditLogs").add({
    actorId: uid,
    action: data.id ? "EXPENSE_TEMPLATE_UPDATED" : "EXPENSE_TEMPLATE_CREATED",
    targetType: "expenseTemplate",
    targetId: ref.id,
    description: `${data.id ? "Sửa" : "Thêm"} chi cố định: ${name}`,
    detail: { name, category, typicalAmount, note, active },
    at: now,
  });

  return { ok: true, id: ref.id };
});

export const deleteExpenseTemplate = onCall({ region: REGION }, async (req) => {
  const { uid, role } = requireStaffRole(req);
  if (role !== "OWNER")
    throw new HttpsError("permission-denied", "Chỉ Chủ được xoá chi cố định");
  const { id } = req.data as { id?: string };
  const clean = String(id ?? "").trim();
  if (!clean) throw new HttpsError("invalid-argument", "Thiếu id chi cố định");

  const ref = db().doc(`expenseTemplates/${clean}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Không tìm thấy chi cố định");
  const before = snap.data()!;
  await ref.delete();

  await db().collection("auditLogs").add({
    actorId: uid,
    action: "EXPENSE_TEMPLATE_DELETED",
    targetType: "expenseTemplate",
    targetId: clean,
    description: `Xoá chi cố định: ${before.name ?? "?"}`,
    detail: before,
    at: admin.firestore.Timestamp.now(),
  });

  return { ok: true };
});
