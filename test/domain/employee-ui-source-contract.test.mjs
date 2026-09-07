import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";

const files = [
  "pages/employees/index.vue",
  "pages/employees/resigned.vue",
  "pages/employees/[id].vue",
  "components/Employees/Manager/index.vue",
  "components/Employee/UserManager.vue",
  "components/Employee/Editor.vue",
  "components/Employee/Certifications/Manager/index.vue",
  "components/Employee/ArchiveDialog.vue",
];

test("reachable Employee CRUD does not use generic Managers or model persistence", async () => {
  for (const file of files) {
    const source = await readFile(new URL(`../../${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(
      source,
      /AirItemManager|AirArrayManager|air-item-manager|air-array-manager|useBaseManager|\.(?:create|update|delete|restore)\s*\(/u,
      file,
    );
  }
});

test("Employee lists use the dedicated scoped reader and keep their existing create boundary", async () => {
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
  assert.match(active, /fetchAllOnEmpty: true/);
  assert.match(active, /\n\s+show-create\n/);
  assert.match(resigned, /status: Employee\.STATUS_RESIGNED/);
  assert.doesNotMatch(resigned, /show-create/);
  assert.doesNotMatch(`${active}\n${resigned}`, /useDocuments|useEmployeesResigned/);
  assert.match(reader, /useEmployeeReadAccess/);
  assert.match(reader, /Companies\/\$\{companyId\}\/Employees/);
  assert.match(reader, /\["where", "employmentStatus", "==", status\]/);
  assert.doesNotMatch(reader, /Employees_archive/);
});

for (const file of files.filter((file) => file.endsWith(".vue"))) {
  test(`${file} compiles after EMP-06 Manager removal`, async () => {
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
