<script setup>
/**
 * @file @/components/organisms/SiteOperationScheduleManager.vue
 * @description A component that manages the site operation schedule.
 */
import dayjs from "dayjs";
import { useSiteOperationSchedulesManager } from "@/composables/useSiteOperationSchedulesManager";
import { useAuthStore } from "@/stores/useAuthStore";

/** define-options */
defineOptions({ name: "SiteOperationScheduleManager" });

/** define-props */
const props = defineProps({
  siteId: { type: String, required: true },
});

const { company } = useAuthStore();

const { cachedData, arrayManagerAttrs, calendarAttrs } =
  useSiteOperationSchedulesManager({
    manager: useTemplateRef("manager"),
    siteId: props.siteId,
    from: dayjs().startOf("month").toDate(),
    to: dayjs().endOf("month").toDate(),
  });
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
          <air-calendar v-bind="calendarAttrs" />
        </v-container>
      </v-card>
    </slot>
  </ArrayManager>
</template>
