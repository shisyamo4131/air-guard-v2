import * as Vue from "vue";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Site } from "@/schemas";
import { sortSitesActiveFirst } from "@/composables/domain/site/siteUiPresentation";
import { useAuthStore } from "@/stores/useAuthStore";
import { useLogger } from "@/composables/useLogger";

export const PAGE_SIZE = 20;

const SAFE_ERROR_MESSAGE = "現場情報を取得できませんでした。時間をおいて、もう一度お試しください。";

function createChannel(emptyValue) {
  return { sequence: 0, promise: Promise.resolve(emptyValue), emptyValue };
}

export function useActiveSiteLiveRead({ onItem } = {}) {
  const { $firestore } = useNuxtApp();
  const auth = useAuthStore();
  const logger = useLogger("useActiveSiteLiveRead");
  const items = Vue.ref([]);
  const isLoading = Vue.ref(false);
  const isLoaded = Vue.ref(false);
  const errorMessage = Vue.ref("");
  let generation = 0;
  let unsubscribe = null;

  function stop() {
    generation += 1;
    unsubscribe?.();
    unsubscribe = null;
  }

  function reset() {
    stop();
    items.value = [];
    isLoading.value = false;
    isLoaded.value = false;
    errorMessage.value = "";
  }

  function subscribe(companyId) {
    reset();
    if (typeof companyId !== "string" || !companyId) return;

    const requestGeneration = generation;
    const requestCompanyId = companyId;
    isLoading.value = true;

    const isCurrent = () =>
      requestGeneration === generation && requestCompanyId === auth.companyId;

    try {
      const siteQuery = query(
        collection($firestore, "Companies", companyId, "Sites")
          .withConverter(Site.converter()),
        where("status", "==", Site.STATUS_ACTIVE),
      );
      unsubscribe = onSnapshot(
        siteQuery,
        (snapshot) => {
          if (!isCurrent()) return;
          const nextItems = snapshot.docs.map((documentSnapshot) =>
            documentSnapshot.data(),
          );
          items.value = nextItems;
          isLoading.value = false;
          isLoaded.value = true;
          errorMessage.value = "";
          if (typeof onItem === "function") nextItems.forEach(onItem);
        },
        (error) => {
          if (!isCurrent()) return;
          items.value = [];
          isLoading.value = false;
          isLoaded.value = true;
          errorMessage.value = SAFE_ERROR_MESSAGE;
          unsubscribe = null;
          logger.error({ message: "Failed to load the active Site list.", error });
        },
      );
    } catch (error) {
      if (!isCurrent()) return;
      items.value = [];
      isLoading.value = false;
      isLoaded.value = true;
      errorMessage.value = SAFE_ERROR_MESSAGE;
      logger.error({ message: "Failed to subscribe to the active Site list.", error });
    }
  }

  Vue.watch(() => auth.companyId, subscribe, { immediate: true });
  Vue.onScopeDispose(reset);

  return {
    errorMessage: Vue.readonly(errorMessage),
    isLoaded: Vue.readonly(isLoaded),
    isLoading: Vue.readonly(isLoading),
    items: Vue.readonly(items),
  };
}

export function useSiteUiReads() {
  const loading = Vue.reactive({ terminated: false, autocomplete: false, lookup: false });
  const errorMessage = Vue.ref("");
  const isEmpty = Vue.ref(false);
  const notFound = Vue.ref(false);
  const channels = {
    terminated: createChannel([]),
    autocomplete: createChannel([]),
    lookup: createChannel(null),
  };

  const isLoading = Vue.computed(() => Object.values(loading).some(Boolean));

  async function latest(channelName, task, { kind }) {
    const channel = channels[channelName];
    const sequence = ++channel.sequence;
    loading[channelName] = true;
    errorMessage.value = "";
    if (kind === "lookup") notFound.value = false;

    const request = Promise.resolve().then(task);
    channel.promise = request;
    try {
      const result = await request;
      if (sequence !== channel.sequence) return await channel.promise;
      if (kind === "lookup") notFound.value = result == null;
      else isEmpty.value = !Array.isArray(result) || result.length === 0;
      return result;
    } catch (error) {
      if (sequence !== channel.sequence) return await channel.promise;
      errorMessage.value = SAFE_ERROR_MESSAGE;
      if (kind === "lookup") notFound.value = false;
      else isEmpty.value = false;
      throw error;
    } finally {
      if (sequence === channel.sequence) loading[channelName] = false;
    }
  }

  async function searchTerminatedSites(searchText) {
    const text = typeof searchText === "string" ? searchText.trim() : "";
    if (!text) {
      clear("terminated");
      return [];
    }
    return await latest("terminated", () => new Site().fetchDocs({
      constraints: text,
      options: [["where", "status", "==", Site.STATUS_TERMINATED]],
    }), { kind: "search" });
  }

  async function searchAutocompleteSites(searchText) {
    const text = typeof searchText === "string" ? searchText.trim() : "";
    if (!text) {
      clear("autocomplete");
      return [];
    }
    return await latest("autocomplete", async () => {
      const sites = await new Site().fetchDocs({ constraints: text });
      return [...sites].sort(sortSitesActiveFirst);
    }, { kind: "search" });
  }

  async function lookupSite(siteId) {
    if (typeof siteId !== "string" || !siteId.trim()) {
      clear("lookup");
      return null;
    }
    return await latest("lookup", () => new Site().fetchDoc({ docId: siteId }), { kind: "lookup" });
  }

  function clear(channelName = null) {
    const targets = channelName ? [channels[channelName]] : Object.values(channels);
    for (const channel of targets) {
      channel.sequence += 1;
      channel.promise = Promise.resolve(channel.emptyValue);
    }
    if (channelName) loading[channelName] = false;
    else Object.keys(loading).forEach((key) => { loading[key] = false; });
    errorMessage.value = "";
    isEmpty.value = false;
    notFound.value = false;
  }

  Vue.onBeforeUnmount(() => clear());

  return {
    PAGE_SIZE,
    clear,
    errorMessage,
    isEmpty,
    isLoading,
    lookupSite,
    notFound,
    searchAutocompleteSites,
    searchTerminatedSites,
  };
}
