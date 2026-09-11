import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import { Employee, Certification, Insurance } from "@shisyamo4131/air-guard-v2-schemas";
import * as contract from "../../functions/shared/employeeContract.js";
import * as insuranceContract from "../../functions/shared/employeeInsuranceContract.js";

function employee() {
  return new Employee({
    docId: "employee", lastName: "合成", firstName: "太郎", lastNameKana: "ゴウセイ", firstNameKana: "タロウ",
    displayName: "合成太郎", displayNameKana: "ゴウセイタロウ", gender: "MALE",
    dateOfBirth: contract.parseDate("1990-01-01"), dateOfHire: contract.parseDate("2026-01-01"),
    zipcode: "1000001", prefCode: "13", city: "試験市", address: "合成住所",
  }).toObject();
}

async function harness(operation = "insurance", kind = "healthInsurance") {
  let raw = employee(), authWatch, response = async () => ({ success: true });
  const calls = [];
  class TestEmployee extends Employee {
    static classProps = {
      ...Employee.classProps,
      insuranceOperationVersions: {
        ...Employee.classProps.location,
        default: () => ({ healthInsurance: 0, pensionInsurance: 0, employmentInsurance: 0 }),
        validator: () => true,
        hidden: true,
      },
    };
    afterInitialize(item = {}) {
      super.afterInitialize(item);
      if (!Object.hasOwn(item, "insuranceOperationVersions")) delete this.insuranceOperationVersions;
    }
    async update() {
      const candidate = this.toObject();
      calls.push({ api: "model.update", candidate });
      await response(candidate);
      raw = candidate;
      return this;
    }
  }
  const auth = {
    uid: "actor", companyId: "company", isSuperUser: false,
    isSuperUserClaimValid: true, isEmailVerified: true,
    user: { docId: "actor", companyId: "company", disabled: false, isTemporary: false, isAdmin: true, roles: [] },
  };
  const ref = (value) => ({ value });
  const bindings = {
    ...contract, ...insuranceContract,
    isEmployeeNormalUxActorAllowed: ({ actorUser }) => actorUser?.disabled === false && actorUser?.isTemporary === false,
    Employee: TestEmployee, Certification, Insurance, ref, shallowRef: ref,
    computed: (fn) => ({ get value() { return fn(); } }),
    watch: (_, fn) => { authWatch = fn; }, onScopeDispose() {}, useAuthStore: () => auth,
  };
  const factoryName = operation === "insurance" ? "useEmployeeInsurance" : "useEmployeeCertifications";
  const source = (await readFile(new URL(`../../composables/application/employee/${factoryName}.js`, import.meta.url), "utf8"))
    .replace(/import[\s\S]*?;\s*/gu, "").replace("export function", "function");
  const factory = new Function(...Object.keys(bindings), `${source}; return ${factoryName};`)(...Object.values(bindings));
  return {
    editor: factory({ employee: () => new TestEmployee(raw), kind }), auth, calls,
    setResponse: (fn) => { response = fn; }, setRaw: (value) => { raw = value; }, raw: () => raw,
    authWatch: () => authWatch(),
  };
}

test("FGA04 changed Vue files compile", async () => {
  const files = [
    "components/Insurance/Transition/Manager.vue", "components/Insurance/Transition/Menu/index.vue",
    ...["Enroll", "Enrolled", "CancelEnrollment", "Exempt", "Loss", "Rollback"].map((name) => `components/Insurance/Transition/Input/${name}.vue`),
    "components/Employee/Certifications/Manager/index.vue", "components/Employee/Certifications/Table.vue",
    "components/Employees/Manager/index.vue", "components/Employee/Manager/index.vue",
    "components/Employee/Activator/Base.vue", "components/Employee/Activator/Nationality.vue",
    "components/Employee/Activator/SecurityGuard.vue", "components/Employee/Autocomplete.vue",
    "pages/employees/index.vue", "pages/employees/[id].vue",
  ];
  for (const file of files) {
    const source = await readFile(new URL(`../../${file}`, import.meta.url), "utf8");
    const { descriptor, errors } = parse(source, { filename: file }); assert.deepEqual(errors, [], file);
    const script = compileScript(descriptor, { id: file });
    const result = compileTemplate({ source: descriptor.template.content, filename: file, id: file, compilerOptions: { bindingMetadata: script.bindings } });
    assert.deepEqual(result.errors, [], file);
  }
});

