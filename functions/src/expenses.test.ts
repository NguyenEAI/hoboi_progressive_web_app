import test from "node:test";
import assert from "node:assert/strict";
import { HttpsError } from "firebase-functions/v2/https";
import { canModifyExpense, validateExpenseInput } from "./expenses";

test("validate rejects invalid amount", () => {
  assert.throws(
    () => validateExpenseInput({ date: "2026-08-17", amount: 0, category: "ELECTRICITY", paymentMethod: "CASH", paidBy: "OWNER" }),
    (err) => err instanceof HttpsError && err.code === "invalid-argument",
  );
});

test("validate rejects unknown category", () => {
  assert.throws(
    () => validateExpenseInput({ date: "2026-08-17", amount: 100000, category: "FOOBAR", paymentMethod: "CASH", paidBy: "OWNER" }),
    (err) => err instanceof HttpsError && err.code === "invalid-argument",
  );
});

test("validate accepts formatted amount string", () => {
  const res = validateExpenseInput({
    date: "2026-08-17",
    amount: "1.500.000",
    category: "ELECTRICITY",
    paymentMethod: "TRANSFER",
    paidBy: "RECEPTIONIST",
    paidByName: "Chị Lan",
    note: "  Tiền điện tháng 8  ",
  });
  assert.equal(res.amount, 1_500_000);
  assert.equal(res.category, "ELECTRICITY");
  assert.equal(res.paymentMethod, "TRANSFER");
  assert.equal(res.paidBy, "RECEPTIONIST");
  assert.equal(res.note, "Tiền điện tháng 8");
  assert.equal(res.paidByName, "Chị Lan");
});

test("validate rejects bad receipt path", () => {
  assert.throws(
    () => validateExpenseInput({
      date: "2026-08-17",
      amount: 50000,
      category: "OTHER",
      paymentMethod: "CASH",
      paidBy: "OWNER",
      receiptPhoto: { storagePath: "  " },
    }),
    (err) => err instanceof HttpsError && err.code === "invalid-argument",
  );
});

test("owner can always modify expense", () => {
  assert.equal(
    canModifyExpense({
      role: "OWNER",
      actorUid: "owner1",
      createdBy: "receptionist1",
      createdAtMs: Date.now() - 30 * 24 * 60 * 60 * 1000,
      nowMs: Date.now(),
    }),
    true,
  );
});

test("receptionist can modify own expense within 24h", () => {
  const now = Date.now();
  assert.equal(
    canModifyExpense({
      role: "RECEPTIONIST",
      actorUid: "r1",
      createdBy: "r1",
      createdAtMs: now - 3 * 60 * 60 * 1000,
      nowMs: now,
    }),
    true,
  );
});

test("receptionist blocked past 24h window", () => {
  const now = Date.now();
  assert.equal(
    canModifyExpense({
      role: "RECEPTIONIST",
      actorUid: "r1",
      createdBy: "r1",
      createdAtMs: now - 25 * 60 * 60 * 1000,
      nowMs: now,
    }),
    false,
  );
});

test("receptionist cannot modify someone else's expense", () => {
  assert.equal(
    canModifyExpense({
      role: "RECEPTIONIST",
      actorUid: "r1",
      createdBy: "r2",
      createdAtMs: Date.now(),
      nowMs: Date.now(),
    }),
    false,
  );
});
