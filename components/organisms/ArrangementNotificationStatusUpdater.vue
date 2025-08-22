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
  <v-menu>
    <v-card>
      <v-container>
        <v-chip-group>
          <v-chip
            v-for="item of items"
            :key="item.value"
            :value="item.value"
            :disabled="item.disabled"
            label
            @click="emit('click', item.value)"
          >
            {{ item.title }}
          </v-chip>
        </v-chip-group>
      </v-container>
    </v-card>
  </v-menu>
</template>
