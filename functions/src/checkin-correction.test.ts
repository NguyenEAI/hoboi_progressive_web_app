import test from "node:test";
import assert from "node:assert/strict";
import { HttpsError } from "firebase-functions/v2/https";
import { computeCourseAttendanceUndo, computePackageCorrection } from "./checkin";

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

test("course attendance undo decrements one session without restoring active course", () => {
  const result = computeCourseAttendanceUndo({
    attendedSessions: 8,
    totalSessions: 15,
    alreadyUndone: false,
    enrollmentStatus: "ACTIVE",
    completedByThisCheckin: false,
  });
  assert.equal(result.before, 8);
  assert.equal(result.after, 7);
  assert.equal(result.restoreActive, false);
  assert.equal(result.slotEnrolledAfter, undefined);
});

test("course attendance undo restores slot only when undoing completion attendance", () => {
  const result = computeCourseAttendanceUndo({
    attendedSessions: 15,
    totalSessions: 15,
    alreadyUndone: false,
    enrollmentStatus: "COMPLETED",
    completedByThisCheckin: true,
    slotEnrolledCount: 19,
    slotCapacity: 20,
  });
  assert.equal(result.after, 14);
  assert.equal(result.restoreActive, true);
  assert.equal(result.slotEnrolledAfter, 20);
});

test("course attendance undo blocks duplicate undo and full slot restore", () => {
  assert.throws(
    () => computeCourseAttendanceUndo({
      attendedSessions: 3,
      totalSessions: 15,
      alreadyUndone: true,
      enrollmentStatus: "ACTIVE",
      completedByThisCheckin: false,
    }),
    (err) => err instanceof HttpsError && err.code === "failed-precondition",
  );
  assert.throws(
    () => computeCourseAttendanceUndo({
      attendedSessions: 15,
      totalSessions: 15,
      alreadyUndone: false,
      enrollmentStatus: "COMPLETED",
      completedByThisCheckin: true,
      slotEnrolledCount: 20,
      slotCapacity: 20,
    }),
    (err) => err instanceof HttpsError && err.code === "failed-precondition",
  );
});
