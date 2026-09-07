import {
  collection,
  documentId,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
} from "firebase/firestore";
import {
  generateNGramTokens,
  normalizeTokenText,
} from "@shisyamo4131/air-firebase-v2/utils/tokenMap";
import { computed, isRef, onScopeDispose, readonly, ref, watch } from "vue";
import { Outsourcer } from "@/schemas";
import { useLogger } from "@/composables/useLogger";

const PAGE_SIZE = 20;
const QUERY_LIMIT = PAGE_SIZE + 1;
const MIN_SEARCH_LENGTH = 2;
const MAX_SEARCH_LENGTH = 40;
const SAFE_ERROR_MESSAGE =
  "外注先情報を取得できませんでした。時間をおいて再試行してください。";

function compareText(left, right) {
  const leftText = typeof left === "string" ? left : "";
  const rightText = typeof right === "string" ? right : "";
  if (leftText === rightText) return 0;
  return leftText < rightText ? -1 : 1;
}

function sortOutsourcers(items) {
  return [...items].sort(
    (left, right) =>
      compareText(left.nameKana, right.nameKana) ||
      compareText(left.docId, right.docId),
  );
}

export function useOutsourcerListPagination({ search }) {
  if (!isRef(search)) {
    throw new Error("`search` must be a ref.");
  }

  const { $firestore } = useNuxtApp();
  const auth = useAuthStore();
  const logger = useLogger("useOutsourcerListPagination");
  const items = ref([]);
  const allSearchItems = ref([]);
  const currentCursor = ref(null);
  const nextCursor = ref(null);
  const cursorStack = ref([]);
  const searchPage = ref(1);
  const loading = ref(false);
  const loaded = ref(false);
  const errorMessage = ref(null);
  let generation = 0;
  let listenerVersion = 0;
  let pendingFirstSnapshot = null;
  let unsubscribePage = null;

  const normalizedSearch = computed(() => normalizeTokenText(search.value));
  const isEmptySearch = computed(
    () =>
      search.value === null ||
      search.value === undefined ||
      search.value === "",
  );
  const isValidSearch = computed(
    () =>
      normalizedSearch.value.length >= MIN_SEARCH_LENGTH &&
      normalizedSearch.value.length <= MAX_SEARCH_LENGTH,
  );
  const currentPage = computed(() =>
    isValidSearch.value ? searchPage.value : cursorStack.value.length + 1,
  );
  const hasPreviousPage = computed(() =>
    isValidSearch.value
      ? searchPage.value > 1
      : cursorStack.value.length > 0,
  );
  const hasNextPage = computed(() =>
    isValidSearch.value
      ? searchPage.value * PAGE_SIZE < allSearchItems.value.length
      : nextCursor.value !== null,
  );

  function stopPageListener() {
    unsubscribePage?.();
    unsubscribePage = null;
    if (pendingFirstSnapshot) {
      pendingFirstSnapshot.resolve(null);
      pendingFirstSnapshot = null;
    }
  }

  function reset() {
    generation += 1;
    listenerVersion += 1;
    stopPageListener();
    items.value = [];
    allSearchItems.value = [];
    currentCursor.value = null;
    nextCursor.value = null;
    cursorStack.value = [];
    searchPage.value = 1;
    loading.value = false;
    loaded.value = false;
    errorMessage.value = null;
  }

  function outsourcerCollection(companyId) {
    return collection(
      $firestore,
      "Companies",
      companyId,
      "Outsourcers",
    ).withConverter(Outsourcer.converter());
  }

  function buildEmptySearchQuery(companyId, cursor) {
    const constraints = [
      orderBy("nameKana", "asc"),
      orderBy(documentId(), "asc"),
    ];
    if (cursor) constraints.push(startAfter(cursor));
    constraints.push(limit(QUERY_LIMIT));
    return query(outsourcerCollection(companyId), ...constraints);
  }

  function buildKeywordSearchQuery(companyId, searchText) {
    const constraints = generateNGramTokens(searchText).map((token) =>
      where(`tokenMap.${token}`, "==", true),
    );
    return query(outsourcerCollection(companyId), ...constraints);
  }

  function syncSearchPageItems() {
    const maximumPage = Math.max(
      1,
      Math.ceil(allSearchItems.value.length / PAGE_SIZE),
    );
    searchPage.value = Math.min(searchPage.value, maximumPage);
    const offset = (searchPage.value - 1) * PAGE_SIZE;
    items.value = allSearchItems.value.slice(offset, offset + PAGE_SIZE);
  }

  function responseIsCurrent(response) {
    return Boolean(
      response &&
        response.generation === generation &&
        response.listenerVersion === listenerVersion &&
        response.companyId === auth.companyId &&
        response.search === search.value,
    );
  }

  function commitResponse(response) {
    if (response.mode === "keyword") {
      allSearchItems.value = response.allItems;
      syncSearchPageItems();
      nextCursor.value = null;
      return;
    }
    items.value = response.items;
    nextCursor.value = response.nextCursor;
  }

  async function subscribePage(cursor) {
    if (loading.value || typeof auth.companyId !== "string") return null;
    if (!isEmptySearch.value && !isValidSearch.value) return null;

    stopPageListener();
    const requestGeneration = generation;
    const requestListenerVersion = ++listenerVersion;
    const requestCompanyId = auth.companyId;
    const requestSearch = search.value;
    const requestNormalizedSearch = normalizedSearch.value;
    const requestMode = isEmptySearch.value ? "empty" : "keyword";
    loading.value = true;
    errorMessage.value = null;

    return await new Promise((resolve) => {
      let receivedFirstSnapshot = false;

      function isCurrentListener() {
        return (
          requestGeneration === generation &&
          requestListenerVersion === listenerVersion &&
          requestCompanyId === auth.companyId &&
          requestSearch === search.value
        );
      }

      function settleFirstSnapshot(value) {
        if (
          pendingFirstSnapshot?.listenerVersion === requestListenerVersion
        ) {
          pendingFirstSnapshot = null;
        }
        resolve(value);
      }

      function responseFromSnapshot(snapshot) {
        const metadata = {
          companyId: requestCompanyId,
          generation: requestGeneration,
          listenerVersion: requestListenerVersion,
          mode: requestMode,
          search: requestSearch,
        };
        if (requestMode === "keyword") {
          return {
            ...metadata,
            allItems: sortOutsourcers(
              snapshot.docs.map((documentSnapshot) =>
                documentSnapshot.data(),
              ),
            ),
          };
        }
        const visibleSnapshots = snapshot.docs.slice(0, PAGE_SIZE);
        return {
          ...metadata,
          items: visibleSnapshots.map((documentSnapshot) =>
            documentSnapshot.data(),
          ),
          nextCursor:
            snapshot.docs.length > PAGE_SIZE
              ? visibleSnapshots[visibleSnapshots.length - 1]
              : null,
        };
      }

      function handleSnapshot(snapshot) {
        if (!isCurrentListener()) return;
        const response = responseFromSnapshot(snapshot);
        if (!receivedFirstSnapshot) {
          receivedFirstSnapshot = true;
          loading.value = false;
          settleFirstSnapshot(response);
          return;
        }
        if (responseIsCurrent(response)) commitResponse(response);
      }

      function handleError(error) {
        if (!isCurrentListener()) return;
        errorMessage.value = SAFE_ERROR_MESSAGE;
        logger.error({
          message: "Failed to load the current Outsourcer list page.",
          error,
        });
        loading.value = false;
        unsubscribePage = null;
        if (!receivedFirstSnapshot) settleFirstSnapshot(null);
      }

      pendingFirstSnapshot = {
        listenerVersion: requestListenerVersion,
        resolve,
      };
      try {
        const pageQuery =
          requestMode === "empty"
            ? buildEmptySearchQuery(requestCompanyId, cursor)
            : buildKeywordSearchQuery(
                requestCompanyId,
                requestNormalizedSearch,
              );
        unsubscribePage = onSnapshot(
          pageQuery,
          handleSnapshot,
          handleError,
        );
      } catch (error) {
        handleError(error);
      }
    });
  }

  async function loadInitial() {
    const response = await subscribePage(null);
    if (!responseIsCurrent(response)) return false;
    currentCursor.value = null;
    cursorStack.value = [];
    searchPage.value = 1;
    commitResponse(response);
    loaded.value = true;
    return true;
  }

  async function loadNext() {
    if (loading.value || !hasNextPage.value) return false;
    if (isValidSearch.value) {
      searchPage.value += 1;
      syncSearchPageItems();
      return true;
    }

    const cursor = nextCursor.value;
    const response = await subscribePage(cursor);
    if (!responseIsCurrent(response)) return false;
    cursorStack.value = [...cursorStack.value, currentCursor.value];
    currentCursor.value = cursor;
    commitResponse(response);
    loaded.value = true;
    return true;
  }

  async function loadPrevious() {
    if (loading.value || !hasPreviousPage.value) return false;
    if (isValidSearch.value) {
      searchPage.value -= 1;
      syncSearchPageItems();
      return true;
    }

    const cursor = cursorStack.value[cursorStack.value.length - 1];
    const response = await subscribePage(cursor);
    if (!responseIsCurrent(response)) return false;
    cursorStack.value = cursorStack.value.slice(0, -1);
    currentCursor.value = cursor;
    commitResponse(response);
    loaded.value = true;
    return true;
  }

  async function reload() {
    const response = await subscribePage(currentCursor.value);
    if (!responseIsCurrent(response)) return false;
    commitResponse(response);
    loaded.value = true;
    return true;
  }

  async function restart() {
    reset();
    if (typeof auth.companyId !== "string" || !auth.companyId) return false;
    if (!isEmptySearch.value && !isValidSearch.value) return false;
    return await loadInitial();
  }

  watch(
    [() => auth.companyId, () => search.value],
    ([companyId]) => {
      reset();
      if (
        typeof companyId === "string" &&
        companyId &&
        (isEmptySearch.value || isValidSearch.value)
      ) {
        void loadInitial();
      }
    },
    { flush: "post", immediate: true },
  );
  onScopeDispose(reset);

  return {
    currentPage,
    errorMessage: readonly(errorMessage),
    hasNextPage,
    hasPreviousPage,
    items: readonly(items),
    loaded: readonly(loaded),
    loading: readonly(loading),
    loadNext,
    loadPrevious,
    reload,
    restart,
  };
}
