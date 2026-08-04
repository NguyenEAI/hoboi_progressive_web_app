import test from "node:test";
import assert from "node:assert/strict";
import { HttpsError } from "firebase-functions/v2/https";
import { computePackageCorrection } from "./checkin";

test("package correction refunds remaining visit count accurately", () => {
  const result = computePackageCorrection({
    mode: "PARTIAL",
    refundCount: 2,
    originalCount: 4,
    alreadyRefunded: 1,
    remainingSessions: 5,
    totalSessions: 15,
  });
  assert.equal(result.count, 2);
  assert.equal(result.after, 7);
  assert.equal(result.correctionStatus, "PARTIALLY_REFUNDED");
});

test("package correction cancels only the still-refundable count", () => {
  const result = computePackageCorrection({
    mode: "CANCEL",
    originalCount: 3,
    alreadyRefunded: 1,
    remainingSessions: 8,
    totalSessions: 15,
  });
  assert.equal(result.count, 2);
  assert.equal(result.after, 10);
  assert.equal(result.correctionStatus, "CANCELLED_OR_FULLY_REFUNDED");
});

test("package correction blocks duplicate and over-refund cases", () => {
  assert.throws(
    () => computePackageCorrection({
      mode: "CANCEL",
      originalCount: 2,
      alreadyRefunded: 2,
      remainingSessions: 10,
      totalSessions: 15,
    }),
    (err) => err instanceof HttpsError && err.code === "failed-precondition",
  );
  assert.throws(
    () => computePackageCorrection({
      mode: "PARTIAL",
      refundCount: 2,
      originalCount: 2,
      alreadyRefunded: 0,
      remainingSessions: 14,
      totalSessions: 15,
    }),
    (err) => err instanceof HttpsError && err.code === "failed-precondition",
  );
});
