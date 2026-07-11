<script setup>
/*****************************************************************************
 * @file ./components/Draggable/SiteShiftTypeOrder/index.vue
 * @description 現場勤務区分オーダー Draggable コンポーネント
 *****************************************************************************/
import { useDefaults } from "vuetify";
import draggable from "vuedraggable";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "DraggableSiteShiftTypeOrder", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  itemKey: { type: String, default: "key" },
});
const props = useDefaults(_props, "DraggableSiteShiftTypeOrder");
</script>

<template>
  <draggable v-bind="$attrs" :item-key="props.itemKey">
    <template #item="slotProps">
      <div>
        <slot name="item" v-bind="slotProps || {}">
          <SiteShiftTypeOrderListItem
            v-bind="slotProps.element"
            class="pa-2 mb-2"
            border
            rounded
          />
        </slot>
      </div>
    </template>
  </draggable>
</template>
