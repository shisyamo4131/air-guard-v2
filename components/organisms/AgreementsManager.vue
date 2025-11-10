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
    <template #after-dateAt="{ field, item, updateProperties }">
      <v-col v-bind="field.colsDefinition">
        <MoleculesAgreementSelector
          :items="selectableItems"
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
