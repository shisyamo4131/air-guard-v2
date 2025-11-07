<script setup>
/**
 * @file components/molecules/AgreementsManager.vue
 * @description A component to manage agreements based on `AirArrayManager`.
 * - Provides a UI for selecting existing agreements.
 * - User can also select a agreement from AuthStore's company agreements.
 *
 * @prop {Object} tableProps - Custom properties for the table display.
 * Note: Any additional props are passed to air-array-manager.
 *
 * @emits update:model-value - Emitted when the agreements list is updated.
 * Note: All other events from air-array-manager are re-emitted.
 * Note: Use `submit:complete` event to handle after create/update/delete operations.
 */
import { Agreement } from "@/schemas";
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useAuthStore } from "@/stores/useAuthStore";

const DEFAULT_TABLE_PROPS = {
  hideDefaultFooter: true,
  hideSearch: true,
  itemsPerPage: -1,
  sortBy: [{ key: "dateAt", order: "desc" }],
};

/*****************************************************************************
 *  PROPS
 *****************************************************************************/
const agreements = defineModel({ type: Array, default: () => [] });
const props = defineProps({
  tableProps: { type: Object, default: () => ({}) },
  useDefault: { type: Boolean, default: false },
});

/*****************************************************************************
 * STORES & COMPOSABLES
 *****************************************************************************/
const logger = useLogger("AgreementsManager", useErrorsStore());
const { company } = useAuthStore();

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const selectableAgreements = computed(() => {
  const modelAgreements = agreements.value || [];
  const defaultAgreements = props.useDefault ? company?.agreements || [] : [];
  return [...modelAgreements, ...defaultAgreements];
});

const tableProps = computed(() => {
  return { ...DEFAULT_TABLE_PROPS, ...props.tableProps };
});
</script>

<template>
  <air-array-manager
    v-model="agreements"
    :schema="Agreement"
    item-key="key"
    :table-props="tableProps"
    :error-messages="{
      duplicateKey: '既に登録されている取極めです。',
    }"
    @error="(error) => logger.error({ error })"
    @error:clear="logger.clearError()"
  >
    <template #after-dateAt="{ field, item, updateProperties }">
      <v-col v-bind="field.colsDefinition">
        <MoleculesAgreementSelector
          :items="selectableAgreements"
          @select="
            $event.dateAt = item.dateAt;
            updateProperties({ ...$event });
          "
        >
          <template #activator="{ props: activatorProps }">
            <v-btn v-bind="activatorProps" block color="primary"
              >取極めから複製</v-btn
            >
          </template>
        </MoleculesAgreementSelector>
      </v-col>
    </template>
    <template #input.isStartNextDay="{ attrs }">
      <MoleculesInputsIsStartNextDay v-bind="attrs" />
    </template>
    <template v-for="(_, slotName) in $slots" #[slotName]="scope">
      <slot :name="slotName" v-bind="scope ?? {}" />
    </template>
  </air-array-manager>
</template>
