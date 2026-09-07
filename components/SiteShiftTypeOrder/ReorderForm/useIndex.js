/*****************************************************************************
 * @file ./components/SiteShiftTypeOrder/ReorderForm/useIndex.js
 * @description SiteShiftTypeOrderReorderFormの独立draft・競合制御です。
 *****************************************************************************/
import * as Vue from "vue";
import { useFetch } from "@/composables/fetch/useFetch";
import { Site, SiteOrder } from "@/schemas";

function plainOrder(source = []) {
  return source.map(({ siteId, shiftType }) => ({ siteId, shiftType }));
}

function ordersEqual(left = [], right = []) {
  return (
    left.length === right.length &&
    left.every(
      (item, index) =>
        item.siteId === right[index]?.siteId &&
        item.shiftType === right[index]?.shiftType,
    )
  );
}

export function useIndex(props, emit) {
  const { fetchSiteComposable } = useFetch(
    "SiteShiftTypeOrderReorderForm",
  );
  const { pushSite } = fetchSiteComposable;

  const internalItems = Vue.ref([]);
  const baseline = Vue.ref([]);
  const hasExternalChanges = Vue.ref(false);
  const isResolving = Vue.ref(false);
  const resolutionError = Vue.ref("");
  const pendingOwnSnapshot = Vue.ref(null);
  const localSubmitting = Vue.ref(false);
  const initialized = Vue.ref(false);
  let syncVersion = 0;

  const isChanged = Vue.computed(() =>
    !ordersEqual(plainOrder(internalItems.value), baseline.value),
  );

  const controlsDisabled = Vue.computed(
    () =>
      props.disabled ||
      props.loading ||
      localSubmitting.value ||
      isResolving.value ||
      !!resolutionError.value,
  );
  const isBusy = Vue.computed(
    () => props.loading || localSubmitting.value || isResolving.value,
  );

  async function resolveAvailableOrder(source) {
    const order = plainOrder(source);
    const siteIds = [...new Set(order.map(({ siteId }) => siteId))];
    const siteExists = new Map();

    for (let offset = 0; offset < siteIds.length; offset += 20) {
      const chunk = siteIds.slice(offset, offset + 20);
      await Promise.all(
        chunk.map(async (siteId) => {
          const site = await new Site().fetchDoc({ docId: siteId });
          siteExists.set(siteId, !!site);
          if (site) pushSite(site);
        }),
      );
    }

    return order
      .filter(({ siteId }) => siteExists.get(siteId) === true)
      .map((item) => new SiteOrder(item));
  }

  function replaceDraft(order, sourceOrder = order) {
    const snapshot = plainOrder(order);
    internalItems.value = snapshot.map((item) => new SiteOrder(item));
    baseline.value = plainOrder(sourceOrder);
    hasExternalChanges.value = false;
    initialized.value = true;
  }

  async function syncFromSource(source, { force = false } = {}) {
    const version = ++syncVersion;
    isResolving.value = true;
    resolutionError.value = "";
    try {
      const sourceSnapshot = plainOrder(source);
      const availableOrder = await resolveAvailableOrder(source);
      if (version !== syncVersion) return;
      const snapshot = plainOrder(availableOrder);

      if (
        pendingOwnSnapshot.value &&
        ordersEqual(snapshot, pendingOwnSnapshot.value)
      ) {
        baseline.value = snapshot;
        pendingOwnSnapshot.value = null;
        hasExternalChanges.value = false;
        return;
      }

      if (force || !initialized.value || !isChanged.value) {
        replaceDraft(availableOrder, sourceSnapshot);
        return;
      }

      if (!ordersEqual(sourceSnapshot, baseline.value)) {
        hasExternalChanges.value = true;
      }
    } catch {
      if (version !== syncVersion) return;
      resolutionError.value =
        "現場情報を確認できませんでした。通信状態を確認して、最新値を読み直してください。";
    } finally {
      if (version === syncVersion) isResolving.value = false;
    }
  }

  async function init() {
    if (props.loading || localSubmitting.value) return;
    pendingOwnSnapshot.value = null;
    await syncFromSource(props.siteShiftTypeOrder, { force: true });
  }

  async function submit() {
    if (
      controlsDisabled.value ||
      hasExternalChanges.value ||
      !isChanged.value
    ) {
      return;
    }
    localSubmitting.value = true;
    pendingOwnSnapshot.value = plainOrder(internalItems.value);
    emit("submit", pendingOwnSnapshot.value);
    await Vue.nextTick();
    if (!props.loading) localSubmitting.value = false;
  }

  function cancel() {
    if (isBusy.value) return;
    internalItems.value = baseline.value.map((item) => new SiteOrder(item));
    emit("cancel");
  }

  Vue.watch(
    () => props.siteShiftTypeOrder,
    (newOrder) => syncFromSource(newOrder),
    { immediate: true, deep: true },
  );

  Vue.watch(
    () => props.loading,
    (loading) => {
      if (!loading) localSubmitting.value = false;
    },
  );

  Vue.watch(
    () => props.saveFailed,
    (failed) => {
      if (!failed) return;
      pendingOwnSnapshot.value = null;
      localSubmitting.value = false;
      syncFromSource(props.siteShiftTypeOrder);
    },
  );

  return {
    cancel,
    controlsDisabled,
    hasExternalChanges,
    init,
    isChanged,
    isBusy,
    isResolving,
    items: internalItems,
    reloadLatest: init,
    resolutionError,
    submit,
  };
}
