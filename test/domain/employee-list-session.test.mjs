import assert from "node:assert/strict";
import test from "node:test";

import { createEmployeeListSession } from "../../composables/domain/employee/employeeListSession.js";

function harness() {
  const listeners = [];
  const snapshots = [];
  const session = createEmployeeListSession({
    changed: (snapshot) => snapshots.push(snapshot),
    subscribe(criteria, next, error) {
      const listener = { criteria, next, error, stopped: false };
      listeners.push(listener);
      return () => {
        listener.stopped = true;
      };
    },
  });
  return { listeners, snapshots, session };
}

test("Employee list keeps only the latest search response", () => {
  const { listeners, session } = harness();
  session.load({ scope: "company-a", text: "たな" });
  session.load({ scope: "company-a", text: "すず" });

  assert.equal(listeners[0].stopped, true);
  listeners[0].next([{ docId: "stale" }]);
  assert.deepEqual(session.snapshot().items, []);

  listeners[1].next([{ docId: "current" }]);
  assert.deepEqual(session.snapshot(), {
    items: [{ docId: "current" }],
    loading: false,
    error: "",
  });
});

test("Employee list clears protected state when its scope is removed", () => {
  const { listeners, session } = harness();
  session.load({ scope: "company-a", text: "" });
  listeners[0].next([{ docId: "employee-a" }]);

  session.load(null);
  assert.equal(listeners[0].stopped, true);
  assert.deepEqual(session.snapshot(), { items: [], loading: false, error: "" });

  listeners[0].next([{ docId: "must-not-return" }]);
  assert.deepEqual(session.snapshot().items, []);
});

test("Employee list exposes a safe error and retries the same criteria", () => {
  const { listeners, session } = harness();
  session.load({ scope: "company-a", text: "退職" });
  listeners[0].error(new Error("private backend detail"));

  assert.deepEqual(session.snapshot(), {
    items: [],
    loading: false,
    error: "従業員情報を取得できません。再読込してください。",
  });

  session.reload();
  assert.equal(listeners.length, 2);
  assert.deepEqual(listeners[1].criteria, { scope: "company-a", text: "退職" });
  assert.equal(session.snapshot().loading, true);
});

test("Employee list rejects malformed subscription results", () => {
  const { listeners, session } = harness();
  session.load({ scope: "company-a", text: "" });
  listeners[0].next(null);
  assert.equal(session.snapshot().items.length, 0);
  assert.equal(session.snapshot().error, "従業員情報を取得できません。再読込してください。");
});
