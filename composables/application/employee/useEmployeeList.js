import { computed, onScopeDispose, ref, watch } from "vue";
import { collection, onSnapshot, query } from "firebase/firestore";
import { Employee } from "@/schemas";
import { rawForClass } from "@/functions/shared/employeeContract.js";
import { useEmployeeReadAccess } from "@/composables/application/employee/useEmployeeReadAccess";
import { createEmployeeListSession } from "@/composables/domain/employee/employeeListSession.js";

export function useEmployeeList({ status, search, fetchAllOnEmpty = false }) {
  const { $firestore } = useNuxtApp();
  const access = useEmployeeReadAccess();
  const docs = ref([]);
  const loading = ref(false);
  const error = ref("");

  const session = createEmployeeListSession({
    changed: (snapshot) => {
      docs.value = snapshot.items;
      loading.value = snapshot.loading;
      error.value = snapshot.error;
    },
    subscribe: ({ scope, text }, next, fail) => {
      const companyId = JSON.parse(scope)[0];
      const model = new Employee();
      const options = [
        ["where", "employmentStatus", "==", status],
      ];
      const constraints = text
        ? [...model.createTokenMapQueries(text), ...model.createQueries(options)]
        : model.createQueries(options);
      return onSnapshot(
        query(
          collection($firestore, `Companies/${companyId}/Employees`),
          ...constraints,
        ),
        { includeMetadataChanges: true },
        (snapshot) => {
          if (snapshot.metadata.fromCache) return;
          next(
            snapshot.docs.map(
              (entry) => new Employee(rawForClass(entry.data())),
            ),
          );
        },
        fail,
      );
    },
  });

  const normalizedSearch = computed(() =>
    typeof search.value === "string" ? search.value.trim() : "",
  );

  watch(
    () => [access.scope.value, normalizedSearch.value],
    ([scope, text]) => {
      const shouldLoad = Boolean(scope && (text || fetchAllOnEmpty));
      session.load(shouldLoad ? { scope, text } : null);
    },
    { immediate: true, flush: "sync" },
  );

  onScopeDispose(() => session.dispose());

  return {
    docs,
    loading: computed(() => access.loading.value || loading.value),
    error,
    reload: session.reload,
  };
}
