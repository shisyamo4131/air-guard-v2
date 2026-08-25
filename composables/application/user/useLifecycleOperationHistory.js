/*****************************************************************************
 * @file ./composables/application/user/useLifecycleOperationHistory.js
 * @description 会社管理者向けlifecycle履歴のcursor paging状態を管理します。
 *****************************************************************************/
import { computed, onUnmounted, readonly, ref, watch } from "vue";
import { canViewLifecycleOperationHistory } from "../../../utils/auth/policies/userLifecycleUiPolicy";
import { useAuthFunctions } from "../../auth/useAuthFunctions";

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ITEM_FIELDS = Object.freeze([
  "operationType",
  "status",
  "actorDisplayName",
  "employeeId",
  "subjectDisplayName",
  "includesUserAccountDeletion",
  "effectiveDate",
  "reason",
  "createdAt",
  "completedAt",
]);
const OPERATION_TYPES = new Set([
  "employee-retirement",
  "standalone-registered-user-deletion",
  "employee-reinstatement",
]);
const STATUSES = new Set(["processing", "retrying", "completed"]);
const SAFE_ERROR_MESSAGE =
  "履歴を取得できませんでした。時間をおいて再試行してください。";

function isPlainObject(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (Object.getPrototypeOf(value) === Object.prototype ||
        Object.getPrototypeOf(value) === null),
  );
}

function hasExactFields(value, fields) {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  return (
    keys.length === fields.length && keys.every((key) => fields.includes(key))
  );
}

function isSafeId(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    !value.includes("/") &&
    !/\s/u.test(value)
  );
}

function isNullableTrimmedText(value, maxLength) {
  return (
    value === null ||
    (typeof value === "string" &&
      value.length > 0 &&
      value.length <= maxLength &&
      value.trim() === value)
  );
}

