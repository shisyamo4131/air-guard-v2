import assert from "node:assert/strict";
import test from "node:test";
import { Outsourcer } from "../../schemas/index.js";
import { OUTSOURCER_DOCUMENT_FIELDS } from "../../utils/outsourcer/outsourcerDocumentContract.js";
import {
  OUTSOURCER_BUSINESS_FIELDS,
  OUTSOURCER_CREATE_FIELDS,
  OUTSOURCER_OPERATION,
  OutsourcerOperationError,
  changedOutsourcerFields,
  conflictingOutsourcerFields,
  outsourcerOperationFields,
  outsourcerOperationSchema,
  outsourcerSnapshot,
  prepareOutsourcerCreate,
  prepareOutsourcerUpdate,
} from "../../composables/domain/outsourcer/outsourcerOperations.js";

function validOutsourcer(overrides = {}) {
  return new Outsourcer({
    docId: "outsourcer-a",
    uid: "actor-a",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    code: "O001",
    name: "合成協力会社",
    nameKana: "ゴウセイキョウリョクガイシャ",
    displayName: "合成外注",
    contractStatus: Outsourcer.STATUS_ACTIVE,
    remarks: null,
    ...overrides,
  });
}

test("Outsourcer document and operation fields are exact", () => {
  assert.deepEqual(outsourcerOperationFields(OUTSOURCER_OPERATION.UPDATE), OUTSOURCER_BUSINESS_FIELDS);
  assert.deepEqual(outsourcerOperationFields(OUTSOURCER_OPERATION.CREATE), OUTSOURCER_CREATE_FIELDS);
  assert.equal(OUTSOURCER_CREATE_FIELDS.includes("contractStatus"), false);
  assert.deepEqual(OUTSOURCER_DOCUMENT_FIELDS, [
    "docId", "uid", "createdAt", "updatedAt", "code", "name", "nameKana",
    "displayName", "contractStatus", "remarks", "tokenMap",
  ]);
  assert.equal(
    outsourcerOperationSchema(OUTSOURCER_OPERATION.UPDATE).find(({ key }) => key === "displayName").length,
    6,
  );
  assert.throws(
    () => outsourcerOperationFields("ARCHIVE"),
    (error) => error instanceof OutsourcerOperationError && error.code === "invalid-operation",
  );
});

test("Outsourcer create forces ACTIVE and actor metadata", async () => {
  const now = new Date("2026-09-04T00:00:00.000Z");
  const candidate = await prepareOutsourcerCreate({
    draft: validOutsourcer({
      docId: "spoofed",
      uid: "spoofed",
      createdAt: null,
      updatedAt: null,
      contractStatus: Outsourcer.STATUS_TERMINATED,
    }),
    docId: "created-outsourcer",
    actorUid: "actor-b",
    now,
  });
  assert.equal(candidate.docId, "created-outsourcer");
  assert.equal(candidate.uid, "actor-b");
  assert.equal(candidate.createdAt, now);
  assert.equal(candidate.updatedAt, now);
  assert.equal(candidate.contractStatus, Outsourcer.STATUS_ACTIVE);
});

test("Outsourcer types, required values, lengths, and status are enforced", async () => {
  const cases = [
    { name: null },
    { name: "x".repeat(21) },
    { nameKana: "x".repeat(41) },
    { displayName: "x".repeat(7) },
    { code: "x".repeat(11) },
    { remarks: "x".repeat(201) },
    { code: 123 },
  ];
  for (const override of cases) {
    await assert.rejects(
      () => prepareOutsourcerCreate({
        draft: validOutsourcer(override),
        docId: "created-outsourcer",
        actorUid: "actor-a",
        now: new Date(),
      }),
      (error) => error instanceof OutsourcerOperationError && error.code === "invalid-outsourcer",
    );
  }

  const latest = validOutsourcer();
  await assert.rejects(
    () => prepareOutsourcerUpdate({
      latest,
      baseline: outsourcerSnapshot(latest),
      draft: validOutsourcer({ contractStatus: "UNKNOWN" }),
      actorUid: "actor-a",
      now: new Date(),
    }),
    (error) => error instanceof OutsourcerOperationError && error.code === "invalid-outsourcer",
  );
});

test("Outsourcer update merges a disjoint external change and patches only edited fields", async () => {
  const baselineSource = validOutsourcer();
  const baseline = outsourcerSnapshot(baselineSource);
  const latest = validOutsourcer({ contractStatus: Outsourcer.STATUS_TERMINATED });
  const draft = validOutsourcer({ remarks: "入力中" });
  assert.deepEqual(changedOutsourcerFields({ baseline, draft }), ["remarks"]);
  assert.deepEqual(conflictingOutsourcerFields({ baseline, latest, draft }), []);

  const prepared = await prepareOutsourcerUpdate({
    latest,
    baseline,
    draft,
    actorUid: "actor-b",
    now: new Date("2026-09-04T01:00:00.000Z"),
  });
  assert.deepEqual(prepared.fields, ["remarks"]);
  assert.equal(prepared.candidate.remarks, "入力中");
  assert.equal(prepared.candidate.contractStatus, Outsourcer.STATUS_TERMINATED);
  assert.equal(prepared.candidate.uid, "actor-b");
});

test("Outsourcer update rejects a conflict on the same edited field", async () => {
  const baselineSource = validOutsourcer();
  const baseline = outsourcerSnapshot(baselineSource);
  const latest = validOutsourcer({ remarks: "別画面" });
  const draft = validOutsourcer({ remarks: "入力中" });
  assert.deepEqual(conflictingOutsourcerFields({ baseline, latest, draft }), ["remarks"]);
  await assert.rejects(
    () => prepareOutsourcerUpdate({
      latest,
      baseline,
      draft,
      actorUid: "actor-a",
      now: new Date(),
    }),
    (error) => error instanceof OutsourcerOperationError && error.code === "conflict",
  );
});

test("Outsourcer unchanged update is a no-op", async () => {
  const latest = validOutsourcer();
  const prepared = await prepareOutsourcerUpdate({
    latest,
    baseline: outsourcerSnapshot(latest),
    draft: latest.clone(),
    actorUid: "actor-b",
    now: new Date(),
  });
  assert.deepEqual(prepared.fields, []);
  assert.equal(prepared.candidate.uid, "actor-a");
});
