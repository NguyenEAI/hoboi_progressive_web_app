import { ref, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase/client";

export const PASS_PHOTO_MAX_BYTES = 4 * 1024 * 1024;

export type PassPhotoUpload = {
  storagePath: string;
  contentType: string;
  sizeBytes: number;
};

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function validatePassPhotoFile(file: File) {
  if (!EXT_BY_TYPE[file.type]) return "Chỉ nhận ảnh JPG, PNG hoặc WebP.";
  if (file.size > PASS_PHOTO_MAX_BYTES) return "Ảnh tối đa 4MB. Vui lòng chọn ảnh nhẹ hơn.";
  return null;
}

export async function uploadPassPhoto({
  file,
  customerId,
  beneficiaryKind,
  beneficiaryId,
}: {
  file: File;
  customerId: string;
  beneficiaryKind: "USER" | "CHILD";
  beneficiaryId: string;
}): Promise<PassPhotoUpload> {
  const invalid = validatePassPhotoFile(file);
  if (invalid) throw new Error(invalid);

  const ext = EXT_BY_TYPE[file.type];
  const storagePath = [
    "passPhotos",
    customerId,
    beneficiaryKind,
    beneficiaryId,
    "drafts",
    `${Date.now()}-${crypto.randomUUID()}.${ext}`,
  ].join("/");

  await uploadBytes(ref(storage, storagePath), file, {
    contentType: file.type,
    customMetadata: {
      customerId,
      beneficiaryKind,
      beneficiaryId,
    },
  });

  return {
    storagePath,
    contentType: file.type,
    sizeBytes: file.size,
  };
}
