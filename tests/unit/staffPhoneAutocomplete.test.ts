import test from "node:test";
import assert from "node:assert/strict";
import { normalizeLocalPhone, selectedSuggestionPhone } from "../../src/lib/staffPhoneAutocomplete";

test("selectedSuggestionPhone returns the full selected local number", () => {
  const selected = selectedSuggestionPhone(
    { local: "0938123456" },
    normalizeLocalPhone,
    10,
  );
  assert.equal(selected, "0938123456");
});

test("selectedSuggestionPhone applies caller normalization and max length", () => {
  const selected = selectedSuggestionPhone(
    { local: "0938 123 456" },
    (value) => value.replace(/\D/g, ""),
    7,
  );
  assert.equal(selected, "0938123");
});
