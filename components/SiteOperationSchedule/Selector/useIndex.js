import dayjs from "dayjs";
import * as Vue from "vue";
import { useFetchSite } from "@/composables/fetch/useFetchSite";

export function useIndex(props, emit) {
  /** SETUP COMPOSABLES */
  const { cachedSites, fetchSite } =
    props.fetchSiteComposable || useFetchSite();

  /** Watch `props.siteId` to fetch site data */
  Vue.watch(
    () => props.siteId,
    (newSiteId) => fetchSite(newSiteId),
    { immediate: true },
  );

  /** title */
  const title = Vue.computed(() => {
    return cachedSites.value[props.siteId]?.name || props.siteId;
  });

  /** subtitle */
  const subtitle = Vue.computed(() => {
    return dayjs(props.dateAt).format("YYYY年MM月DD日(ddd)");
  });

  /**
   * Emit `click:create` event with data for initializing new site operation schedule.
   * @returns {void}
   */
  const handleClickCreate = () => {
    emit("click:create", {
      siteId: props.siteId,
      shiftType: props.shiftType,
      dateAt: props.dateAt,
    });
  };

  /**
   * Emit `click:edit` event with schedule instance.
   * @param {Object} schedule
   */
  const handleClickEdit = (schedule) => {
    emit("click:edit", schedule);
  };

  return { title, subtitle, handleClickCreate, handleClickEdit };
}
