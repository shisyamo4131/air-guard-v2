<script setup>
/**
 * @file components/molecules/AgreementsManager.vue
 * @description A component to manage agreements based on `AirArrayManager`.
 * - Provides a UI for selecting existing agreements.
 * - User can also select a agreement from `defaultAgreements` prop.
 * @props {Array} defaultAgreements - Default agreements to include.
 * @props {String} label - Label for the agreements section.
 * @props {Object} tableProps - Custom properties for the table display.
 * Note: Any additional props are passed to air-array-manager.
 *
 * @emits update:model-value - Emitted when the agreements list is updated.
 * Note: All other events from air-array-manager are re-emitted.
 * Note: Use `submit:complete` event to handle after create/update/delete operations.
 */
import { Agreement } from "@/schemas";
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";

const DEFAULT_TABLE_PROPS = {
  hideDefaultFooter: true,
  hideSearch: true,
  itemsPerPage: -1,
  sortBy: [{ key: "dateAt", order: "desc" }],
};

/*****************************************************************************
 * DEFINE COMPOSABLES
 *****************************************************************************/
const { error, clearError } = useLogger("AgreementsManager", useErrorsStore());

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const agreements = defineModel({ type: Array, default: () => [] });
const props = defineProps({
  defaultAgreements: { type: Array, default: () => [] },
  label: { type: String, default: "取極め" },
  tableProps: { type: Object, default: () => ({}) },
});

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const selectableAgreements = computed(() => {
  const modelAgreements = agreements.value || [];
  const defaultAgreements = props.defaultAgreements || [];
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
    :label="label"
    :table-props="tableProps"
    @error="error"
    @error:clear="clearError"
  >
    <template #after-dateAt="{ field }">
      <v-col v-bind="field.colsDefinition">
        <MoleculesAgreementSelector
          :items="selectableAgreements"
          @select="
            $event.dateAt = slotProps.item.dateAt;
            slotProps.updateProperties({ ...$event });
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
    <template v-for="(slotFn, slotName) in $slots" #[slotName]="scope">
      <slot :name="slotName" v-bind="scope ?? {}" />
    </template>
  </air-array-manager>
</template>
