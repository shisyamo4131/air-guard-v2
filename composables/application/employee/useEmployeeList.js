import { computed, onScopeDispose, ref, watch } from "vue";
import {
  collection,
  documentId,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { normalizeTokenText } from "@shisyamo4131/air-firebase-v2/utils/tokenMap";
import { Employee } from "@/schemas";
import { rawForClass } from "@/composables/domain/shared/valueContract.js";
import { useEmployeeReadAccess } from "@/composables/application/employee/useEmployeeReadAccess";
import { createEmployeeListSession } from "@/composables/domain/employee/employeeListSession.js";

const PAGE_SIZE = 20;

export function useEmployeeList({ status, search, recentField = "updatedAt" }) {
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
      const statusConstraint = where("employmentStatus", "==", status);
      const constraints = text
        ? [...model.createTokenMapQueries(text), statusConstraint]
        : [
            statusConstraint,
            orderBy(recentField, "desc"),
            orderBy(documentId(), "desc"),
            limit(PAGE_SIZE),
          ];
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

  const normalizedSearch = computed(() => normalizeTokenText(search.value));

  watch(
    () => [access.scope.value, normalizedSearch.value],
    ([scope, text]) => {
      session.load(scope ? { scope, text } : null);
    },
    { immediate: true, flush: "sync" },
  );

  onScopeDispose(() => session.dispose());

  return {
    docs,
    loading: computed(() => access.loading.value || loading.value),
    error: computed(() => access.error.value || error.value),
    reload: () => access.error.value ? access.reload() : session.reload(),
  };
}
