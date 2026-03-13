<script setup>
/*****************************************************************************
 * @file ./components/ShiftType/Group.vue
 * @description 勤務区分ラジオボタンコンポーネント
 * @author shisyamo4131
 *
 * @prop {boolean} useAll - `全て`の勤務区分を表示するかどうか（既定値: false）
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useConstants } from "@/composables/useConstants";

defineOptions({ name: "ShiftTypeRadioGroup" });

/*****************************************************************************
 * DEFINE MODEL-VALUE
 *****************************************************************************/
const modelValue = defineModel();

/*****************************************************************************
 * SETUP PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  useAll: { type: Boolean, default: false },
});
const props = useDefaults(_props, "ShiftTypeRadioGroup");

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { SHIFT_TYPE } = useConstants(); // 勤務区分の定数とユーティリティ
</script>

<template>
  <v-radio-group v-model="modelValue">
    <v-radio
      v-for="shiftType of SHIFT_TYPE"
      :key="shiftType.value"
      :color="shiftType.color"
      :label="shiftType.title"
      :value="shiftType.value"
    />
    <v-radio v-if="props.useAll" value="ALL" label="全て" />
  </v-radio-group>
</template>
