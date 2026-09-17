import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("Site lifecycle editors use standard SiteManager updates", async () => {
  const [manager, terminate, reactivate] = await Promise.all([
    read("components/Site/Manager/index.vue"),
    read("components/Site/Editor/Terminate.vue"),
    read("components/Site/Editor/Reactivate.vue"),
  ]);
  assert.match(manager, /return await draft\.update\(\)/u);
  assert.match(manager, /lifecycleMode/u);
  assert.match(manager, /statusChangeSource = "MANUAL"/u);
  assert.match(manager, /statusChangeSource = "REACTIVATION"/u);
  assert.match(terminate, /<SiteManager/u);
  assert.match(terminate, /lifecycle-mode="TERMINATE"/u);
  assert.match(terminate, /custom-input="SiteLifecycleInput"/u);
  assert.match(reactivate, /<SiteManager/u);
  assert.match(reactivate, /lifecycle-mode="REACTIVATE"/u);
  assert.match(reactivate, /custom-input="SiteLifecycleInput"/u);
});

test("manual Site lifecycle Callable modules are absent while automatic termination remains", async () => {
  const [apiIndex, moduleIndex, lifecycle, autoTermination] = await Promise.all([
    read("functions/apis/index.js"),
    read("functions/modules/sites/index.js"),
    read("functions/modules/sites/lifecycle.js"),
    read("functions/modules/sites/autoTermination.js"),
  ]);
  for (const source of [apiIndex, moduleIndex]) {
    assert.doesNotMatch(source, /reactivateSite|terminateSite/u);
  }
  assert.match(lifecycle, /export async function autoTerminateSite/u);
  assert.match(autoTermination, /autoTerminateSite/u);
});
