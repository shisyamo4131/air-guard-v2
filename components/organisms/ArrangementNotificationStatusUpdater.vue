<script setup>
/**
 * @file components/organisms/ArrangementNotificationStatusUpdater.vue
 * @description A menu component for updating arrangement notification statuses.
 */

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const props = defineProps({
  items: { type: Array, required: true },
});

const emit = defineEmits(["click"]);
</script>

<template>
  <v-dialog width="auto">
    <v-card>
      <v-container class="d-flex" style="gap: 8px">
        <v-chip
          v-for="item of items"
          :key="item.value"
          :value="item.value"
          :color="item.color"
          :disabled="item.disabled"
          label
          @click="emit('click', item.value)"
        >
          {{ item.title }}
        </v-chip>
      </v-container>
    </v-card>
  </v-dialog>
</template>
