<script setup>
/**
 * @file @/components/organisms/SiteOperationScheduleManager.vue
 * @description A component that manages the site operation schedule.
 */
import dayjs from "dayjs";
import { SiteOperationSchedule } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import { useSiteOperationSchedulesManager } from "@/composables/useSiteOperationSchedulesManager";

/** define-options */
defineOptions({ name: "SiteOperationScheduleManager" });

/** define-props */
const props = defineProps({
  siteId: { type: String, required: true },
});

/** define refs */
const instance = reactive(new SiteOperationSchedule());
const currentDate = ref([dayjs().startOf("month").toDate()]);

/** define composables */
const { company } = useAuthStore();
const fetchSiteComposable = useFetchSite();
const { cachedSites } = fetchSiteComposable;
const { docs, events } = useSiteOperationSchedulesManager({
  manager: useTemplateRef("manager"),
  docs: instance.docs,
  fetchSiteComposable,
});

/***************************************************************************
 * COMPUTED PROPERTIES
 ***************************************************************************/
const to = computed(() => {
  return dayjs(currentDate.value[0]).endOf("month").toDate();
});

watch(
  currentDate,
  (newVal) => {
    const from = newVal[0];
    instance.subscribeDocs({
      constraints: [
        ["where", "siteId", "==", props.siteId],
        ["where", "dateAt", ">=", from],
        ["where", "dateAt", "<=", to.value],
      ],
    });
  },
  { immediate: true }
);
</script>

<template>
  <ArrayManager
    ref="manager"
    v-slot="slotProps"
    :model-value="docs"
    :schema="SiteOperationSchedule"
    :before-edit="
      (editMode, item) => {
        item.siteId = siteId;
      }
    "
    :dialog-props="{ maxWidth: 600 }"
    :input-props="{
      excludedKeys: ['status', 'employees', 'outsourcers'],
    }"
  >
    <v-dialog v-bind="slotProps.dialogProps">
      <MoleculesSiteOperationScheduleEditor
        v-bind="slotProps.editorProps"
        :agreements="
          cachedSites[props.siteId]?.agreements || company.agreements
        "
      />
    </v-dialog>
    <slot name="default" v-bind="slotProps">
      <v-card>
        <v-toolbar density="comfortable">
          <v-toolbar-title>稼働予定</v-toolbar-title>
          <v-spacer />
          <v-btn icon="mdi-plus" @click="slotProps.toCreate()" />
        </v-toolbar>
        <v-container class="pt-0">
          <air-calendar
            v-model="currentDate"
            :events="events"
            @click:event="slotProps.toUpdate($event.item)"
          />
        </v-container>
      </v-card>
    </slot>
  </ArrayManager>
</template>
