import test from "node:test";
import assert from "node:assert/strict";
import { Employee, Insurance } from "@shisyamo4131/air-guard-v2-schemas";
import * as serverValue from "../../functions/shared/employeeContract.js";
import * as serverInsurance from "../../functions/shared/employeeInsuranceContract.js";
import * as serverArchive from "../../functions/shared/employeeArchiveContract.js";
import * as clientValue from "../../composables/domain/shared/valueContract.js";
import * as clientEdit from "../../composables/domain/employee/employeeEditContract.js";
import * as clientInsurance from "../../composables/domain/employee/employeeInsuranceContract.js";
import * as clientArchive from "../../composables/domain/employee/employeeArchiveContract.js";
import { isEmployeeUxActorAllowed } from "../../utils/auth/policies/employeeActorPolicy.js";

const identity = { uid: "actor", companyId: "company", isSuperUser: false };
const actor = {
  docId: "actor",
  companyId: "company",
  isAdmin: false,
  disabled: false,
  isTemporary: false,
  roles: ["human-resource"],
};

function validEmployee() {
  return new Employee({
    docId: "employee",
    lastName: "試験",
    firstName: "太郎",
    lastNameKana: "シケン",
    firstNameKana: "タロウ",
    displayName: "試験太郎",
    displayNameKana: "シケンタロウ",
    gender: "MALE",
    dateOfBirth: serverValue.parseDate("1990-01-01"),
    dateOfHire: serverValue.parseDate("2026-01-01"),
    zipcode: "1000001",
    prefCode: "13",
    city: "試験市",
    address: "合成一丁目",
  }).toObject();
}

const certification = (name = "試験資格", serialNumber = "A") => ({
  name,
  key: name,
  type: "TRAFFIC",
  issuedBy: "合成機関",
  issueDateAt: serverValue.parseDate("2026-01-01"),
  expirationDateAt: null,
  serialNumber,
});

function assertPatchParity(raw, changes, operation, options = {}) {
  const input = {
    employeeId: "employee",
    changes,
    expected: {},
    ...(operation === "certifications" ? options : {}),
  };
  const clientInput = clientEdit.parseEmployeeInput(operation, input);
  const serverInput = serverValue.parseEmployeeInput(operation, input);
  assert.deepEqual(
    clientValue.encodeExpected(clientInput),
    serverValue.encodeExpected(serverInput),
    `${operation} input`,
  );
  const client = clientEdit.buildEmployeePatch(
    raw,
    clientInput.changes,
    operation,
    options,
  );
  const server = serverValue.buildEmployeePatch(
    raw,
    serverInput.changes,
    operation,
    options,
  );
  assert.deepEqual(
    clientValue.encodeExpected(client.patch),
    serverValue.encodeExpected(server.patch),
    `${operation} patch`,
  );
  assert.deepEqual(
    clientValue.encodeExpected(client.model.toObject()),
    serverValue.encodeExpected(server.model.toObject()),
    `${operation} candidate`,
  );
}

test("client value encoding stays wire-compatible with the Functions contract", () => {
  const timestamp = {
    seconds: 10,
    nanoseconds: 123,
    toDate: () => new Date(10000),
  };
  const values = [
    undefined,
    null,
    new Date("2026-01-01T00:00:00.123Z"),
    timestamp,
    ["x", null],
    { z: true, a: 1 },
  ];
  for (const value of values) {
    assert.deepEqual(clientValue.encodeExpected(value), serverValue.encodeExpected(value));
  }
  for (const value of [null, "2026-01-01"]) {
    assert.deepEqual(
      clientValue.encodeExpected(clientValue.parseDate(value)),
      serverValue.encodeExpected(serverValue.parseDate(value)),
    );
  }
});

