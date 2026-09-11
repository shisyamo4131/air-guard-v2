import assert from "node:assert/strict";
import test from "node:test";
import Employee, {
  INSURANCE_KINDS,
} from "../../schemas/Employee.js";

const versions = Object.freeze({
  healthInsurance: 8,
  pensionInsurance: 3,
  employmentInsurance: 1,
});

test("Employeeのdocument保存値に既存の保険操作世代を保持する", () => {
  const employee = new Employee({
    docId: "employee-1",
    insuranceOperationVersions: versions,
  });

  assert.deepEqual(employee.toObject().insuranceOperationVersions, versions);
  assert.notStrictEqual(
    employee.toObject().insuranceOperationVersions,
    versions,
  );
});

test("保険操作世代がない既存Employeeへ読込だけで値を補完しない", () => {
  const employee = new Employee({ docId: "legacy-employee" });

  assert.equal(
    Object.hasOwn(employee.toObject(), "insuranceOperationVersions"),
    false,
  );
});

test("新規Employeeは作成直前に3保険の操作世代を0で初期化する", async () => {
  const employee = new Employee();

  await employee.beforeCreate();

  assert.deepEqual(
    employee.toObject().insuranceOperationVersions,
    Object.fromEntries(INSURANCE_KINDS.map((kind) => [kind, 0])),
  );
});

test("不正な保険操作世代はEmployee validationで拒否する", () => {
  const employee = new Employee({
    insuranceOperationVersions: {
      ...versions,
      healthInsurance: -1,
    },
  });

  assert.throws(() => employee.validate(), {
    name: "ValidationError",
  });
});
