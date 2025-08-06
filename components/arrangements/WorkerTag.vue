<script setup>
/**
 * @file WorkerTag.vue
 * @description Component for displaying an tag in arrangements.
 * The tag size is set to a height of 48px.
 *
 * @props {Number} amount - Number of arranged personnel.
 * @props {String} endTime - End time to display on the tag.
 * @props {Boolean} isEmployee - Indicates whether the tag represents an employee.
 * @props {Boolean} isNew - Indicates 'new' icon.
 * @props {String} startTime - Start time to display on the tag.
 * @props {String} status - Detail status of the arrangement.
 * @props {String} workerId - Worker ID.
 * @emits update:status - Event to update the status.
 * @emits remove - Event to remove from the arrangement.
 *
 * [NOTE]
 * `schedule` オブジェクトをプロパティで受け取ることで親コンポーネントも含めてコードの
 * 見通しが良くなるが、情報量の多いデータの受け渡しを行うと HTML タグ内に梱包される
 * データも多くなり、レスポンスが悪くなる可能性があるため、必要な情報のみの受け渡しを
 * 行うものとする。
 */
import { OperationResultDetail } from "@/schemas";
import {
  OPERATION_RESULT_DETAIL_STATUS,
  OPERATION_RESULT_DETAIL_STATUS_ARRAY,
  OPERATION_RESULT_DETAIL_STATUS_DRAFT,
} from "air-guard-v2-schemas/constants";

/** define props */
const props = defineProps({
  /** Indicates `new` icon. */
  isNew: { type: Boolean, default: false },
  modelValue: { type: Object, required: true },
});

/** define emits */
const emit = defineEmits(["update:status", "remove"]);

/** define refs */
const menu = ref(false);

const worker = ref(new OperationResultDetail());
watch(
  () => props.modelValue,
  (newVal) => worker.value.initialize(newVal),
  { immediate: true, deep: true }
);

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const selectableStatus = computed(() => {
  return OPERATION_RESULT_DETAIL_STATUS_ARRAY.filter(
    (s) => s.value !== OPERATION_RESULT_DETAIL_STATUS_DRAFT
  );
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * A handler for the remove button click event.
 * Emits the 'remove' event with the workerId and amount.
 * This is used to remove the worker from the arrangement.
 * `amount` is set to 1 cause the outsourcer's tag should be removed one by one.
 */
function onClickRemove() {
  const { workerId, isEmployee } = worker.value;
  emit("remove", { workerId, amount: 1, isEmployee });
}

/**
 * Updates the status of the arrangement.
 * @param newVal The new status to set.
 */
function updateStatus(newVal) {
  emit("update:status", newVal);
  menu.value = false;
}
</script>

<template>
  <MoleculesTagBase
    :removable="worker.isRemovable"
    @click:remove="onClickRemove"
  >
    <template #prepend-label>
      <!-- 'new' icon -->
      <v-icon v-if="props.isNew" color="red">mdi-new-box</v-icon>
    </template>
    <template #append-label>
      <span v-if="!worker.isEmployee">{{ `(${worker.amount})` }}</span>
    </template>
    <template #footer>
      <v-list-item-subtitle class="text-caption text-no-wrap">
        {{ `${worker.startTime} - ${worker.endTime}` }}
      </v-list-item-subtitle>
    </template>
    <template #prepend-action>
      <v-menu v-if="!worker.isDraft" v-model="menu">
        <template #activator="{ props: activatorProps }">
          <!-- status chip -->
          <v-chip v-bind="activatorProps" size="x-small" label>
            {{ OPERATION_RESULT_DETAIL_STATUS[worker.status] }}
          </v-chip>
        </template>
        <v-card>
          <v-container>
            <v-chip-group>
              <v-chip
                v-for="status of selectableStatus"
                :key="status.value"
                :value="status.value"
                :disabled="status.value === worker.status"
                label
                @click="updateStatus(status.value)"
              >
                {{ status.title }}
              </v-chip>
            </v-chip-group>
          </v-container>
        </v-card>
      </v-menu>
    </template>
  </MoleculesTagBase>
</template>

<style scoped></style>
