import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { isNotificationRecipientEligible } from "../../functions/modules/utils/notifications.js";

const notificationsSourceUrl = new URL(
  "../../functions/modules/utils/notifications.js",
  import.meta.url,
);
const authTriggerSourceUrl = new URL(
  "../../functions/triggers/auth.js",
  import.meta.url,
);
const clientNotificationSourceUrl = new URL(
  "../../composables/useNotification.js",
  import.meta.url,
);

test("notification recipients require an active registered User in the same tenant", () => {
  const valid = {
    companyId: "company-a",
    isTemporary: false,
    disabled: false,
  };
  assert.equal(
    isNotificationRecipientEligible({ userData: valid, companyId: "company-a" }),
    true,
  );
  for (const userData of [
    null,
    { ...valid, companyId: "company-b" },
    { ...valid, isTemporary: true },
    { ...valid, isTemporary: "false" },
    { ...valid, disabled: true },
    { ...valid, disabled: "false" },
  ]) {
    assert.equal(
      isNotificationRecipientEligible({ userData, companyId: "company-a" }),
      false,
    );
  }
});
test("notification dispatch checks User state and lifecycle lock before token lookup", async () => {
  const source = await readFile(notificationsSourceUrl, "utf8");
  const trigger = source.slice(source.indexOf("export const onNotificationCreated"));
  const userRead = trigger.indexOf("/Users/${userId}");
  const lockRead = trigger.indexOf("/UserLifecycleLocks/${userId}");
  const eligibility = trigger.indexOf("isNotificationRecipientEligible");
  const tokenLookup = trigger.indexOf('.collection("FcmTokens")');

  assert.ok(userRead >= 0);
  assert.ok(lockRead >= 0);
  assert.ok(eligibility > userRead);
  assert.ok(tokenLookup > eligibility);
  assert.match(trigger, /lifecycleLock\.exists\s*\|\|/);
});

test("notification and Auth cleanup logs contain no token samples or identity payload", async () => {
  const notifications = await readFile(notificationsSourceUrl, "utf8");
  const authTrigger = await readFile(authTriggerSourceUrl, "utf8");
  const client = await readFile(clientNotificationSourceUrl, "utf8");

  for (const forbidden of [
    "maskToken",
    "tokenSamples",
    "customDataKeys",
    "bodyLength",
    "errorStack",
    "errorMessage",
    "FCM Tokens to send",
    "Send result:",
    "testNotification = onRequest",
  ]) {
    assert.equal(notifications.includes(forbidden), false, forbidden);
  }
  assert.equal(authTrigger.includes("user.email"), false);
  assert.equal(authTrigger.includes("${user.uid}"), false);
  const obtainedLog = client.slice(
    client.indexOf("The current token has been obtained."),
    client.indexOf("if (!currentToken)"),
  );
  assert.equal(obtainedLog.includes("data:"), false);
});
