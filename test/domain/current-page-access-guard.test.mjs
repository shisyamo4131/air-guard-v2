import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";
import { createCurrentPageAccessGuardRunner } from "../../utils/auth/pageAccessContext.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("guard runner coalesces rapid checks and redirects denied access once", async () => {
  const replacements = [];
  const runner = createCurrentPageAccessGuardRunner({
    isAllowed: (_, context) => context.allowed,
    replace: async (path) => replacements.push(path),
  });
  const current = () => true;

  const stale = runner.evaluate({
    isReady: true,
    path: "/employees",
    accessContext: { allowed: false },
    isCurrent: current,
  });
  const latest = runner.evaluate({
    isReady: true,
    path: "/sites",
    accessContext: { allowed: false },
    isCurrent: current,
  });

  assert.equal(await stale, false);
  assert.equal(await latest, true);
  assert.deepEqual(replacements, ["/dashboard"]);
});

test("guard runner skips allowed, stale, not-ready and dashboard routes", async () => {
  const replacements = [];
  const runner = createCurrentPageAccessGuardRunner({
    isAllowed: (_, context) => context.allowed,
    replace: async (path) => replacements.push(path),
  });

  for (const input of [
    { isReady: false, path: "/sites", allowed: false, current: true },
    { isReady: true, path: "/sites", allowed: true, current: true },
    { isReady: true, path: "/sites", allowed: false, current: false },
    { isReady: true, path: "/dashboard", allowed: false, current: true },
  ]) {
    assert.equal(
      await runner.evaluate({
        isReady: input.isReady,
        path: input.path,
        accessContext: { allowed: input.allowed },
        isCurrent: () => input.current,
      }),
      false,
    );
  }
  assert.deepEqual(replacements, []);
});

test("guard runner retries once automatically after the first router rejection", async () => {
  const first = deferred();
  let calls = 0;
  const errors = [];
  const runner = createCurrentPageAccessGuardRunner({
    isAllowed: () => false,
    replace() {
      calls += 1;
      return calls === 1 ? first.promise : Promise.resolve();
    },
    reportError: (error) => errors.push(error.message),
  });
  const input = {
    isReady: true,
    path: "/employees",
    accessContext: {},
    isCurrent: () => true,
  };

  const result = runner.evaluate(input);
  await Promise.resolve();
  first.reject(new Error("navigation failed"));
  assert.equal(await result, true);
  assert.equal(calls, 2);
  assert.deepEqual(errors, ["navigation failed"]);
});

test("guard runner consumes the latest denied check after a pending redirect rejects", async () => {
  const first = deferred();
  let calls = 0;
  const errors = [];
  const runner = createCurrentPageAccessGuardRunner({
    isAllowed: (_, context) => context.allowed,
    replace() {
      calls += 1;
      return calls === 1 ? first.promise : Promise.resolve();
    },
    reportError: (error) => errors.push(error.message),
  });
  const input = {
    isReady: true,
    path: "/employees",
    accessContext: { allowed: false },
    isCurrent: () => true,
  };

  const firstEvaluation = runner.evaluate(input);
  await Promise.resolve();
  assert.equal(calls, 1);
  const latestEvaluation = runner.evaluate({
    ...input,
    accessContext: { allowed: false, revision: 2 },
  });
  first.reject(new Error("first navigation failed"));

  assert.equal(await firstEvaluation, false);
  assert.equal(await latestEvaluation, true);
  assert.equal(calls, 2);
  assert.deepEqual(errors, ["first navigation failed"]);
});

test("guard runner stops after two consecutive router rejections", async () => {
  let calls = 0;
  const errors = [];
  const runner = createCurrentPageAccessGuardRunner({
    isAllowed: () => false,
    async replace() {
      calls += 1;
      throw new Error(`navigation failed ${calls}`);
    },
    reportError: (error) => errors.push(error.message),
  });

  assert.equal(
    await runner.evaluate({
      isReady: true,
      path: "/employees",
      accessContext: {},
      isCurrent: () => true,
    }),
    false,
  );
  assert.equal(calls, 2);
  assert.deepEqual(errors, ["navigation failed 1", "navigation failed 2"]);
});

test("guard runner cancels retry when the route changes", async () => {
  const first = deferred();
  let current = true;
  let calls = 0;
  const runner = createCurrentPageAccessGuardRunner({
    isAllowed: () => false,
    replace() {
      calls += 1;
      return first.promise;
    },
  });
  const result = runner.evaluate({
    isReady: true,
    path: "/employees",
    accessContext: {},
    isCurrent: () => current,
  });

  await Promise.resolve();
  current = false;
  first.reject(new Error("navigation failed"));
  assert.equal(await result, false);
  assert.equal(calls, 1);
});

test("guard runner cancels retry when access is restored", async () => {
  const first = deferred();
  let accessContext = { allowed: false };
  let calls = 0;
  const runner = createCurrentPageAccessGuardRunner({
    isAllowed: (_, context) => context.allowed,
    replace() {
      calls += 1;
      return first.promise;
    },
  });
  const result = runner.evaluate({
    isReady: true,
    path: "/employees",
    accessContext,
    getAccessContext: () => accessContext,
    isCurrent: () => true,
  });

  await Promise.resolve();
  accessContext = { allowed: true };
  first.reject(new Error("navigation failed"));
  assert.equal(await result, false);
  assert.equal(calls, 1);
});

test("default layout installs a reactive current-page access guard", async () => {
  const [guard, layout] = await Promise.all([
    readFile(
      new URL(
        "../../composables/application/auth/useCurrentPageAccessGuard.js",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../../layouts/default.vue", import.meta.url), "utf8"),
  ]);

  assert.match(guard, /getPageAccessContextKey\(auth\)/);
  assert.match(guard, /isPageAllowed\(/);
  assert.match(guard, /createCurrentPageAccessGuardRunner/);
  assert.match(guard, /isCurrent: \(path\) => route\.path === path/);
  assert.match(layout, /useCurrentPageAccessGuard\(\)/);

  const { descriptor, errors } = parse(layout, {
    filename: "layouts/default.vue",
  });
  assert.deepEqual(errors, []);
  compileScript(descriptor, { id: "default-layout" });
  assert.deepEqual(
    compileTemplate({
      id: "default-layout",
      filename: "layouts/default.vue",
      source: descriptor.template.content,
    }).errors,
    [],
  );
});
