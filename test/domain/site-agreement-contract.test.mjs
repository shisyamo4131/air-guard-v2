import assert from "node:assert/strict";
import test from "node:test";

import {
  SITE_AGREEMENT_DAY_TYPES,
  SITE_AGREEMENT_FIELDS,
  SITE_AGREEMENT_RATE_FIELDS,
  SiteAgreementContractError,
  createSiteAgreementUpdateRequest,
  siteAgreementWorkIntervalMinutes,
  siteAgreementsHaveZeroPrice,
} from "../../composables/domain/site/siteAgreementContract.js";
import {
  SITE_AGREEMENT_ERROR_CODES,
  SiteAgreementUpdateError,
  updateSiteAgreements,
} from "../../functions/modules/sites/updateSiteAgreements.js";
import {
  SiteAgreementContractError as ServerSiteAgreementContractError,
  parseSiteAgreementUpdateInput,
} from "../../functions/modules/sites/siteAgreementContract.js";

function rates(value = 1_000) {
  return Object.fromEntries(SITE_AGREEMENT_DAY_TYPES.map((day) => [
    day,
    Object.fromEntries(SITE_AGREEMENT_RATE_FIELDS.map((field) => [field, value])),
  ]));
}

function agreement(overrides = {}) {
  return {
    date: "2026-09-05",
    shiftType: "DAY",
    startTime: "08:00",
    isStartNextDay: false,
    endTime: "17:00",
    breakMinutes: 60,
    regulationWorkMinutes: 480,
    rates: rates(),
    billingUnitType: "PER_DAY",
    includeBreakInBilling: false,
    cutoffDate: 0,
    ...overrides,
  };
}

function input(overrides = {}) {
  return {
    siteId: "site-a",
    baselineAgreements: [agreement()],
    candidateAgreements: [agreement({ cutoffDate: 5 })],
    ...overrides,
  };
}

test("Site Agreement transport is exact and preserves all 16 bounded integer prices including zero", () => {
  const zero = agreement({ rates: rates(0) });
  const maximum = agreement({ rates: rates(10_000_000) });
  assert.equal(siteAgreementsHaveZeroPrice([zero]), true);
  assert.equal(siteAgreementsHaveZeroPrice([agreement()]), false);
  for (const candidate of [zero, maximum]) {
    const request = createSiteAgreementUpdateRequest(input({ candidateAgreements: [candidate] }));
    assert.deepEqual(Object.keys(request).sort(), [
      "baselineAgreements", "candidateAgreements", "siteId",
    ].sort());
    assert.deepEqual(Object.keys(request.candidateAgreements[0]), SITE_AGREEMENT_FIELDS);
    for (const day of SITE_AGREEMENT_DAY_TYPES) {
      assert.deepEqual(Object.keys(request.candidateAgreements[0].rates[day]), SITE_AGREEMENT_RATE_FIELDS);
    }
    assert.doesNotThrow(() => parseSiteAgreementUpdateInput(request));
  }

  for (const invalid of [-1, 0.5, 10_000_001, "1000", Number.NaN]) {
    for (const day of SITE_AGREEMENT_DAY_TYPES) {
      for (const field of SITE_AGREEMENT_RATE_FIELDS) {
        const invalidRates = rates();
        invalidRates[day][field] = invalid;
        assert.throws(
          () => createSiteAgreementUpdateRequest(input({
            candidateAgreements: [agreement({ rates: invalidRates })],
          })),
          SiteAgreementContractError,
          `${day}.${field}=${String(invalid)}`,
        );
      }
    }
  }

  assert.throws(
    () => parseSiteAgreementUpdateInput({ ...input(), extra: true }),
    ServerSiteAgreementContractError,
  );
  assert.throws(
    () => parseSiteAgreementUpdateInput(input({
      candidateAgreements: [{ ...agreement(), extra: true }],
    })),
    ServerSiteAgreementContractError,
  );
  const extraRate = agreement();
  extraRate.rates.WEEKDAY.extra = 1;
  assert.throws(
    () => parseSiteAgreementUpdateInput(input({ candidateAgreements: [extraRate] })),
    ServerSiteAgreementContractError,
  );
});

