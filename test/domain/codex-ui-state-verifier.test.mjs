import assert from "node:assert/strict";
import test from "node:test";
import {
  isValidCompanyNameKana,
  isValidFirestorePathSegment,
} from "../../scripts/verify-codex-local-ui-state.mjs";

test("UI verifier accepts one safe Firestore document path segment", () => {
  for (const value of ["company-1", "AbCdEf0123456789", "会社ID"]) {
    assert.equal(isValidFirestorePathSegment(value), true, value);
  }
});

test("UI verifier pins a nonempty company katakana value up to 40 characters", () => {
  for (const value of ["コーデックスガイシャ", "コーデックス　ガイシャ", "コーデックス ガイシャ"]) {
    assert.equal(isValidCompanyNameKana(value), true, value);
  }
  for (const value of ["", "会社", "コーデックス\nガイシャ", "ア".repeat(41), null]) {
    assert.equal(isValidCompanyNameKana(value), false, String(value));
  }
});

test("UI verifier rejects empty, ambiguous, nested, padded, and oversized segments", () => {
  for (const value of [
    "",
    ".",
    "..",
    "company/child",
    " company",
    "company ",
    "company\0child",
    "a".repeat(1501),
    null,
  ]) {
    assert.equal(isValidFirestorePathSegment(value), false, String(value));
  }
});