function isDateOnly(value) {
  if (typeof value !== "string") return false;
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    year > 0 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isIsoTimestamp(value) {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

function isValidItem(item) {
  if (!hasExactFields(item, ITEM_FIELDS)) return false;
  if (
    !OPERATION_TYPES.has(item.operationType) ||
    !STATUSES.has(item.status) ||
    typeof item.actorDisplayName !== "string" ||
    !item.actorDisplayName ||
    item.actorDisplayName.length > 6 ||
    item.actorDisplayName.trim() !== item.actorDisplayName ||
    typeof item.includesUserAccountDeletion !== "boolean" ||
    !isIsoTimestamp(item.createdAt) ||
    (item.completedAt !== null && !isIsoTimestamp(item.completedAt)) ||
    ((item.status === "completed") !== (item.completedAt !== null))
  ) {
    return false;
  }

  if (item.operationType === "employee-retirement") {
    return (
      isSafeId(item.employeeId) &&
      item.subjectDisplayName === null &&
      isDateOnly(item.effectiveDate) &&
      isNullableTrimmedText(item.reason, 20) &&
      item.reason !== null
    );
  }
  if (item.operationType === "standalone-registered-user-deletion") {
    return (
      item.employeeId === null &&
      isNullableTrimmedText(item.subjectDisplayName, 6) &&
      item.subjectDisplayName !== null &&
      item.includesUserAccountDeletion === true &&
      item.effectiveDate === null &&
      isNullableTrimmedText(item.reason, 20) &&
      item.reason !== null
    );
  }
  return (
    isSafeId(item.employeeId) &&
    item.subjectDisplayName === null &&
    item.includesUserAccountDeletion === false &&
    item.effectiveDate === null &&
    item.reason === null
  );
}

function resolveResponse(value) {
  if (
    !hasExactFields(value, ["schemaVersion", "items", "nextCursor"]) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.items) ||
    value.items.length > 20 ||
    !value.items.every(isValidItem) ||
    (value.nextCursor !== null && value.items.length !== 20) ||
    (value.nextCursor !== null &&
      (typeof value.nextCursor !== "string" ||
        !UUID_V4_PATTERN.test(value.nextCursor)))
  ) {
    throw new Error("Lifecycle operation history response is invalid");
  }
  return {
    items: value.items.map((item) => Object.freeze({ ...item })),
    nextCursor: value.nextCursor,
  };
}

export function useLifecycleOperationHistory() {
  const auth = useAuthStore();
  const { listLifecycleOperations } = useAuthFunctions();
  const items = ref([]);
  const currentCursor = ref(null);
  const nextCursor = ref(null);
  const cursorStack = ref([]);
  const loading = ref(false);
  const loaded = ref(false);
  const errorMessage = ref(null);
  let generation = 0;

  const eligible = computed(() =>
    canViewLifecycleOperationHistory({
      companyId: auth.companyId,
      actorUid: auth.uid,
      actorUser: auth.user,
      isSuperUser: auth.isSuperUser,
    }),
  );
  const hasPreviousPage = computed(() => cursorStack.value.length > 0);
  const hasNextPage = computed(() => nextCursor.value !== null);

  function clear() {
    generation += 1;
    items.value = [];
    currentCursor.value = null;
    nextCursor.value = null;
    cursorStack.value = [];
    loading.value = false;
    loaded.value = false;
    errorMessage.value = null;
  }

  async function fetchPage(cursor) {
    if (!eligible.value || loading.value) return null;
    const requestGeneration = generation;
    loading.value = true;
    errorMessage.value = null;
    try {
      const response = resolveResponse(
        await listLifecycleOperations({ cursor }),
      );
      if (requestGeneration !== generation || !eligible.value) return null;
      return response;
    } catch {
      if (requestGeneration === generation && eligible.value) {
        errorMessage.value = SAFE_ERROR_MESSAGE;
      }
      return null;
    } finally {
      if (requestGeneration === generation) loading.value = false;
    }
  }

  async function loadInitial() {
    const response = await fetchPage(null);
    if (!response) return false;
    items.value = response.items;
    currentCursor.value = null;
    nextCursor.value = response.nextCursor;
    cursorStack.value = [];
    loaded.value = true;
    return true;
  }

  async function loadNext() {
    if (nextCursor.value === null) return false;
    const cursor = nextCursor.value;
    const response = await fetchPage(cursor);
    if (!response) return false;
    cursorStack.value = [...cursorStack.value, currentCursor.value];
    currentCursor.value = cursor;
    items.value = response.items;
    nextCursor.value = response.nextCursor;
    loaded.value = true;
    return true;
  }

  async function loadPrevious() {
    if (cursorStack.value.length === 0) return false;
    const cursor = cursorStack.value[cursorStack.value.length - 1];
    const response = await fetchPage(cursor);
    if (!response) return false;
    cursorStack.value = cursorStack.value.slice(0, -1);
    currentCursor.value = cursor;
    items.value = response.items;
    nextCursor.value = response.nextCursor;
    loaded.value = true;
    return true;
  }

  async function retry() {
    const response = await fetchPage(currentCursor.value);
    if (!response) return false;
    items.value = response.items;
    nextCursor.value = response.nextCursor;
    loaded.value = true;
    return true;
  }

  watch(
    () => [
      auth.companyId,
      auth.uid,
      auth.user?.docId,
      auth.user?.companyId,
      auth.user?.isTemporary,
      auth.user?.disabled,
      auth.user?.isAdmin,
      auth.isSuperUser,
      eligible.value,
    ],
    (actorContext) => {
      const allowed = actorContext[actorContext.length - 1] === true;
      clear();
      if (allowed) void loadInitial();
    },
    { flush: "post", immediate: true },
  );
  onUnmounted(clear);

  return {
    eligible,
    errorMessage: readonly(errorMessage),
    hasNextPage,
    hasPreviousPage,
    items: readonly(items),
    loaded: readonly(loaded),
    loading: readonly(loading),
    loadNext,
    loadPrevious,
    retry,
  };
}