test("Site Agreement time, cutoff, and duplicate boundaries cover overnight and equal-time 24h", () => {
  assert.equal(siteAgreementWorkIntervalMinutes("08:00", "17:00"), 540);
  assert.equal(siteAgreementWorkIntervalMinutes("22:00", "05:00"), 420);
  assert.equal(siteAgreementWorkIntervalMinutes("08:00", "08:00"), 1440);
  for (const cutoffDate of [0, 5, 10, 15, 20, 25]) {
    assert.doesNotThrow(() => createSiteAgreementUpdateRequest(input({
      candidateAgreements: [agreement({ cutoffDate })],
    })));
  }
  for (const [field, accepted] of [["breakMinutes", [0, 540]], ["regulationWorkMinutes", [0, 1440]]]) {
    for (const value of accepted) assert.doesNotThrow(() => createSiteAgreementUpdateRequest(input({
      candidateAgreements: [agreement({ [field]: value })],
    })));
    for (const value of [-1, 0.5, 1441, "1"]) assert.throws(
      () => createSiteAgreementUpdateRequest(input({
        candidateAgreements: [agreement({ [field]: value })],
      })),
      SiteAgreementContractError,
    );
  }
  assert.doesNotThrow(() => createSiteAgreementUpdateRequest(input({
    candidateAgreements: [agreement({ startTime: "22:00", endTime: "05:00", breakMinutes: 420 })],
  })));
  assert.doesNotThrow(() => createSiteAgreementUpdateRequest(input({
    candidateAgreements: [agreement({ startTime: "08:00", endTime: "08:00", breakMinutes: 1440 })],
  })));
  assert.throws(() => createSiteAgreementUpdateRequest(input({
    candidateAgreements: [agreement({ breakMinutes: 541 })],
  })), SiteAgreementContractError);
  for (const cutoffDate of [1, 30, "0", 0.5]) assert.throws(
    () => createSiteAgreementUpdateRequest(input({ candidateAgreements: [agreement({ cutoffDate })] })),
    SiteAgreementContractError,
  );
  assert.throws(() => createSiteAgreementUpdateRequest(input({
    candidateAgreements: [agreement(), agreement()],
  })), SiteAgreementContractError);
});

const identity = Object.freeze({ uid: "actor-a", companyId: "company-a", isSuperUser: false });
const manager = Object.freeze({
  docId: "actor-a", companyId: "company-a", isTemporary: false,
  disabled: false, isAdmin: false, roles: ["manager"],
});

function snapshot(data) {
  return data === null ? { exists: false, data: () => undefined } : { exists: true, data: () => data };
}

function fakeFirestore({ actor = manager, system = { isMaintenance: false }, site, siteExists = true } = {}) {
  const calls = [];
  const writes = [];
  const currentSite = site ?? { docId: "site-a", status: "ACTIVE", agreementsV2: [agreement()] };
  const firestore = {
    doc(path) { return { path }; },
    async runTransaction(callback) {
      return callback({
        async get(ref) {
          calls.push(`get:${ref.path}`);
          if (ref.path === "System/system") return snapshot(system);
          if (ref.path.endsWith("/Users/actor-a")) return snapshot(actor);
          return snapshot(siteExists ? currentSite : null);
        },
        update(ref, patch) {
          calls.push(`update:${ref.path}`);
          writes.push({ ref, patch });
        },
      });
    },
  };
  return { calls, firestore, writes };
}

async function rejectsCode(operation, code) {
  await assert.rejects(operation, (error) => {
    assert.ok(error instanceof SiteAgreementUpdateError);
    assert.equal(error.code, code);
    return true;
  });
}

