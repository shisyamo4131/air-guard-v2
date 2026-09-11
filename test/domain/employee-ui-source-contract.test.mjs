import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";

const files = [
  "pages/employees/index.vue",
  "pages/employees/resigned.vue",
  "pages/employees/[id].vue",
  "components/Employees/Manager/index.vue",
  "components/Employee/Manager/index.vue",
  "components/Employee/CustomInput/ToRegist.vue",
  "components/Employee/CustomInput/Base.vue",
  "components/Employee/CustomInput/Nationality.vue",
  "components/Employee/CustomInput/SecurityGuard.vue",
  "components/Employee/UserManager.vue",
  "components/Employee/Editor.vue",
  "components/Employee/Certifications/Manager/index.vue",
  "components/Employee/ArchiveDialog.vue",
];

test("reachable normal Employee CRUD uses the domain Managers and model persistence", async () => {
  const single = await readFile(
    new URL("../../components/Employee/Manager/index.vue", import.meta.url),
    "utf8",
  );
  const multiple = await readFile(
    new URL("../../components/Employees/Manager/index.vue", import.meta.url),
    "utf8",
  );
  const detail = await readFile(
    new URL("../../pages/employees/[id].vue", import.meta.url),
    "utf8",
  );

  assert.match(single, /<air-item-manager/u);
  assert.match(multiple, /<air-array-manager/u);
  for (const source of [single, multiple]) {
    assert.match(source, /useBaseManager/u);
    assert.match(source, /draft\.create\(\)/u);
    assert.match(source, /draft\.update\(\)/u);
    assert.match(source, /disable-delete/u);
    assert.match(source, /:custom-input="resolveCustomInput"/u);
    assert.doesNotMatch(source, /draft\.delete\(\)/u);
  }
  assert.equal((detail.match(/<EmployeeManager\b/gu) || []).length, 3);
  assert.doesNotMatch(detail, /<EmployeeEditor\b/u);
});

test("Employee lists use the scoped reader and dispatch create/detail through EmployeesManager", async () => {
  const active = await readFile(
    new URL("../../pages/employees/index.vue", import.meta.url),
    "utf8",
  );
  const resigned = await readFile(
    new URL("../../pages/employees/resigned.vue", import.meta.url),
    "utf8",
  );
  const reader = await readFile(
    new URL(
      "../../composables/application/employee/useEmployeeList.js",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(active, /status: Employee\.STATUS_ACTIVE/);
  assert.doesNotMatch(active, /fetchAllOnEmpty/);
  assert.match(active, /<EmployeesManager[\s\S]*?:model-value="docs"/u);
  assert.match(active, /#table="\{ items, toCreate, toUpdate \}"/u);
  assert.match(active, /@click="\(\) => toCreate\(\)"/u);
  assert.match(active, /@click:detail="toUpdate"/u);
  assert.match(resigned, /status: Employee\.STATUS_RESIGNED/);
  assert.match(resigned, /recentField: "dateOfTermination"/);
  assert.doesNotMatch(resigned, /\btoCreate\b/u);
  assert.match(resigned, /@click:detail="toUpdate"/u);
  assert.doesNotMatch(`${active}\n${resigned}`, /useDocuments|useEmployeesResigned/);
  assert.match(reader, /useEmployeeReadAccess/);
  assert.match(reader, /Companies\/\$\{companyId\}\/Employees/);
  assert.match(reader, /where\("employmentStatus", "==", status\)/);
  assert.match(reader, /orderBy\(recentField, "desc"\)/);
  assert.match(reader, /limit\(PAGE_SIZE\)/);
  assert.match(reader, /createTokenMapQueries\(text\)/);
  assert.doesNotMatch(reader, /Employees_archive/);
});

for (const file of files.filter((file) => file.endsWith(".vue"))) {
  test(`${file} compiles with the FGA-04 Employee boundary`, async () => {
    const url = new URL(`../../${file}`, import.meta.url);
    const source = await readFile(url, "utf8");
    const { descriptor, errors } = parse(source, { filename: url.pathname });
    assert.deepEqual(errors, []);
    compileScript(descriptor, { id: file });
    const result = compileTemplate({
      id: file,
      filename: url.pathname,
      source: descriptor.template.content,
    });
    assert.deepEqual(result.errors, []);
  });
}