function certificate(name, serialNumber) {
  return new Certification({ name, serialNumber, type: "TRAFFIC", issueDateAt: contract.parseDate("2026-01-01") }).toObject();
}
const insuranceEnrollment = { enrollmentDateAt: contract.parseDate("2026-01-01"), number: "SYNTHETIC", isProcessing: false };

for (const kind of contract.INSURANCE_KINDS) test(`FGA04 ${kind} uses normal Employee update and keeps transition validation`, async () => {
  const h = await harness("insurance", kind); await h.editor.open("enroll"); h.editor.update(insuranceEnrollment);
  assert.equal(h.raw()[kind].number, null); await h.editor.save(); assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].api, "model.update"); assert.equal(h.calls[0].candidate[kind].status, "ENROLLED");
  assert.equal(h.calls[0].candidate[kind].number, "SYNTHETIC");
});

test("FGA04 insurance keeps the draft on validation or save failure", async () => {
  const invalid = await harness("insurance"); await invalid.editor.open("loss"); await invalid.editor.save();
  assert.equal(invalid.calls.length, 0); assert.equal(invalid.editor.opened.value, true);
  const rejected = await harness("insurance"); await rejected.editor.open("enroll"); rejected.editor.update(insuranceEnrollment);
  rejected.setResponse(async () => { throw new Error("write failed"); }); await rejected.editor.save();
  assert.equal(rejected.calls.length, 1); assert.equal(rejected.editor.opened.value, true); assert.equal(rejected.editor.draft.value.number, "SYNTHETIC");
});

test("FGA04 insurance cancel and actor loss never save", async () => {
  const h = await harness("insurance"); await h.editor.open("enroll"); h.editor.update(insuranceEnrollment); h.editor.close();
  assert.equal(h.calls.length, 0); await h.editor.open("enroll"); h.auth.user.disabled = true; h.authWatch();
  assert.equal(h.editor.opened.value, false); assert.equal(h.editor.draft.value, null);
});

test("EMP04 insurance transition inputs preserve outer disabled and use actual AirItemInput attrs", async () => {
  const source = await readFile(new URL("../../air-vuetify-v3/src/AirItemInput.vue", import.meta.url), "utf8"), descriptor = parse(source).descriptor;
  const setup = descriptor.scriptSetup.content.replace(/import[\s\S]*?;\s*/gu, "");
  const props = { schema: Insurance.schema, item: new Insurance().toObject(), updateProperties() {}, editMode: "UPDATE", disabled: true, includedKeys: null, excludedKeys: [] };
  const fields = new Function("computed", "useSlots", "defineOptions", "defineProps", `${setup}; return formFields;`)((fn) => ({ get value() { return fn(); } }), () => ({}), () => {}, () => props);
  for (const key of ["number", "lossReason", "isProcessing", "lossDateAt", "enrollmentDateAt"]) assert.equal(fields.value.find((field) => field.key === key).component.attrs.disabled, true);
  for (const [file, field] of [["Enroll", "number"], ["Loss", "lossReason"]]) {
    const inputSource = await readFile(new URL(`../../components/Insurance/Transition/Input/${file}.vue`, import.meta.url), "utf8");
    assert.match(inputSource, new RegExp(`:disabled="componentAttrs\\['${field}'\\]\\.disabled \\|\\|`));
  }
});

test("FGA04 qualifications use normal Employee update without mutating the displayed Employee", async () => {
  const h = await harness("certifications"); h.setRaw({ ...h.raw(), securityCertifications: [certificate("Z資格", "Z"), certificate("A資格", "A"), certificate("A資格", "B")] });
  await h.editor.open(); assert.equal(h.editor.rows.value[0].originalPosition, 1);
  h.editor.select("update", h.editor.rows.value[1].originalPosition); h.editor.update({ name: "変更資格" });
  assert.equal(h.raw().securityCertifications[2].name, "A資格"); await h.editor.save(); assert.equal(h.calls[0].api, "model.update");
  assert.equal(h.calls[0].candidate.securityCertifications[2].name, "変更資格");
});

test("FGA04 qualification save failure keeps the draft and actor loss closes it", async () => {
  const h = await harness("certifications"); h.setRaw({ ...h.raw(), securityCertifications: [certificate("A資格", "A")] });
  await h.editor.open(); h.editor.select("update", 0); h.editor.update({ serialNumber: "draft" });
  h.setResponse(async () => { throw new Error("write failed"); }); await h.editor.save(); assert.equal(h.editor.draft.value.serialNumber, "draft");
  h.auth.user.disabled = true; h.authWatch(); assert.equal(h.editor.draft.value, null); assert.equal(h.editor.rows.value.length, 0);
});
