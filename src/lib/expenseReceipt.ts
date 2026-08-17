import { ref, uploadBytes } from "firebase/storage";
import { storage, auth } from "@/lib/firebase/client";

export const EXPENSE_RECEIPT_MAX_BYTES = 5 * 1024 * 1024;

export type ExpenseReceiptUpload = {
  storagePath: string;
  contentType: string;
  sizeBytes: number;
};

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function validateExpenseReceiptFile(file: File): string | null {
  if (!EXT_BY_TYPE[file.type]) return "Chỉ nhận ảnh JPG, PNG hoặc WebP.";
  if (file.size > EXPENSE_RECEIPT_MAX_BYTES) return "Ảnh tối đa 5MB.";
  return null;
}

export async function uploadExpenseReceipt(file: File): Promise<ExpenseReceiptUpload> {
  const invalid = validateExpenseReceiptFile(file);
  if (invalid) throw new Error(invalid);
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Cần đăng nhập");
  const ext = EXT_BY_TYPE[file.type];
  const storagePath = `expenseReceipts/${uid}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  await uploadBytes(ref(storage, storagePath), file, { contentType: file.type });
  return { storagePath, contentType: file.type, sizeBytes: file.size };
}