test("Site Agreement Callable enforces strict actors and writes only agreements plus Site metadata", async () => {
  const allowed = [
    { actor: { ...manager, isAdmin: true, roles: [] }, currentIdentity: identity },
    { actor: { ...manager, isAdmin: true, roles: [] }, currentIdentity: { ...identity, isSuperUser: true } },
    ...["manager", "controller", "legal"].map((role) => ({
      actor: { ...manager, roles: [role] }, currentIdentity: identity,
    })),
  ];
  for (const scenario of allowed) {
    const harness = fakeFirestore({ actor: scenario.actor });
    assert.deepEqual(await updateSiteAgreements({
      firestore: harness.firestore, identity: scenario.currentIdentity, input: input(),
    }), { success: true, updated: true });
    assert.equal(harness.writes.length, 1);
    assert.deepEqual(Object.keys(harness.writes[0].patch).sort(), ["agreementsV2", "uid", "updatedAt"]);
    assert.equal(harness.writes[0].patch.uid, "actor-a");
    assert.ok(harness.calls.slice(0, 3).every((call) => call.startsWith("get:")));
  }

  const denied = [
    { ...manager, roles: ["accountant"] },
    { ...manager, roles: ["human-resource"] },
    { ...manager, roles: ["labor"] },
    { ...manager, roles: [], permissions: ["sites:write"] },
    { ...manager, roles: ["unknown-role"] },
    { ...manager, roles: ["manager", "unknown-role"] },
    { ...manager, roles: ["manager"] },
    { ...manager, roles: ["manager"], isTemporary: true },
    { ...manager, roles: ["manager"], disabled: true },
    { ...manager, roles: ["manager"], companyId: "company-b" },
  ];
  for (let index = 0; index < denied.length; index += 1) {
    const harness = fakeFirestore({ actor: denied[index] });
    const currentIdentity = index === 6 ? { ...identity, isSuperUser: true } : identity;
    await rejectsCode(
      updateSiteAgreements({ firestore: harness.firestore, identity: currentIdentity, input: input() }),
      SITE_AGREEMENT_ERROR_CODES.ACTOR_NOT_ALLOWED,
    );
    assert.equal(harness.writes.length, 0);
  }
});

test("Site Agreement Callable is fail-closed, detects conflict, skips no-op, and leaves snapshots untouched", async () => {
  for (const system of [null, {}, { isMaintenance: true }]) {
    const harness = fakeFirestore({ system });
    await rejectsCode(
      updateSiteAgreements({ firestore: harness.firestore, identity, input: input() }),
      SITE_AGREEMENT_ERROR_CODES.MAINTENANCE,
    );
    assert.equal(harness.writes.length, 0);
  }
  for (const scenario of [
    { siteExists: false, code: SITE_AGREEMENT_ERROR_CODES.SITE_NOT_FOUND },
    {
      site: { docId: "site-a", status: "TERMINATED", agreementsV2: [agreement()] },
      code: SITE_AGREEMENT_ERROR_CODES.INVALID_STATE,
    },
  ]) {
    const harness = fakeFirestore(scenario);
    await rejectsCode(
      updateSiteAgreements({ firestore: harness.firestore, identity, input: input() }),
      scenario.code,
    );
    assert.equal(harness.writes.length, 0);
  }
  const conflict = fakeFirestore({
    site: { docId: "site-a", status: "ACTIVE", agreementsV2: [agreement({ cutoffDate: 10 })] },
  });
  await rejectsCode(
    updateSiteAgreements({ firestore: conflict.firestore, identity, input: input() }),
    SITE_AGREEMENT_ERROR_CODES.CONFLICT,
  );
  assert.equal(conflict.writes.length, 0);

  const unchangedOperationResult = Object.freeze({ agreementsV2: [agreement({ cutoffDate: 15 })] });
  const noOp = fakeFirestore();
  assert.deepEqual(await updateSiteAgreements({
    firestore: noOp.firestore,
    identity,
    input: input({ candidateAgreements: [agreement()] }),
  }), { success: true, updated: false });
  assert.equal(noOp.writes.length, 0);
  assert.equal(unchangedOperationResult.agreementsV2[0].cutoffDate, 15);
});
