import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";

import {
  canManageUserFields,
  canUpdateUserRoles,
  createNotificationSettingsPayload,
  createRolesPayload,
} from "../../utils/auth/policies/userFieldUpdatePolicy.js";

test("client policy mirrors managed field and role target controls", () => {
  assert.equal(canManageUserFields({ isAdmin: true }), true);
  assert.equal(canManageUserFields({ hasUsersWrite: true }), true);
  assert.equal(canManageUserFields({}), false);
  assert.equal(
    canUpdateUserRoles({
      actorUid: "actor-a",
      hasUsersWrite: true,
      targetUser: { docId: "target-a", isAdmin: false },
    }),
    true,
  );
  assert.equal(
    canUpdateUserRoles({
      actorUid: "actor-a",
      hasUsersWrite: true,
      targetUser: { docId: "actor-a", isAdmin: false },
    }),
    false,
  );
  assert.equal(
    canUpdateUserRoles({
      actorUid: "actor-a",
      hasUsersWrite: true,
      targetUser: { docId: "admin-a", isAdmin: true },
    }),
    false,
  );
});

test("client payloads include only operation-specific fields", () => {
  const user = {
    docId: "target-a",
    roles: ["controller"],
    _beforeData: { roles: ["labor"] },
    displayName: "秘密",
    email: "secret@example.com",
    disabled: true,
    receiveConfirmedArrangementNotification: true,
    receiveArrivedArrangementNotification: false,
    receiveLeavedArrangementNotification: true,
  };
  assert.deepEqual(createRolesPayload(user), {
    targetUserId: "target-a",
    expectedRoles: ["labor"],
    roles: ["controller"],
  });
  assert.deepEqual(createNotificationSettingsPayload(user), {
    targetUserId: "target-a",
    receiveConfirmedArrangementNotification: true,
    receiveArrivedArrangementNotification: false,
    receiveLeavedArrangementNotification: true,
  });
  assert.throws(
    () => createRolesPayload({ docId: "target-a", roles: [] }),
    /Original User roles are unavailable/,
  );
});

test("User manager and own settings do not use FireModel full updates", async () => {
  const manager = await readFile(
    new URL("../../components/Users/Manager/index.vue", import.meta.url),
    "utf8",
  );
  const settings = await readFile(
    new URL("../../composables/application/user/useUserSettingsActions.js", import.meta.url),
    "utf8",
  );
  assert.match(manager, /:handle-update="handleUpdate"/);
  assert.match(
    manager,
    /async function handleUpdate\(item\)\s*\{\s*await updateManagedUser\(item\);\s*\}/,
  );
  assert.equal(manager.includes("item.update(item)"), false);
  assert.equal(settings.includes("auth.user.updateProperties"), false);
});

test("User manager excludes profile and server fields from update editing", async () => {
  const source = await readFile(
    new URL("../../components/Users/Manager/index.vue", import.meta.url),
    "utf8",
  );
  const updateFields = source.slice(
    source.indexOf("function resolveExcludedKeys(item)"),
    source.indexOf("</script>"),
  );
  for (const field of [
    "email",
    "displayName",
    "employeeId",
    "disabled",
    "companyId",
    "isAdmin",
    "isTemporary",
    "tagSize",
  ]) {
    assert.match(updateFields, new RegExp(`"${field}"`));
  }
  assert.match(updateFields, /canUpdateUserRoles\(item\)/);
});

test("own settings UI displays and submits displayName and tagSize", async () => {
  const url = new URL("../../components/User/Setting/index.vue", import.meta.url);
  const source = await readFile(url, "utf8");
  assert.match(source, /v-model="model\.displayName"/);
  assert.match(source, /v-model="model\.tagSize"/);
  assert.match(source, /await updateProfile\(\{/);
  assert.equal(source.includes("auth.user.updateProperties"), false);

  const { descriptor, errors } = parse(source, { filename: url.pathname });
  assert.deepEqual(errors, []);
  compileScript(descriptor, { id: "UserSetting" });
  const template = compileTemplate({
    id: "UserSetting",
    filename: url.pathname,
    source: descriptor.template.content,
  });
  assert.deepEqual(template.errors, []);
});
