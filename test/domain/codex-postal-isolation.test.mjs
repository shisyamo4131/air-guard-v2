import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import {
  createCodexPostalIsolationPlugin,
  CODEX_POSTAL_ISOLATION_RECEIPT,
} from "../../scripts/vite-codex-postal-isolation.mjs";

async function fixture(t) {
  const projectRoot = await mkdtemp(join(tmpdir(), "codex-postal-"));
  t.after(() => rm(projectRoot, { recursive: true, force: true }));
  const target = join(projectRoot, "air-vuetify-v3/src/utils/postalCode.js");
  await mkdir(resolve(target, ".."), { recursive: true });
  await writeFile(target, "export const original = true;\n");
  return { projectRoot, target };
}

const context = (assets = []) => ({
  error(message) { throw new Error(message); },
  emitFile(asset) { assets.push(asset); },
});

test("postal plugin replaces only the resolved target including Windows/query IDs", async (t) => {
  const { projectRoot, target } = await fixture(t);
  const otherTarget = join(projectRoot, "other/src/utils/postalCode.js");
  await mkdir(resolve(otherTarget, ".."), { recursive: true });
  await writeFile(otherTarget, "export const unrelated = true;");
  for (const id of [target, target.replaceAll("\\", "/"), `${target}?v=synthetic`, `${target.replaceAll("/", "\\")}?import`]) {
    const plugin = createCodexPostalIsolationPlugin({ projectRoot });
    assert.equal(plugin.apply, "build");
    assert.equal(plugin.enforce, "pre");
    const assets = [];
    const hooks = context(assets);
    await plugin.buildStart.call(hooks);
    for (const other of [`${target}.map`, `${target}.other.js`, otherTarget]) {
      assert.equal(await plugin.transform.call(hooks, "original", other), null);
    }
    const result = await plugin.transform.call(hooks, "original", id);
    const code = typeof result === "string" ? result : result.code;
    let fetchCalls = 0;
    const fetchAddress = runInNewContext(`${code.replace(/export\s+/g, "")}\nfetchAddressFromPostalCode`, {
      fetch() { fetchCalls++; throw new Error("network forbidden"); },
    });
    for (const postal of ["0000000", "1000001", "9999999"]) assert.equal(await fetchAddress(postal), null);
    assert.equal(fetchCalls, 0);
    await plugin.generateBundle.call(hooks);
    assert.equal(assets.length, 1);
    assert.deepEqual(JSON.parse(assets[0].source), CODEX_POSTAL_ISOLATION_RECEIPT);
  }
});

test("postal plugin rejects dev and SSR and resets replacement evidence each build", async (t) => {
  const { projectRoot, target } = await fixture(t);
  const plugin = createCodexPostalIsolationPlugin({ projectRoot });
  assert.throws(() => plugin.configResolved({ command: "serve", build: {} }), /client build/);
  assert.throws(() => plugin.configResolved({ command: "build", build: { ssr: true } }), /client build/);
  plugin.configResolved({ command: "build", build: {} });
  await plugin.buildStart.call(context());
  assert.throws(() => plugin.transform.call(context(), "original", target, { ssr: true }), /client build/);
  await plugin.transform.call(context(), "original", target);
  await plugin.buildStart.call(context());
  assert.throws(() => plugin.generateBundle.call(context()), /not applied/);
});

test("postal build fails closed for missing target and unused replacement", async (t) => {
  const { projectRoot, target } = await fixture(t);
  const unused = createCodexPostalIsolationPlugin({ projectRoot });
  await unused.buildStart.call(context());
  await assert.rejects(async () => unused.generateBundle.call(context()));
  await rm(target);
  await assert.rejects(async () => createCodexPostalIsolationPlugin({ projectRoot }).buildStart.call(context()));
});

test("real AirPostalCode watcher emits no address and preserves manual address under isolation", async (t) => {
  const { projectRoot, target } = await fixture(t);
  const plugin = createCodexPostalIsolationPlugin({ projectRoot });
  await plugin.buildStart.call(context());
  const transformed = await plugin.transform.call(context(), "original", target);
  const code = typeof transformed === "string" ? transformed : transformed.code;
  const source = await readFile(new URL("../../air-vuetify-v3/src/AirPostalCode.vue", import.meta.url), "utf8");
  const script = source.match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*;\r?\n/gm, "");
  let watcher;
  let fetchCalls = 0;
  let manualAddress = "synthetic manual address";
  const emissions = [];
  runInNewContext(`${code.replace(/export\s+/g, "")}\n${script}`, {
    defineOptions() {}, defineProps: () => ({ loading: false }), defineModel: () => ({}),
    defineEmits: () => (...args) => { emissions.push(args); manualAddress = args[1]; },
    ref: (value) => ({ value }), computed: (fn) => fn,
    watch: (_model, callback) => { watcher = callback; },
    fetch() { fetchCalls++; throw new Error("network forbidden"); }, console,
  });
  for (const value of ["", "123", "0000000", "1000001", "9999999"]) await watcher(value);
  assert.deepEqual(emissions, []);
  assert.equal(manualAddress, "synthetic manual address");
  assert.equal(fetchCalls, 0);
});

test("normal postal utility retains lookup behavior with mocked fetch only", async () => {
  const source = await readFile(new URL("../../air-vuetify-v3/src/utils/postalCode.js", import.meta.url), "utf8");
  const requests = [];
  const address = { address1: "synthetic", address2: "city", address3: "street" };
  const lookup = runInNewContext(`${source.replace(/export\s+/g, "")}\nfetchAddressFromPostalCode`, {
    fetch: async (url) => { requests.push(url); return { ok: true, json: async () => ({ status: 200, results: [address] }) }; },
    console: { log() {}, warn() {}, error() {}, table() {} },
  });
  assert.equal(await lookup("1000001"), address);
  assert.deepEqual(requests, ["https://zipcloud.ibsnet.co.jp/api/search?zipcode=1000001"]);
  assert.equal(await lookup("invalid"), null);
  assert.equal(requests.length, 1);
});
