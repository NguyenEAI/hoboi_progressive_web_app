import test from "node:test";
import assert from "node:assert/strict";
import { HttpsError } from "firebase-functions/v2/https";
import { assertQrPurposeCanUseKind, normalizeQrPurpose } from "./checkin";

test("normalizeQrPurpose chỉ nhận COURSE rõ ràng, còn lại mặc định VISIT", () => {
  assert.equal(normalizeQrPurpose(undefined), "VISIT");
  assert.equal(normalizeQrPurpose("VISIT"), "VISIT");
  assert.equal(normalizeQrPurpose("course"), "COURSE");
  assert.equal(normalizeQrPurpose("PACKAGE"), "VISIT");
});

test("QR COURSE không được dùng để trừ vé lượt/vé thời hạn", () => {
  assert.doesNotThrow(() => assertQrPurposeCanUseKind("COURSE", "COURSE"));
  assert.throws(
    () => assertQrPurposeCanUseKind("COURSE", "PACKAGE"),
    (err) => err instanceof HttpsError && err.code === "failed-precondition",
  );
  assert.throws(
    () => assertQrPurposeCanUseKind("COURSE", "MEMBERSHIP"),
    (err) => err instanceof HttpsError && err.code === "failed-precondition",
  );
});

test("QR VISIT không được dùng để điểm danh khóa học", () => {
  assert.doesNotThrow(() => assertQrPurposeCanUseKind("VISIT", "PACKAGE"));
  assert.doesNotThrow(() => assertQrPurposeCanUseKind("VISIT", undefined));
  assert.throws(
    () => assertQrPurposeCanUseKind("VISIT", "COURSE"),
    (err) => err instanceof HttpsError && err.code === "failed-precondition",
  );
});
