import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";

const components = [
  "components/Employee/LifecycleActions.vue",
  "components/Users/Manager/CardMenu.vue",
  "components/Users/Manager/index.vue",
  "pages/employees/[id].vue",
];

test("client transport exposes only the UWB-07 Callables", async () => {
  const source = await readFile(
    new URL("../../composables/auth/useAuthFunctions.js", import.meta.url),
    "utf8",
  );
  for (const callable of [
    "terminateEmployee",
    "deleteStandaloneRegisteredUser",
    "getEmployeeReinstatementContext",
    "reinstateEmployee",
  ]) {
    assert.match(source, new RegExp(`httpsCallable\\([^)]*${callable}`, "s"));
  }
});

test("Employee lifecycle UI has no direct Firestore lifecycle mutation", async () => {
  const source = await readFile(
    new URL("../../pages/employees/[id].vue", import.meta.url),
    "utf8",
  );
  for (const forbidden of [
    ".toTerminated(",
    "dateOfTermination =",
    "reasonOfTermination =",
    "toDelete",
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
  assert.match(source, /EmployeeLifecycleActions/);
});

test("registered User deletion is separated from temporary User deletion", async () => {
  const source = await readFile(
    new URL("../../components/Users/Manager/index.vue", import.meta.url),
    "utf8",
  );
  assert.match(source, /deleteTemporaryUser/);
  assert.match(source, /removeStandaloneRegisteredUser/);
  assert.match(source, /canDeleteStandaloneRegisteredUser/);
});

for (const file of components) {
  test(`${file} compiles for UWB-07`, async () => {
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
