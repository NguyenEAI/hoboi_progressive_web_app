import test from "node:test";
import assert from "node:assert/strict";
import { HttpsError } from "firebase-functions/v2/https";
import {
  assertReason,
  buildCustomerProfilePatch,
  buildServicePatch,
  pickBeforeAfter,
} from "./customerAdmin";

test("Owner customer profile patch only accepts supported fields", () => {
  const patch = buildCustomerProfilePatch({
    fullName: "Nguyen Van A",
    phone: "0905123456",
    address: "",
    heightCm: "150",
    audience: "ADULT",
    disabled: false,
  });
  assert.equal(patch.fullName, "Nguyen Van A");
  assert.equal(patch.phone, "+84905123456");
  assert.equal(patch.address, null);
  assert.equal(patch.heightCm, 150);
  assert.throws(
    () => buildCustomerProfilePatch({ role: "OWNER" }),
    (err) => err instanceof HttpsError && err.code === "invalid-argument",
  );
});

test("Owner service patch validates session invariants", () => {
  const patch = buildServicePatch("PACKAGE", { totalSessions: 20, remainingSessions: 5 }, { totalSessions: 15, remainingSessions: 3 });
  assert.equal(patch.totalSessions, 20);
  assert.equal(patch.remainingSessions, 5);
  assert.throws(
    () => buildServicePatch("PACKAGE", { totalSessions: 10, remainingSessions: 11 }, { totalSessions: 15, remainingSessions: 3 }),
    (err) => err instanceof HttpsError && err.code === "invalid-argument",
  );
  assert.throws(
    () => buildServicePatch("COURSE", { status: "SUSPENDED" }, { totalSessions: 15, attendedSessions: 1 }),
    (err) => err instanceof HttpsError && err.code === "invalid-argument",
  );
});

test("Owner audit payload captures before and after fields", () => {
  assert.equal(assertReason("Nhap sai ngay het han"), "Nhap sai ngay het han");
  const diff = pickBeforeAfter({ status: "EXPIRED", remainingSessions: 0 }, { status: "ACTIVE", remainingSessions: 3 });
  assert.deepEqual(diff.fields, ["status", "remainingSessions"]);
  assert.deepEqual(diff.before, { status: "EXPIRED", remainingSessions: 0 });
  assert.deepEqual(diff.after, { status: "ACTIVE", remainingSessions: 3 });
});
