<script setup>
/**
 * @file @/components/organisms/AgreementSelector.vue
 * @description A component that allows users to select an agreement (取極め).
 * It displays a dialog with a list of agreements and emits the selected agreement details.
 */
import dayjs from "dayjs";
import { DAY_TYPE, SHIFT_TYPE } from "air-guard-v2-schemas/constants";

/** define props */
const props = defineProps({
  /**
   * `select` イベントで emit されるオブジェクトの `startAt` と `endAt` の基準となる日付
   * Date オブジェクトまたは日付形式の文字列を受け取ります。
   */
  date: { type: Object, default: undefined },
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
        SHIFT_TYPE[agreement.shiftType]
      } ${agreement.startTime} - ${agreement.endTime}`,
      value: agreement,
      props: {
        subtitle: dayjs(agreement.from).format("YYYY-MM-DD"),
      },
    };
  });
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function handleSelect(agreement) {
  const startAt = agreement.getStartAt(props.date);
  const endAt = agreement.getEndAt(props.date);
  emit("select", {
    agreement,
    startAt,
    endAt,
    ...agreement,
  });
  dialog.value = false;
}
</script>

<template>
  <v-dialog v-model="dialog" max-width="480" scrollable>
    <template #activator="{ props: activatorProps }">
      <v-btn v-bind="activatorProps">{{ label }}</v-btn>
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
