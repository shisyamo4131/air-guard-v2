import assert from "node:assert/strict";
import test from "node:test";
import {
  isValidCompanyNameKana,
  isValidFirestorePathSegment,
  readOnlyAuthUsers,
  readOnlyCompanyDocuments,
} from "../../scripts/verify-codex-local-ui-state.mjs";

function jsonResponse(value) {
  return {
    ok: true,
    async json() {
      return value;
    },
  };
}

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

test("Auth verifier contract performs one POST only to the Auth Emulator", async () => {
  const calls = [];
  const result = await readOnlyAuthUsers(async (url, options) => {
    calls.push({ url, options });
    return jsonResponse({ userInfo: [{ localId: "synthetic-user" }] });
  });

  assert.deepEqual(result, {
    users: [{ localId: "synthetic-user" }],
    hasMore: false,
  });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^http:\/\/127\.0\.0\.1:19099\//);
  assert.doesNotMatch(calls[0].url, /18080/);
  assert.equal(calls[0].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].options.body), { maxResults: 2 });
  assert.equal(calls[0].options.headers.authorization, "Bearer owner");
});

test("Firestore verifier contract performs GET only for Company and User", async () => {
  const calls = [];
  const result = await readOnlyCompanyDocuments(
    { companyId: "company id", userId: "user+id" },
    async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({ name: url });
    },
  );

  assert.equal(calls.length, 2);
  assert.ok(calls.every(({ url }) => url.startsWith("http://127.0.0.1:18080/")));
  assert.ok(calls.every(({ url }) => !url.includes("19099")));
  assert.ok(calls.every(({ options }) => options.method === "GET"));
  assert.ok(calls.every(({ options }) => options.body === undefined));
  assert.match(calls[0].url, /Companies\/company%20id$/);
  assert.match(calls[1].url, /Companies\/company%20id\/Users\/user%2Bid$/);
  assert.equal(result.company.name, calls[0].url);
  assert.equal(result.user.name, calls[1].url);
});