test("client employee UX gating and edit request projection match Functions inputs", () => {
  for (const roles of [[], ["controller"], ["manager"], ["human-resource"]]) {
    const current = { ...actor, roles };
    assert.equal(
      isEmployeeUxActorAllowed({ ...identity, actorUser: current }),
      serverValue.employeeAllowed({ ...identity, actorUser: current }),
    );
    assert.equal(
      isEmployeeUxActorAllowed({ ...identity, actorUser: current }, false),
      serverValue.employeeAllowed({ ...identity, actorUser: current }, false),
    );
  }
  for (const operation of [
    "create",
    "basic",
    "nationality",
    "security",
    "certifications",
  ]) {
    assert.deepEqual(
      clientEdit.operationFields(operation),
      serverValue.operationFields(operation),
    );
    assert.deepEqual(
      clientEdit.operationSchema(operation).map(({ key }) => key),
      serverValue.operationSchema(operation).map(({ key }) => key),
    );
  }
  const input = {
    employeeId: "employee",
    changes: { dateOfHire: "2026-02-01", title: "主任" },
    expected: {},
  };
  assert.deepEqual(
    clientValue.encodeExpected(clientEdit.parseEmployeeInput("basic", input)),
    serverValue.encodeExpected(serverValue.parseEmployeeInput("basic", input)),
  );

  const raw = validEmployee();
  const changes = { firstName: "次郎", address: "合成二丁目" };
  const client = clientEdit.buildEmployeePatch(raw, changes, "basic");
  const server = serverValue.buildEmployeePatch(raw, changes, "basic");
  assert.deepEqual(
    clientValue.encodeExpected(client.patch),
    serverValue.encodeExpected(server.patch),
  );
});

test("client employee edit projections cover every migrated Functions branch", () => {
  const initial = new Employee().toObject();
  const created = validEmployee();
  const createChanges = Object.fromEntries(
    clientEdit.operationFields("create").map((field) => [
      field,
      clientEdit.DATE_FIELDS.includes(field)
        ? clientValue.dateInput(created[field])
        : created[field],
    ]),
  );
  assertPatchParity(initial, createChanges, "create");

  const basic = validEmployee();
  assertPatchParity(basic, { firstName: "次郎" }, "basic");
  assertPatchParity(
    basic,
    { firstName: "次郎", displayName: "明示表示名" },
    "basic",
  );

  const foreign = {
    ...validEmployee(),
    isForeigner: true,
    foreignName: "Synthetic Person",
    nationality: "試験国",
    residenceStatus: "試験資格",
    hasPeriodOfStayLimit: true,
    periodOfStay: serverValue.parseDate("2027-01-01"),
    hasWorkRestrictions: true,
  };
  assertPatchParity(
    foreign,
    {
      isForeigner: false,
      foreignName: "残留不可",
      nationality: "残留不可",
      residenceStatus: "残留不可",
      hasPeriodOfStayLimit: true,
      periodOfStay: "2028-01-01",
      hasWorkRestrictions: true,
    },
    "nationality",
  );
  assertPatchParity(
    foreign,
    {
      hasPeriodOfStayLimit: false,
      periodOfStay: "2028-01-01",
    },
    "nationality",
  );

  const registered = {
    ...validEmployee(),
    hasSecurityGuardRegistration: true,
    dateOfSecurityGuardRegistration: serverValue.parseDate("2026-01-01"),
    bloodType: "B",
    emergencyContactName: "合成家族",
    emergencyContactRelation: "OTHER",
    emergencyContactRelationDetail: "その他",
    emergencyContactAddress: "合成住所",
    emergencyContactPhone: "09012345678",
    domicile: "合成本籍",
  };
  assertPatchParity(
    registered,
    {
      hasSecurityGuardRegistration: false,
      bloodType: "O",
      emergencyContactName: "残留不可",
    },
    "security",
  );

  let certifications = {
    ...validEmployee(),
    securityCertifications: [certification("既存資格", "A")],
  };
  assertPatchParity(
    certifications,
    {
      name: "追加資格",
      type: "TRAFFIC",
      issuedBy: "合成機関",
      issueDateAt: "2026-02-01",
      expirationDateAt: null,
      serialNumber: "B",
    },
    "certifications",
    { action: "add", position: null },
  );
  assertPatchParity(
    certifications,
    { name: "更新資格", serialNumber: "C" },
    "certifications",
    { action: "update", position: 0 },
  );
  assertPatchParity(
    certifications,
    {},
    "certifications",
    { action: "remove", position: 0 },
  );
});

