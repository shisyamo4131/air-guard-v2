<script setup>
/**
 * @file components/organisms/SiteOperationScheduleDuplicator.vue
 * @description A component for duplicating site operation schedules.
 */
import draggable from "vuedraggable";

/***************************************************************************
 * DEFINE OPTIONS
 ***************************************************************************/
defineOptions({ inheritAttrs: false });

/***************************************************************************
 * DEFINE PROPS & EMITS
 ***************************************************************************/
const siteOrder = defineModel({ type: Array, default: () => [] });
const props = defineProps({
  loading: { type: Boolean, default: false },
});
</script>

<template>
  <MoleculesCardsSubmitCancel :loading="loading" title="現場並び替え">
    <draggable v-model="siteOrder" item-key="key" :disabled="loading">
      <template #item="props">
        <div>
          <slot name="item" v-bind="props">
            <v-list-item border class="pa-2 mb-2" rounded>
              <v-list-item-title>
                <AtomsChipsShiftType
                  class="mr-2"
                  :shift-type="props.element.shiftType"
                />
                <slot name="title" v-bind="props">
                  <span>{{ props.element.siteName }}</span>
                </slot>
              </v-list-item-title>
            </v-list-item>
          </slot>
        </div>
      </template>
    </draggable>
  </MoleculesCardsSubmitCancel>
</template>
