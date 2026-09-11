import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { Customer } from "../../schemas/index.js";
import {
  CUSTOMER_BASIC_FIELDS,
  CUSTOMER_PAYMENT_FIELDS,
} from "../../composables/domain/customer/customerOperations.js";

test("Customer operation contract owns basic and payment editor fields", () => {
  assert.equal(
    Customer.schema.find(({ key }) => key === "location")?.hidden,
    true,
  );
  assert.equal(CUSTOMER_BASIC_FIELDS.includes("address"), true);
  assert.equal(CUSTOMER_BASIC_FIELDS.includes("contractStatus"), true);
  assert.equal(CUSTOMER_BASIC_FIELDS.includes("cutoffDate"), false);
  assert.equal(CUSTOMER_PAYMENT_FIELDS.includes("paymentMonth"), true);
  assert.equal(CUSTOMER_PAYMENT_FIELDS.includes("name"), false);
});

test("Customer editor fields refer only to properties owned by the real schema", () => {
  const schemaKeys = new Set(Customer.schema.map(({ key }) => key));
  for (const field of [
    ...CUSTOMER_BASIC_FIELDS,
    ...CUSTOMER_PAYMENT_FIELDS,
  ]) {
    assert.equal(schemaKeys.has(field), true, field);
  }
});

test("Customer managers persist by calling FireModel create and update directly", async () => {
  const [singular, plural] = await Promise.all([
    readFile(
      new URL("../../components/Customer/Manager/index.vue", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../../components/Customers/Manager/index.vue", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(singular, /async function handleCreate\(draft\)[\s\S]*?await draft\.create\(\)/u);
  assert.match(singular, /async function handleUpdate\(draft\)[\s\S]*?await draft\.update\(\)/u);
  assert.match(plural, /async function handleCreate\(draft\)[\s\S]*?await draft\.create\(\)/u);
  assert.match(plural, /async function handleUpdate\(draft\)[\s\S]*?await draft\.update\(\)/u);
  for (const wrapper of [singular, plural]) {
    assert.doesNotMatch(
      wrapper,
      /useCustomerActions|createCustomerWriter|prepareCustomerCreate|prepareCustomerUpdate|getCustomerWriteDecision/u,
    );
  }
});

test("obsolete Customer action and writer modules are removed and unreferenced", async () => {
  for (const path of [
    "../../composables/application/customer/customerCreationBridge.js",
    "../../composables/application/customer/useCustomerActions.js",
    "../../utils/customer/customerWriter.js",
  ]) {
    await assert.rejects(
      access(new URL(path, import.meta.url)),
      (error) => error?.code === "ENOENT",
    );
  }

  const consumers = await Promise.all([
    "../../components/Customer/Manager/index.vue",
    "../../components/Customers/Manager/index.vue",
    "../../pages/customers/index.vue",
    "../../pages/customers/[id].vue",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  assert.doesNotMatch(
    consumers.join("\n"),
    /useCustomerActions|customerWriter|createCustomerWriter/u,
  );
});

test("installed ClientAdapter create and update own hooks, validation, metadata, and transaction writes", async () => {
  const adapter = await readFile(
    new URL(
      "../../node_modules/@shisyamo4131/air-firebase-v2-client-adapter/index.js",
      import.meta.url,
    ),
    "utf8",
  );
  const create = adapter.match(/^  async create\([\s\S]*?^  \}/mu)?.[0];
  const update = adapter.match(/^  async update\([\s\S]*?^  \}/mu)?.[0];
  assert.ok(create, "ClientAdapter.create must exist");
  assert.ok(update, "ClientAdapter.update must exist");
  for (const method of [create, update]) {
    assert.match(method, /this\.validate\(\)/u);
    assert.match(method, /this\.updatedAt = new Date\(\)/u);
    assert.match(
      method,
      /this\.uid = ClientAdapter\.auth\?\.currentUser\?\.uid \|\| "unknown"/u,
    );
    assert.match(method, /txn\.set\(docRef, this\)/u);
  }
  assert.match(create, /this\.beforeCreate\(args\)/u);
  assert.match(create, /this\.createdAt = new Date\(\)/u);
  assert.match(update, /this\.beforeUpdate\(args\)/u);
  assert.doesNotMatch(update, /\{\s*merge\s*:/u);
});
