<script setup>
import { useDisplay } from "vuetify";

/*****************************************************************************
 * DEFINE COMPOSABLES
 *****************************************************************************/
const { worker } = inject("detailEditorComposable");
const { mobile } = useDisplay();

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const dialog = defineModel({ type: Boolean, default: false });
const emit = defineEmits(["click:cancel", "click:submit"]);
</script>

<template>
  <v-dialog v-model="dialog" max-width="480" :fullscreen="mobile" scrollable>
    <MoleculesCardsSubmitCancel
      title="勤務詳細編集"
      @click:cancel="emit('click:cancel')"
      @click:submit="emit('click:submit')"
    >
      <v-row>
        <v-col cols="12" sm="6">
          <air-time-picker-input
            v-model="worker.startTime"
            label="開始時刻"
            required
          />
        </v-col>
        <v-col cols="12" sm="6">
          <air-time-picker-input
            v-model="worker.endTime"
            label="終了時刻"
            required
          />
        </v-col>
      </v-row>
    </MoleculesCardsSubmitCancel>
  </v-dialog>
</template>
