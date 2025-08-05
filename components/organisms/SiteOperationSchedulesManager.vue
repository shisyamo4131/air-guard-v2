<script setup>
/**
 * @file @/components/organisms/SiteOperationScheduleManager.vue
 * @description A component that manages the site operation schedule.
 */
import dayjs from "dayjs";
import { useSiteOperationScheduleManager } from "@/composables/useSiteOperationScheduleManager";
import { useAuthStore } from "@/stores/useAuthStore";

/** define-options */
defineOptions({ name: "SiteOperationScheduleManager" });

/** define-props */
const props = defineProps({
  siteId: { type: String, required: true },
});

/** A date for the current month */
const currentDate = ref([new Date()]);

/** Period of the current month calculated from currentDate */
const period = computed(() => {
  const from = dayjs(currentDate.value[0]).startOf("month").toDate();
  const to = dayjs(currentDate.value[0]).endOf("month").toDate();
  return { from, to };
});

const { company } = useAuthStore();

const manager = useTemplateRef("manager");
const { cachedData, arrayManagerAttrs, setDateRange } =
  useSiteOperationScheduleManager({
    manager,
    siteId: props.siteId,
    from: period.value.from,
    to: period.value.to,
  });

/***************************************************************************
 * WATCHERS
 ***************************************************************************/
watch(period, async (newVal) => setDateRange(newVal), { deep: true });
</script>

<template>
  <ArrayManager
    ref="manager"
    v-slot="slotProps"
    v-bind="arrayManagerAttrs"
    :dialog-props="{ maxWidth: 600 }"
    :input-props="{
      excludedKeys: ['status', 'employees', 'outsourcers'],
    }"
  >
    <v-dialog v-bind="slotProps.dialogProps">
      <MoleculesSiteOperationScheduleEditor
        v-bind="slotProps.editorProps"
        :agreements="
          cachedData.sites[props.siteId]?.agreements || company.agreements
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
            :events="slotProps.items.map((schedule) => schedule.toEvent())"
            hide-week-number
            @click:event="slotProps.toUpdate($event.item)"
          />
        </v-container>
      </v-card>
    </slot>
  </ArrayManager>
</template>
