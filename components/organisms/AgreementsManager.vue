<script setup>
/**
 * @file components/organisms/AgreementsManager.vue
 * @description A component to manage agreements based on `AirArrayManager`.
 * - Provides a UI for selecting existing agreements.
 *
 * @prop {Array} selectableItems - List of agreements that can be selected.
 * Note: Any additional props are passed to air-array-manager.
 */

defineOptions({ inheritAttrs: false });

/*****************************************************************************
 *  PROPS
 *****************************************************************************/
const props = defineProps({
  selectableItems: { type: Array, default: () => [] },
});
</script>

<template>
  <air-array-manager v-bind="$attrs">
    <template #after-shiftType="{ field, updateProperties }">
      <v-col v-bind="field.colsDefinition">
        <MoleculesCardsSelectCancel
          title="取極めから複製"
          subtitle="既存の取極めから請求情報を複製します。"
          max-width="720"
          @update:modelValue="
            ($event) => {
              updateProperties({ ...$event.billingInfo });
            }
          "
        >
          <template #activator="{ props: activatorProps }">
            <v-btn v-bind="activatorProps" block color="primary">
              取極めから複製
            </v-btn>
          </template>
          <template #default="defaultProps">
            <MoleculesAgreementGroup
              v-bind="defaultProps"
              :items="selectableItems"
            />
          </template>
        </MoleculesCardsSelectCancel>
      </v-col>
    </template>
    <template #[`input.isStartNextDay`]="{ attrs }">
      <MoleculesInputsIsStartNextDay v-bind="attrs" />
    </template>
    <template v-for="(_, slotName) in $slots" #[slotName]="scope">
      <slot :name="slotName" v-bind="scope ?? {}" />
    </template>
  </air-array-manager>
</template>
