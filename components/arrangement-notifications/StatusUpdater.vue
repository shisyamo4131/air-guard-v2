<script setup>
/**
 * @file components/notifications/StatusUpdater.vue
 * @description A menu component for updating arrangement notification statuses.
 */
import { useDisplay } from "vuetify";
import { ARRANGEMENT_NOTIFICATION_STATUS_FOR_SELECT } from "air-guard-v2-schemas/constants";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const props = defineProps({
  actualStartTime: { type: String },
  actualEndTime: { type: String },
  actualBreakMinutes: { type: Number },
  loading: { type: Boolean, default: false },
  status: { type: String },
});

const emit = defineEmits(["click:submit", "click:cancel"]);

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const internalActualStartTime = ref(null);
const internalActualEndTime = ref(null);
const internalActualBreakMinutes = ref(null);
const internalStatus = ref(null);

/*****************************************************************************
 * DEFINE COMPOSABLES
 *****************************************************************************/
const { mobile } = useDisplay();

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watchEffect(() => {
  internalActualStartTime.value = props.actualStartTime;
  internalActualEndTime.value = props.actualEndTime;
  internalActualBreakMinutes.value = props.actualBreakMinutes;
  internalStatus.value = props.status;
});

watch(internalStatus, () => {
  internalActualStartTime.value = props.actualStartTime;
  internalActualEndTime.value = props.actualEndTime;
  internalActualBreakMinutes.value = props.actualBreakMinutes;
});

const items = computed(() => {
  return ARRANGEMENT_NOTIFICATION_STATUS_FOR_SELECT;
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function handleClickSubmit() {
  emit("click:submit", {
    actualStartTime: internalActualStartTime.value,
    actualEndTime: internalActualEndTime.value,
    actualBreakMinutes: internalActualBreakMinutes.value,
    status: internalStatus.value,
  });
}
</script>

<template>
  <v-dialog :model-value="true" max-width="368" :fullscreen="mobile">
    <MoleculesCardsSubmitCancel
      :loading="loading"
      @click:submit="handleClickSubmit"
      @click:cancel="emit('click:cancel')"
    >
      <v-label class="text-caption mb-2" text="状態" />
      <v-input>
        <v-chip-group
          v-model="internalStatus"
          mandatory
          column
          :disabled="loading"
        >
          <v-chip
            v-for="item of items"
            :key="item.value"
            :value="item.value"
            :style="{ color: item.color }"
            :disabled="item.disabled"
            filter
            label
          >
            {{ item.title }}
          </v-chip>
        </v-chip-group>
      </v-input>
      <v-expand-transition>
        <v-row v-show="internalStatus === 'LEAVED'">
          <v-col cols="12" sm="6">
            <air-time-picker-input
              v-model="internalActualStartTime"
              label="上番時刻"
              required
              :picker-props="{ format: '24hr' }"
            />
          </v-col>
          <v-col cols="12" sm="6">
            <air-time-picker-input
              v-model="internalActualEndTime"
              label="下番時刻"
              required
              :picker-props="{ format: '24hr' }"
            />
          </v-col>
          <v-col cols="12">
            <air-number-input
              v-model="internalActualBreakMinutes"
              label="休憩時間"
              control-variant="split"
              suffix="分"
              required
            />
          </v-col>
        </v-row>
      </v-expand-transition>
    </MoleculesCardsSubmitCancel>
  </v-dialog>
</template>
