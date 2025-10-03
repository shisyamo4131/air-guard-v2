<script setup>
/**
 * @file components/organisms/SitesManager.vue
 * @description A component to manage sites.
 */
import { Site } from "@/schemas";
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";

/*****************************************************************************
 * DEFINE COMPOSABLES
 *****************************************************************************/
const { error, clearError } = useLogger("SitesManager", useErrorsStore());

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const model = reactive(new Site());
const search = ref("");
const loading = ref(false);

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(search, subscribeDocs, { immediate: true });

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function subscribeDocs() {
  try {
    loading.value = true;
    const statusOption = ["where", "status", "==", Site.STATUS_ACTIVE];
    const constraints = search.value ? search.value : [statusOption];
    const options = search.value ? [statusOption] : [];
    model.subscribeDocs({ constraints, options });
  } catch (error) {
    error({ error, message: "Failed to fetch sites." });
  } finally {
    loading.value = false;
  }
}

/*****************************************************************************
 * LIFECYCLE HOOKS
 *****************************************************************************/
onUnmounted(() => {
  model.unsubscribe();
});
</script>

<template>
  <air-array-manager
    v-model="model.docs"
    :schema="Site"
    v-model:search="search"
    :delay="300"
    :loading="loading"
    :input-props="{
      excludedKeys: ['agreements'],
    }"
    :table-props="{
      customFilter: () => true,
      sortBy: [{ key: 'code', order: 'desc' }],
    }"
    :before-edit="
      (editMode, item) => {
        if (editMode === 'CREATE') return true;
        $router.push(`sites/${item.docId}`);
        return false;
      }
    "
    :handle-create="(item) => item.create()"
    @create="($event) => $router.push(`sites/${$event.docId}`)"
    @error="error"
    @error:clear="clearError"
  >
  </air-array-manager>
</template>
