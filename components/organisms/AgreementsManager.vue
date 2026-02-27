<script setup>
import { useItemSelect } from "@/composables/useItemSelect";

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

const manager = ref(null);

const {
  dialog,
  items,
  loading,
  error,
  open,
  handleSubmit,
  handleCancel,
  isSelected,
  select,
  dialogProps,
} = useItemSelect({
  items: ref(props.selectableItems),
  onSubmit: (item) => {
    // Handle the selected item (e.g., update properties in the parent component)
    if (manager.value && manager.value.updateProperties) {
      console.log("OK");
      manager.value.updateProperties({ ...item.billingInfo });
    }
  },
});
</script>

<template>
  <air-array-manager ref="manager" v-bind="$attrs">
    <template #after-shiftType="{ field, updateProperties }">
      <v-col v-bind="field.colsDefinition">
        <!-- <v-dialog v-bind="dialogProps" max-width="720">
          <template #activator="{ props: activatorProps }">
            <v-btn v-bind="activatorProps" block color="primary">
              取極め参照
            </v-btn>
          </template>
          <v-card>
            <template #title>取極め参照</template>
            <template #subtitle>既存の取極め情報を参照します。</template>
            <template #text>
              <v-list>
                <v-list-item
                  v-for="item in items"
                  :key="item.key"
                  :active="isSelected(item)"
                  @click="select(item)"
                >
                  {{ item.date }}
                </v-list-item>
              </v-list>
            </template>
            <template #actions>
              <MoleculesActionsSubmitCancel
                @click:cancel="handleCancel"
                @click:submit="handleSubmit"
              />
            </template>
          </v-card>
        </v-dialog> -->
        <MoleculesCardsSelectCancel
          title="取極めを参照"
          subtitle="既存の取極めから単価情報を参照設定します。"
          max-width="480"
          @update:modelValue="
            ($event) => {
              updateProperties({ ...$event.billingInfo });
            }
          "
        >
          <template #activator="{ props: activatorProps }">
            <v-btn v-bind="activatorProps" block color="primary">
              取極めから参照設定
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
