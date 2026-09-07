import { computed, ref, watch, onScopeDispose } from "vue";
import { collection, doc, getDocsFromServer, onSnapshot, query } from "firebase/firestore";
import { Employee } from "@/schemas";
import { rawForClass } from "@/functions/shared/employeeContract.js";
import { useEmployeeReadAccess } from "@/composables/application/employee/useEmployeeReadAccess";
import { createEmployeeReadSession } from "@/composables/domain/employee/employeeReadSession";

export function useFetchEmployee({ warnIfNotFound = true, searchCacheExpireMs = 300000 } = {}) {
  const { $firestore } = useNuxtApp(), access = useEmployeeReadAccess();
  const revision = ref(0);
  const company = (scope) => JSON.parse(scope)[0];
  const session = createEmployeeReadSession({
    changed: () => { revision.value++; }, convert: (raw) => new Employee(rawForClass(raw)),
    listen: (scope, id, next, error) => onSnapshot(doc($firestore, `Companies/${company(scope)}/Employees/${id}`), { includeMetadataChanges: true }, (snapshot) => {
      if (!snapshot.metadata.fromCache) next(snapshot.exists() ? snapshot.data() : null);
    }, error),
    search: async (scope, text, { additionalConstraints = [], limit = 50 }) => {
      const model = new Employee(), options = [...additionalConstraints];
      if (typeof limit === "number" && limit > 0) options.push(["limit", limit]);
      const reference = query(collection($firestore, `Companies/${company(scope)}/Employees`), ...model.createTokenMapQueries(text), ...model.createQueries(options));
      const snapshot = await getDocsFromServer(reference);
      return snapshot.docs.map((item) => ({ id: item.id, raw: item.data() }));
    },
  });
  watch(access.scope, (value) => session.setScope(value), { immediate: true, flush: "sync" });
  const tracked = (getter) => computed(() => { revision.value; return getter(); });
  const id = (source) => typeof source === "string" ? source : [source?.employeeId, source?.docId, source?.workerId].find((value) => typeof value === "string" && value);
  const cachedEmployeesArray = tracked(session.values), cachedEmployees = tracked(() => Object.fromEntries(session.values().map((item) => [item.docId, item])));
  const awaitingAccess = new Set();
  function waitForAccess() {
    if (session.current(session.ticket())) return Promise.resolve(session.ticket());
    if (!access.loading.value) return Promise.resolve(null);
    return new Promise((resolve) => {
      let stop;
      const finish = (allowed) => { stop?.(); awaitingAccess.delete(finish); resolve(allowed); };
      awaitingAccess.add(finish);
      stop = watch(() => [access.scope.value, access.loading.value], () => {
        if (session.current(session.ticket())) finish(session.ticket());
        else if (!access.loading.value) finish(null);
      }, { flush: "sync" });
    });
  }
  async function fetchEmployee(source) {
    const ids = [...new Set((Array.isArray(source) ? source : [source]).map(id).filter(Boolean))];
    const sourceScope = session.current(session.ticket()) ? session.ticket() : await waitForAccess();
    if (sourceScope && session.current(sourceScope)) await Promise.all(ids.map(session.fetch));
  }
  async function getEmployee(source) {
    const target = id(source), ticket = session.current(session.ticket()) ? session.ticket() : await waitForAccess();
    if (!ticket || !session.current(ticket)) return null;
    await session.fetch(target); return session.current(ticket) ? session.get(target) : null;
  }
  // Public Class pushes are hints to load a current raw document, never trusted snapshots.
  function pushEmployee(value, source = session.ticket()) { if (session.current(source)) void fetchEmployee(value); }
  function pushEmployees(values, source = session.ticket()) { if (session.current(source)) void fetchEmployee(values); }
  function clearCache() { for (const finish of [...awaitingAccess]) finish(null); session.clear(); }
  onScopeDispose(() => { for (const finish of [...awaitingAccess]) finish(null); session.dispose(); });
  return { fetchEmployee, getEmployee, cachedEmployees, cachedEmployeesArray, pushEmployee, pushEmployees,
    searchEmployees: (text, options = {}) => session.find(text, options, searchCacheExpireMs),
    searchResults: (text, options = {}) => { revision.value; return session.results(text, options); },
    isLoading: tracked(() => access.loading.value || session.isLoading()), canRead: tracked(() => access.canRead.value && !session.isFailed()),
    scope: access.scope, generation: tracked(session.generation), error: tracked(() => session.isFailed() ? "従業員情報を取得できません。再読込してください。" : ""),
    getStatus: (target) => { revision.value; return access.loading.value ? "loading" : session.status(target); },
    getRaw: (target) => { revision.value; return session.raw(target); },
    captureScope: session.ticket, isCurrent: session.current,
    acceptRaw: session.accept, acceptQueryRaw: session.acceptQuery, failRead: () => session.fail(session.ticket()), clearCache,
  };
}
