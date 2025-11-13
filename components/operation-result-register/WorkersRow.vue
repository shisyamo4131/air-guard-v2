<script setup>
/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const props = defineProps({
  agreement: { type: Object, default: null },
  notifications: { type: Object, default: () => ({}) },
  workers: { type: Array, default: () => [] },
});

const emit = defineEmits(["click:notification", "click:notify"]);

/*****************************************************************************
 * DEFINE(INJECT) COMPOSABLES
 *****************************************************************************/
</script>

<template>
  <tr>
    <td>作業員</td>
    <td>
      <v-table>
        <tbody>
          <OperationResultRegisterWorkerRow
            v-for="worker in workers"
            :key="worker.id"
            :agreement="agreement"
            :worker="worker"
            :notification="notifications[worker.notificationKey]"
            @click="emit('click:notification', $event)"
            @click:notify="emit('click:notify')"
          />
        </tbody>
      </v-table>
    </td>
  </tr>
</template>
