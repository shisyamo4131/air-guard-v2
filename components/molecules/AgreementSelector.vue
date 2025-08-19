<script setup>
/**
 * @file @/components/molecules/AgreementSelector.vue
 * @description A component that allows users to select an agreement (取極め).
 * It displays a dialog with a list of agreements and emits the selected agreement details.
 */
import dayjs from "dayjs";
import { DAY_TYPE, SHIFT_TYPE } from "air-guard-v2-schemas/constants";

/** define props */
const props = defineProps({
  btnProps: { type: Object, default: () => ({}) },
  /**
   * 取極め（Agreement）の配列
   */
  items: { type: Array, default: () => [] },
  /**
   * ボタン、カードのラベル
   */
  label: { type: String, default: "取極めを選択" },
});

/** define emits */
const emit = defineEmits(["select"]);

const dialog = ref(false);

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const items = computed(() => {
  return props.items.map((agreement) => {
    return {
      title: `${DAY_TYPE[agreement.dayType]}${
        SHIFT_TYPE[agreement.shiftType].title
      } ${agreement.startTime} - ${agreement.endTime}`,
      value: agreement,
      props: {
        subtitle: dayjs(agreement.dateAt).format("YYYY-MM-DD"),
      },
    };
  });
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function handleSelect(agreement) {
  emit("select", agreement.clone());
  dialog.value = false;
}
</script>

<template>
  <v-dialog v-model="dialog" max-width="480" scrollable>
    <template #activator="slotProps">
      <slot name="activator" v-bind="slotProps">
        <v-btn v-bind="{ ...slotProps.props, ...props.btnProps }">{{
          label
        }}</v-btn>
      </slot>
    </template>
    <template #default="{ isActive }">
      <v-card>
        <v-toolbar>
          <v-toolbar-title>{{ label }}</v-toolbar-title>
          <v-spacer />
          <v-btn icon="mdi-close" @click="isActive.value = false" />
        </v-toolbar>
        <v-card-text>
          <v-data-iterator
            :items="items"
            :item-value="(item) => item.agreement"
          >
            <template v-slot:default="{ items }">
              <v-row>
                <v-col v-for="(item, index) in items" :key="index" cols="12">
                  <v-card hover>
                    <v-list-item
                      :value="item.raw.value"
                      lines="two"
                      :title="item.raw.title"
                      :subtitle="item.raw.props.subtitle"
                      @click="handleSelect(item.raw.value)"
                    >
                    </v-list-item>
                  </v-card>
                </v-col>
              </v-row>
            </template>
          </v-data-iterator>
        </v-card-text>
      </v-card>
    </template>
  </v-dialog>
</template>
