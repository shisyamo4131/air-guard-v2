<script setup>
import { ref, computed } from "vue";
import { Insurance } from "@/schemas";
import { INSURANCE_STATUS_VALUES as STATUS } from "@shisyamo4131/air-guard-v2-schemas/constants";
import InsuranceTransition from "@/components/Insurance/Transition/Manager.vue";

/*****************************************************************************
 * DATA
 *****************************************************************************/
const model = ref(new Insurance());
const showHistory = ref(false);
const message = ref("");

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const statusInfo = computed(() => {
  return {
    status: model.value.status,
    statusTitle:
      Object.values(STATUS).find((s) => s.value === model.value.status)
        ?.title || "不明",
    previousStatus: model.value.previousStatus,
    enrollmentDateAt: model.value.enrollmentDateAt,
    number: model.value.number,
    lossDateAt: model.value.lossDateAt,
    lossReason: model.value.lossReason,
    isProcessing: model.value.isProcessing,
    isNotEnrolled: model.value.isNotEnrolled(),
    isEnrolled: model.value.isEnrolled(),
    isExempt: model.value.isExempt(),
    isProcessingEnrollment: model.value.isProcessingEnrollment(),
    isEnrollmentComplete: model.value.isEnrollmentComplete(),
    historyCount: model.value.history.length,
  };
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function handleSubmit(updatedInsurance) {
  console.log("Insurance submitted:", updatedInsurance);
  message.value = `状態遷移が完了しました: ${statusInfo.value.statusTitle}`;

  // メッセージを3秒後にクリア
  setTimeout(() => {
    message.value = "";
  }, 3000);
}

function resetInsurance() {
  model.value = new Insurance();
  message.value = "Insuranceインスタンスをリセットしました";
  setTimeout(() => {
    message.value = "";
  }, 3000);
}
</script>

<template>
  <v-container fluid>
    <v-row>
      <!-- メッセージ表示 -->
      <v-col v-if="message" cols="12">
        <v-alert type="success" closable @click:close="message = ''">
          {{ message }}
        </v-alert>
      </v-col>

      <!-- 操作パネル -->
      <v-col cols="12" md="4">
        <v-card>
          <v-card-title class="d-flex align-center">
            <span>操作</span>
            <v-spacer />
            <v-btn
              icon="mdi-refresh"
              size="small"
              variant="text"
              @click="resetInsurance"
            />
          </v-card-title>
          <v-card-text>
            <div class="d-flex align-center justify-center">
              <InsuranceTransition v-model="model" @submit="handleSubmit" />
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- 現在の状態表示 -->
      <v-col cols="12" md="8">
        <v-card>
          <v-card-title>現在の状態</v-card-title>
          <v-card-text>
            <v-row dense>
              <v-col cols="12" sm="6">
                <v-list density="compact">
                  <v-list-item>
                    <v-list-item-title>状態</v-list-item-title>
                    <v-list-item-subtitle>
                      <v-chip
                        :color="statusInfo.isEnrolled ? 'success' : 'default'"
                        size="small"
                      >
                        {{ statusInfo.statusTitle }}
                      </v-chip>
                    </v-list-item-subtitle>
                  </v-list-item>
                  <v-list-item>
                    <v-list-item-title>前の状態</v-list-item-title>
                    <v-list-item-subtitle>
                      {{ statusInfo.previousStatus || "なし" }}
                    </v-list-item-subtitle>
                  </v-list-item>
                  <v-list-item>
                    <v-list-item-title>資格取得日</v-list-item-title>
                    <v-list-item-subtitle>
                      {{
                        statusInfo.enrollmentDateAt?.toLocaleDateString() ||
                        "なし"
                      }}
                    </v-list-item-subtitle>
                  </v-list-item>
                  <v-list-item>
                    <v-list-item-title>被保険者番号</v-list-item-title>
                    <v-list-item-subtitle>
                      {{ statusInfo.number || "なし" }}
                    </v-list-item-subtitle>
                  </v-list-item>
                </v-list>
              </v-col>
              <v-col cols="12" sm="6">
                <v-list density="compact">
                  <v-list-item>
                    <v-list-item-title>喪失日</v-list-item-title>
                    <v-list-item-subtitle>
                      {{
                        statusInfo.lossDateAt?.toLocaleDateString() || "なし"
                      }}
                    </v-list-item-subtitle>
                  </v-list-item>
                  <v-list-item>
                    <v-list-item-title>喪失理由</v-list-item-title>
                    <v-list-item-subtitle>
                      {{ statusInfo.lossReason || "なし" }}
                    </v-list-item-subtitle>
                  </v-list-item>
                  <v-list-item>
                    <v-list-item-title>手続き中</v-list-item-title>
                    <v-list-item-subtitle>
                      <v-icon
                        :color="statusInfo.isProcessing ? 'warning' : 'default'"
                      >
                        {{
                          statusInfo.isProcessing ? "mdi-check" : "mdi-close"
                        }}
                      </v-icon>
                      {{ statusInfo.isProcessing ? "はい" : "いいえ" }}
                    </v-list-item-subtitle>
                  </v-list-item>
                  <v-list-item>
                    <v-list-item-title>履歴件数</v-list-item-title>
                    <v-list-item-subtitle>
                      {{ statusInfo.historyCount }}件
                      <v-btn
                        v-if="statusInfo.historyCount > 0"
                        size="x-small"
                        variant="text"
                        @click="showHistory = true"
                      >
                        表示
                      </v-btn>
                    </v-list-item-subtitle>
                  </v-list-item>
                </v-list>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- 状態フラグ表示 -->
      <v-col cols="12">
        <v-card>
          <v-card-title>状態チェック</v-card-title>
          <v-card-text>
            <v-chip-group>
              <v-chip :color="statusInfo.isNotEnrolled ? 'primary' : 'default'">
                未加入: {{ statusInfo.isNotEnrolled }}
              </v-chip>
              <v-chip :color="statusInfo.isEnrolled ? 'success' : 'default'">
                加入: {{ statusInfo.isEnrolled }}
              </v-chip>
              <v-chip :color="statusInfo.isExempt ? 'warning' : 'default'">
                適用除外: {{ statusInfo.isExempt }}
              </v-chip>
              <v-chip
                :color="statusInfo.isProcessingEnrollment ? 'info' : 'default'"
              >
                加入手続き中: {{ statusInfo.isProcessingEnrollment }}
              </v-chip>
              <v-chip
                :color="statusInfo.isEnrollmentComplete ? 'success' : 'default'"
              >
                加入完了: {{ statusInfo.isEnrollmentComplete }}
              </v-chip>
            </v-chip-group>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- デバッグ情報 -->
      <v-col cols="12">
        <v-card>
          <v-card-title>デバッグ情報（JSON）</v-card-title>
          <v-card-text>
            <pre style="overflow-x: auto; font-size: 12px">{{
              JSON.stringify(model, null, 2)
            }}</pre>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 履歴ダイアログ -->
    <v-dialog v-model="showHistory" max-width="800">
      <v-card>
        <v-card-title>
          履歴
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" @click="showHistory = false" />
        </v-card-title>
        <v-card-text>
          <v-expansion-panels v-if="model.history.length > 0">
            <v-expansion-panel
              v-for="(entry, index) in model.history"
              :key="index"
            >
              <v-expansion-panel-title>
                履歴 {{ index + 1 }}
                <template #actions>
                  <v-icon>mdi-chevron-down</v-icon>
                </template>
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                <pre style="font-size: 12px">{{
                  JSON.stringify(entry, null, 2)
                }}</pre>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
          <v-alert v-else type="info">履歴はありません</v-alert>
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-container>
</template>
