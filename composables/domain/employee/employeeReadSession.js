import { identifier, plain } from "../shared/valueContract.js";

// Read snapshots can contain Firestore GeoPoint/Bytes/DocumentReference as well as
// Timestamp. They are not operation expected-values and must retain their types.
function sameRaw(left, right) {
  if (Object.is(left, right)) return true;
  if (left instanceof Date && right instanceof Date) return left.getTime() === right.getTime();
  if (left?.constructor === right?.constructor && typeof left?.isEqual === "function") return left.isEqual(right);
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((value, index) => sameRaw(value, right[index]));
  if (plain(left) && plain(right)) {
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every((key) => Object.hasOwn(right, key) && sameRaw(left[key], right[key]));
  }
  return false;
}

export function createEmployeeReadSession({ listen, search, convert, changed = () => {} }) {
  let scope = null, generation = 0, disposed = false, failed = false, serial = 0;
  const observed = new Map(), documentObserved = new Set();
  const items = new Map(), states = new Map(), subscriptions = new Map(), searches = new Map(), pending = new Set();
  const publish = () => changed();
  const ticket = () => ({ scope, generation, serial });
  const current = (value) => !disposed && !failed && scope !== null && value.scope === scope && value.generation === generation;
  function clear({ failure = false } = {}) {
    generation++; failed = failure;
    for (const entry of subscriptions.values()) { entry.stop?.(); entry.resolve(null); }
    subscriptions.clear(); searches.clear(); items.clear(); states.clear(); pending.clear(); observed.clear(); documentObserved.clear(); publish();
  }
  function setScope(value) { if (scope !== value) { scope = value; failed = false; clear(); } }
  function fail(value) { if (!current(value)) return; clear({ failure: true }); }
  function values() { return [...items.values()].map((entry) => entry.model); }
  function invalidateSearches(id) {
    for (const entry of searches.values()) if (entry.ids.includes(id)) {
      entry.ids = entry.ids.filter((value) => value !== id); entry.expires = 0;
      void runSearch(entry);
    }
  }
  function accept(id, raw, source, invalidate = true) {
    if (!current(source) || !identifier(id)) return false;
    if (raw === null) { items.delete(id); observed.set(id, ++serial); states.set(id, "missing"); if (invalidate) invalidateSearches(id); publish(); return true; }
    if (!raw || raw.docId !== id) { fail(source); return false; }
    const prior = items.get(id);
    if (!prior || !sameRaw(prior.raw, raw)) {
      let model; try { model = convert(raw); } catch { fail(source); return false; }
      items.set(id, { raw, model }); observed.set(id, ++serial); if (prior && invalidate) invalidateSearches(id);
    }
    states.set(id, "ready"); publish(); return true;
  }
  function fetch(id) {
    if (!identifier(id) || !current(ticket())) return Promise.resolve(null);
    if (subscriptions.has(id)) return subscriptions.get(id).promise;
    const source = ticket(), entry = { stop: null, resolve: null, promise: null };
    entry.promise = new Promise((resolve) => { entry.resolve = resolve; });
    subscriptions.set(id, entry); pending.add(entry); if (!items.has(id)) states.set(id, "loading"); publish();
    try {
      const stop = listen(scope, id, (raw) => {
        if (!current(source)) return;
        documentObserved.add(id);
        accept(id, raw, source); pending.delete(entry); entry.resolve(items.get(id)?.model || null); publish();
      }, () => fail(source));
      if (current(source)) entry.stop = stop; else stop?.();
    } catch { fail(source); }
    return entry.promise;
  }
  async function runSearch(entry) {
    const source = ticket(); if (!current(source)) return [];
    const revision = ++entry.revision, startSerial = serial, marker = {}; pending.add(marker); publish();
    try {
      const records = await search(scope, entry.text, entry.options);
      if (!current(source) || revision !== entry.revision) return [];
      if (records.some(({ id }) => (observed.get(id) || 0) > startSerial)) return await runSearch(entry);
      for (const { id, raw } of records) if (!acceptQuery(id, raw, source, false)) return [];
      entry.ids = records.map((record) => record.id); entry.expires = Date.now() + entry.ttl;
      for (const id of entry.ids) void fetch(id);
      publish(); return entry.ids.map((id) => items.get(id)?.model).filter(Boolean);
    } catch { if (current(source) && revision === entry.revision) fail(source); return []; }
    finally { if (current(source)) { pending.delete(marker); publish(); } }
  }
  const searchKey = (text, options) => JSON.stringify([text, options.additionalConstraints || [], options.limit ?? 50]);
  async function find(text, options = {}, ttl = 300000) {
    const source = ticket(); if (!current(source) || typeof text !== "string" || !text) return [];
    const key = searchKey(text, options); let entry = searches.get(key);
    if (!entry) { entry = { text, options, ids: [], expires: 0, revision: 0, ttl, request: null }; searches.set(key, entry); }
    if (options.forceRefresh || entry.expires <= Date.now()) {
      if (!entry.request || options.forceRefresh) {
        const request = runSearch(entry); entry.request = request;
        void request.finally(() => { if (entry.request === request) entry.request = null; });
      }
      await entry.request;
    }
    if (!current(source)) return [];
    return options.returnAllCached === false ? results(text, options) : values();
  }
  function results(text, options = {}) { return (searches.get(searchKey(text, options))?.ids || []).map((id) => items.get(id)?.model).filter(Boolean); }
  function acceptQuery(id, raw, source, invalidate = true) {
    if (!current(source)) return false;
    // Query membership is separate from original-document freshness. An
    // individual observation wins, including absence. Query arrival order alone
    // cannot order conflicting raw values, so resolve only that ID's original.
    if (documentObserved.has(id)) return true;
    const prior = items.get(id);
    if (prior && !sameRaw(prior.raw, raw)) {
      void fetch(id);
      return current(source);
    }
    return (observed.get(id) || 0) > source.serial ? true : accept(id, raw, source, invalidate);
  }
  return { ticket, current, clear, setScope, accept, acceptQuery, fetch, find, results, values, fail,
    get: (id) => items.get(id)?.model || null, raw: (id) => items.get(id)?.raw || null,
    status: (id) => failed ? "error" : !scope ? "denied" : states.get(id) || "idle",
    isLoading: () => pending.size > 0, isFailed: () => failed, generation: () => generation,
    dispose() { disposed = true; scope = null; clear(); },
  };
}
