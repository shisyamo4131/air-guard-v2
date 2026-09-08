import test from "node:test";
import assert from "node:assert/strict";
import * as server from "../../functions/shared/billingPaymentContract.js";
import { encodeExpected, parseDate } from "../../functions/shared/employeeContract.js";
import * as client from "../../composables/domain/customerBilling/billingPaymentContract.js";
import { isBillingPaymentUxActorAllowed } from "../../composables/domain/customerBilling/billingPaymentContract.js";

test("client billing payment projection stays wire-compatible with Functions", () => {
  assert.deepEqual(client.PAYMENT_FIELDS, server.PAYMENT_FIELDS);
  const raw = {
    billingDateAt: parseDate("2026-09-30"),
    paymentDueDateAt: parseDate("2026-10-31"),
    paymentDueDate: "2026-10-31",
    paymentDueMonth: "2026-10",
  };
  assert.deepEqual(client.paymentExpected(raw), server.paymentExpected(raw));
  for (const value of [null, "2026-09-30", "2026-12-31"]) {
    const clientPatch = client.paymentPatch(raw, value);
    const serverPatch = server.paymentPatch(raw, value);
    assert.deepEqual(encodeExpected(clientPatch), encodeExpected(serverPatch));
    assert.equal(
      client.paymentMatches({ ...raw, ...clientPatch }, clientPatch),
      server.paymentMatches({ ...raw, ...serverPatch }, serverPatch),
    );
  }
});

test("client billing identifiers and UX actor gate match Functions", () => {
  for (const value of ["customer_site_2026-09-30", "../billing", "", "x".repeat(269)]) {
    assert.equal(client.billingIdentifier(value), server.billingIdentifier(value));
  }
  const identity = { uid: "actor", companyId: "company", isSuperUser: false };
  for (const user of [
    { docId: "actor", companyId: "company", disabled: false, isTemporary: false },
    { docId: "actor", companyId: "other", disabled: false, isTemporary: false },
    { docId: "actor", companyId: "company", disabled: true, isTemporary: false },
  ]) {
    assert.equal(
      isBillingPaymentUxActorAllowed(identity, user),
      server.paymentActorAllowed(identity, user),
    );
  }
});
