<script setup>
/*****************************************************************************
 * @file ./components/OperationResult/Duplicator/index.vue
 * @description 稼働実績複製コンポーネント
 *****************************************************************************/
import { useIndex } from "./useIndex";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "OperationResultDuplicator", inheritAttrs: false });

/*****************************************************************************
 * DEFINE EMITS
 *****************************************************************************/
const emit = defineEmits(["duplicated"]);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { ui, set } = useIndex(emit); // Facade

/*****************************************************************************
 * DEFINE EXPOSE
 *****************************************************************************/
defineExpose({ set });
</script>

<template>
  <v-dialog v-bind="ui.dialog">
    <template #activator>
      <slot name="activator" v-bind="{ set }" />
    </template>
    <template #default>
      <v-card :border="false">
        <v-toolbar density="compact" color="secondary" title="稼働実績複製" />
        <v-card-item>
          <v-card-subtitle>複製先の日付を選択してください。</v-card-subtitle>
        </v-card-item>
        <v-date-picker v-bind="ui.picker" />
        <v-card-actions>
          <MoleculesActionsSubmitCancel v-bind="ui.actions" />
        </v-card-actions>
      </v-card>
    </template>
  </v-dialog>
</template>
