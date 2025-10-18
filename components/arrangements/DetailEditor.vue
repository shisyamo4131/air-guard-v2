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
  <v-dialog v-model="dialog" max-width="360" :fullscreen="mobile" scrollable>
    <MoleculesCardsSubmitCancel
      title="配置詳細編集"
      @click:cancel="emit('click:cancel')"
      @click:submit="emit('click:submit')"
    >
      <v-row>
        <v-col cols="12">
          <air-date-input v-model="worker.dateAt" label="勤務日" readonly />
        </v-col>
        <v-col cols="12">
          <air-time-picker-input
            v-model="worker.startTime"
            label="開始時刻"
            required
          />
        </v-col>
        <v-col cols="12">
          <v-card border flat>
            <v-card-text class="pt-0">
              <v-checkbox
                class="mr-4"
                v-model="worker.isStartNextDay"
                label="翌日開始"
                hide-details
              />
              <div class="text-caption text-medium-emphasis">
                <div>
                  実際の勤務開始日時が勤務日の翌日になる場合はチェックを入れます。
                </div>
                例）勤務日が5月1日、実際の勤務開始日時が5月2日 02:00 の場合
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12">
          <air-time-picker-input
            v-model="worker.endTime"
            label="終了時刻"
            required
          />
        </v-col>
        <v-col cols="12">
          <air-number-input
            v-model="worker.breakMinutes"
            label="休憩時間(分)"
            control-variant="split"
            suffix="分"
            required
          />
        </v-col>
        <v-col cols="12">
          <div class="d-flex">
            <v-checkbox
              class="mr-4"
              v-model="worker.isQualificated"
              label="資格者"
              hide-details
            />
            <v-checkbox v-model="worker.isOjt" label="OJT" hide-details />
          </div>
        </v-col>
      </v-row>
    </MoleculesCardsSubmitCancel>
  </v-dialog>
</template>
