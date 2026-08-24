import assert from "node:assert/strict";
import test from "node:test";

import { useOperationState } from "../../composables/useOperationState.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("same operation and target share one pending execution", async () => {
  const state = useOperationState();
  const gate = deferred();
  let calls = 0;
  const action = async () => {
    calls += 1;
    return gate.promise;
  };

  const first = state.run("update", "user-a", action);
  const duplicate = state.run("update", "user-a", action);

  assert.equal(first, duplicate);
  assert.equal(state.isPending("update", "user-a"), true);
  assert.equal(state.hasPending.value, true);
  await Promise.resolve();
  assert.equal(calls, 1);

  gate.resolve("done");
  assert.equal(await first, "done");
  assert.equal(state.isPending("update", "user-a"), false);
  assert.equal(state.hasPending.value, false);
});

test("different operations and targets remain independent", async () => {
  const state = useOperationState();
  const firstGate = deferred();
  const secondGate = deferred();

  const first = state.run("enable", "user-a", () => firstGate.promise);
  const second = state.run("disable", "user-b", () => secondGate.promise);

  assert.notEqual(first, second);
  assert.equal(state.isPending("enable", "user-a"), true);
  assert.equal(state.isPending("disable", "user-b"), true);

  firstGate.resolve("first");
  assert.equal(await first, "first");
  assert.equal(state.isPending("enable", "user-a"), false);
  assert.equal(state.isPending("disable", "user-b"), true);

  secondGate.resolve("second");
  assert.equal(await second, "second");
});

test("failure clears the key and permits an explicit retry", async () => {
  const state = useOperationState();
  let calls = 0;

  await assert.rejects(
    state.run("delete", "user-a", async () => {
      calls += 1;
      throw new Error("failed");
    }),
    /failed/,
  );
  assert.equal(state.isPending("delete", "user-a"), false);

  const result = await state.run("delete", "user-a", async () => {
    calls += 1;
    return "retried";
  });
  assert.equal(result, "retried");
  assert.equal(calls, 2);
});

test("invalid keys and actions fail before state changes", () => {
  const state = useOperationState();
  assert.throws(() => state.run("", "user-a", () => {}), TypeError);
  assert.throws(() => state.run("update", "", () => {}), TypeError);
  assert.throws(() => state.run("update", "user-a", null), TypeError);
  assert.equal(state.hasPending.value, false);
});