test("client insurance request projection matches Functions contract", () => {
  assert.deepEqual(
    clientInsurance.INSURANCE_ACTION_FIELDS,
    serverInsurance.INSURANCE_ACTION_FIELDS,
  );
  const raw = {
    healthInsurance: new Insurance().toObject(),
    pensionInsurance: new Insurance().toObject(),
    employmentInsurance: new Insurance().toObject(),
    insuranceOperationVersions: {
      healthInsurance: 0,
      pensionInsurance: 0,
      employmentInsurance: 0,
    },
  };
  const enrolled = (processing = false) => {
    const value = new Insurance();
    value.enroll({
      enrollmentDateAt: serverValue.parseDate("2026-01-01"),
      number: "SYNTHETIC",
      isProcessing: processing,
    });
    return value.toObject();
  };
  for (const action of [
    "enroll",
    "enrolled",
    "cancelEnroll",
    "exempt",
    "loss",
    "rollback",
  ]) {
    const current = structuredClone(raw);
    let changes = {};
    if (action === "enroll") {
      changes = {
        enrollmentDateAt: "2026-01-01",
        number: "SYNTHETIC",
        isProcessing: false,
      };
    }
    if (["enrolled", "cancelEnroll"].includes(action)) {
      current.healthInsurance = enrolled(true);
    }
    if (action === "enrolled") changes = { number: "COMPLETED" };
    if (["exempt", "loss", "rollback"].includes(action)) {
      current.healthInsurance = enrolled();
    }
    if (action === "exempt") {
      changes = { lossDateAt: "2026-02-01", lossReason: "合成理由" };
    }
    if (action === "loss") {
      changes = {
        lossDateAt: "2026-02-01",
        lossReason: "合成理由",
        isRetire: false,
      };
    }
    if (action === "rollback") {
      const previous = new Insurance(
        serverValue.rawForClass(current.healthInsurance),
      );
      previous.loss({
        lossDateAt: serverValue.parseDate("2026-02-01"),
        lossReason: "合成理由",
        isRetire: false,
      });
      current.healthInsurance = previous.toObject();
    }
    const input = {
      employeeId: "employee",
      kind: "healthInsurance",
      action,
      changes,
      expected: {
        map: clientValue.encodeExpected(current.healthInsurance),
        version: 0,
      },
    };
    const clientParsed = clientInsurance.parseEmployeeInsuranceInput(input);
    const serverParsed = serverInsurance.parseEmployeeInsuranceInput(input);
    assert.deepEqual(
      clientValue.encodeExpected(clientParsed),
      serverValue.encodeExpected(serverParsed),
    );
    assert.deepEqual(
      clientValue.encodeExpected(
        clientInsurance.prepareEmployeeInsurance(current, clientParsed),
      ),
      serverValue.encodeExpected(
        serverInsurance.prepareEmployeeInsurance(current, serverParsed),
      ),
      action,
    );
  }
});

test("client insurance legacy defaults and existing maps match Functions", () => {
  const absent = {};
  assert.deepEqual(
    clientInsurance.insuranceVersions(absent),
    serverInsurance.insuranceVersions(absent),
  );
  for (const kind of clientInsurance.INSURANCE_KINDS) {
    assert.deepEqual(
      clientValue.encodeExpected(
        clientInsurance.insuranceForOperation(absent, kind),
      ),
      serverValue.encodeExpected(
        serverInsurance.insuranceForOperation(absent, kind),
      ),
      `${kind} default`,
    );
  }

  const existing = validEmployee();
  assert.deepEqual(
    clientInsurance.insuranceVersions(existing),
    serverInsurance.insuranceVersions(existing),
  );
  for (const kind of clientInsurance.INSURANCE_KINDS) {
    assert.deepEqual(
      clientValue.encodeExpected(
        clientInsurance.insuranceForOperation(existing, kind),
      ),
      serverValue.encodeExpected(
        serverInsurance.insuranceForOperation(existing, kind),
      ),
      `${kind} existing`,
    );
  }
});

test("client archive gating and request normalization match Functions contract", () => {
  assert.equal(
    clientArchive.isEmployeeArchiveUxActorAllowed(identity, {
      ...actor,
      roles: ["manager"],
    }),
    serverArchive.archiveActorAllowed(identity, {
      ...actor,
      roles: ["manager"],
    }),
  );
  for (const value of ["employee", "../employee", "", "x".repeat(129)]) {
    assert.equal(
      clientArchive.archiveIdentifier(value),
      serverArchive.archiveIdentifier(value),
    );
  }
  const input = {
    employeeId: "employee",
    operationId: "operation",
    reason: " 合成理由 ",
  };
  assert.deepEqual(
    clientArchive.parseEmployeeArchiveInput(input),
    serverArchive.parseEmployeeArchiveInput(input),
  );

  for (const invalid of [
    { ...input, reason: " " },
    { ...input, reason: "x".repeat(201) },
    { ...input, employeeId: "../employee" },
    { ...input, extra: true },
  ]) {
    assert.throws(() => clientArchive.parseEmployeeArchiveInput(invalid));
    assert.throws(() => serverArchive.parseEmployeeArchiveInput(invalid));
  }
});
