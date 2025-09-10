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
const docs = ref([]);

/*****************************************************************************
 * LIFECYCLE HOOKS
 *****************************************************************************/
onMounted(() => {
  docs.value = model.subscribeDocs();
});

onUnmounted(() => {
  model.unsubscribe();
});
</script>

<template>
  <air-array-manager
    v-model="docs"
    :schema="Site"
    :input-props="{
      excludedKeys: ['agreements'],
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
