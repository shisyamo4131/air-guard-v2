import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";

import {
  getNavigationItems,
  isPageAllowed,
  isPageConfigAllowed,
} from "../../utils/pageSettings.js";
import { PAGE_ACCESS_POLICIES } from "../../utils/auth/policies/pageAccessPolicy.js";
import { buildPageAccessContext } from "../../utils/auth/pageAccessContext.js";

const components = [
  "components/Users/Manager/index.vue",
  "components/Users/Manager/CardMenu.vue",
  "components/Employee/UserManager.vue",
  "components/User/Setting/index.vue",
  "components/organisms/ChangeAdminUserDialog/index.vue",
  "components/AppNavigationDrawer.vue",
];

function navigationValues(items) {
  return items.flatMap((item) => [
    item.value,
    ...navigationValues(item.children ?? []),
  ]);
}

function accessContext({
  roles = [],
  isAdmin = false,
  isSuperUser = false,
} = {}) {
  return buildPageAccessContext({
    isReady: true,
    uid: "actor-a",
    companyId: "company-a",
    isEmailVerified: true,
    isSuperUser,
    isSuperUserClaimValid: true,
    isDeveloper: false,
    isDeveloperClaimValid: true,
    user: {
      docId: "actor-a",
      companyId: "company-a",
      disabled: false,
      isTemporary: false,
      isAdmin,
      roles,
    },
    roles: [
      ...roles,
      ...(isAdmin ? ["admin"] : []),
      ...(isSuperUser ? ["super-user"] : []),
    ],
  });
}

test("User settings route and navigation share the User management access policy", () => {
  const managerContext = accessContext({ roles: ["manager"] });
  const directContext = accessContext({ roles: ["users:write"] });
  const superUserContext = accessContext({ isSuperUser: true });
  const adminContext = accessContext({ isAdmin: true });

  assert.equal(
    isPageAllowed("/settings/users", ["manager"], managerContext),
    true,
  );
  assert.equal(
    isPageAllowed("/settings/users", ["users:write"], directContext),
    false,
  );
  assert.equal(
    isPageAllowed("/settings/users", ["super-user"], superUserContext),
    false,
  );
  assert.equal(isPageAllowed("/settings/users", ["admin"], adminContext), true);

  assert.equal(
    navigationValues(getNavigationItems(["manager"], managerContext)).includes(
      "users-setting",
    ),
    true,
  );
  assert.equal(
    navigationValues(
      getNavigationItems(["users:write"], directContext),
    ).includes("users-setting"),
    false,
  );
  assert.equal(
    navigationValues(
      getNavigationItems(["super-user"], superUserContext),
    ).includes("users-setting"),
    false,
  );
});

test("general page access retains wildcard and direct-permission behavior", () => {
  const config = { accessPolicy: PAGE_ACCESS_POLICIES.OUTSOURCERS_READ };
  assert.equal(
    isPageConfigAllowed(
      config,
      ["super-user"],
      accessContext({ isSuperUser: true }),
    ),
    true,
  );
  assert.equal(
    isPageConfigAllowed(
      config,
      ["outsourcers:write"],
      accessContext({ roles: ["outsourcers:write"] }),
    ),
    true,
  );
  assert.equal(
    isPageConfigAllowed(
      config,
      ["controller"],
      accessContext({ roles: ["controller"] }),
    ),
    true,
  );
  assert.equal(
    isPageConfigAllowed(
      config,
      ["human-resource"],
      accessContext({ roles: ["human-resource"] }),
    ),
    false,
  );
});

test("custom User actions use the shared pending-operation boundary", async () => {
  const sources = await Promise.all(
    components.slice(0, 5).map((file) =>
      readFile(new URL(`../../${file}`, import.meta.url), "utf8"),
    ),
  );
  for (const index of [0, 3, 4]) {
    assert.match(sources[index], /useOperationState/);
  }
  assert.doesNotMatch(sources[1], /useOperationState/);
  assert.doesNotMatch(sources[0], /run\("create"|run\("update"|run\("delete"/);
  assert.match(sources[0], /run\("enable", user\.docId/);
  assert.match(sources[0], /run\("disable", user\.docId/);
  assert.match(sources[3], /run\("profile", auth\.uid \|\| "self"/);
  assert.match(sources[4], /run\("transfer-admin", auth\.uid \|\| "self"/);
});

test("authentication mutations carry only their local concurrency preconditions", async () => {
  const manager = await readFile(
    new URL("../../components/Users/Manager/index.vue", import.meta.url),
    "utf8",
  );
  const rolePolicy = await readFile(
    new URL(
      "../../utils/auth/policies/userFieldUpdatePolicy.js",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(manager, /expectedDisabled:\s*user\.disabled/);
  assert.match(rolePolicy, /expectedRoles:\s*\[\.\.\.targetUser\._beforeData\.roles\]/);
  assert.doesNotMatch(manager, /revision|operationId/);
  assert.doesNotMatch(rolePolicy, /revision|operationId/);
});

test("common manager submit drops a reentrant call before clearing state", async () => {
  const source = await readFile(
    new URL(
      "../../air-vuetify-v3/src/composables/useItemManager.js",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(
    source,
    /async function submit\(\)\s*\{\s*if \(isLoading\.value\) return;\s*clearErrors\(\)/,
  );
});

test("User operation UI does not perform direct Firestore writes", async () => {
  const files = [
    ...components.slice(0, 5),
    "composables/application/user/useTemporaryUserCreation.js",
    "composables/application/user/useTemporaryUserDeletion.js",
    "composables/application/user/useUserFieldUpdates.js",
    "composables/application/user/useUserSettingsActions.js",
  ];
  for (const file of files) {
    const source = await readFile(
      new URL(`../../${file}`, import.meta.url),
      "utf8",
    );
    for (const forbidden of [
      "updateDoc(",
      "setDoc(",
      "addDoc(",
      "writeBatch(",
      "item.create(",
      "item.update(",
      "item.delete(",
      "auth.user.updateProperties(",
    ]) {
      assert.equal(source.includes(forbidden), false, `${file}: ${forbidden}`);
    }
  }
});

for (const file of components) {
  test(`${file} compiles for the UWB-06 integration`, async () => {
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
