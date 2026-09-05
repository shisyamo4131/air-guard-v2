<script setup>
import { OperationResult } from "@/schemas";

/***************************************************************************
 * SETUP STORES & COMPOSABLES
 ***************************************************************************/
const { companyId } = useAuthStore();

/***************************************************************************
 * DEFINE REACTIVE OBJECTS
 ***************************************************************************/
const operationResult = reactive(new OperationResult());
const docId = ref("");
const loading = ref(false);
const message = ref("");
const messageType = ref("info");

/***************************************************************************
 * COMPUTED PROPERTIES
 ***************************************************************************/
const isSubscribed = computed(() => !!docId.value);

/***************************************************************************
 * METHODS
 ***************************************************************************/
async function subscribe() {
  if (!docId.value) {
    message.value = "ドキュメントIDを入力してください。";
    messageType.value = "error";
    return;
  }

  try {
    loading.value = true;
    message.value = "";
    await operationResult.fetch({ docId: docId.value });
    operationResult.subscribe({ docId: docId.value });
    message.value = "ドキュメントを取得しました。";
    messageType.value = "success";
  } catch (error) {
    message.value = `エラー: ${error.message}`;
    messageType.value = "error";
    console.error("Subscribe error:", error);
  } finally {
    loading.value = false;
  }
}

function unsubscribe() {
  operationResult.unsubscribe();
  operationResult.initialize();
  docId.value = "";
  message.value = "";
}

/***************************************************************************
 * LIFECYCLE HOOKS
 ***************************************************************************/
onUnmounted(() => {
  operationResult.unsubscribe();
});
</script>

<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title class="text-h5">
            OperationResult ロールバック
          </v-card-title>

          <v-card-subtitle class="mt-2">
            Company ID: {{ companyId }}
          </v-card-subtitle>

          <v-divider></v-divider>

          <v-card-text>
            <v-alert type="warning" variant="tonal" class="mb-4">
              SiteOperationScheduleの実績参照はクライアントから解除できません。この検証画面のロールバック操作は停止しています。
            </v-alert>
            <!-- ドキュメントID入力欄 -->
            <v-row>
              <v-col cols="12" md="8">
                <air-text-field
                  v-model="docId"
                  label="ドキュメントID"
                  placeholder="OperationResult / SiteOperationSchedule のドキュメントIDを入力"
                  :disabled="isSubscribed"
                  clearable
                />
              </v-col>
              <v-col cols="12" md="4" class="d-flex align-center">
                <v-btn
                  v-if="!isSubscribed"
                  color="primary"
                  :loading="loading"
                  :disabled="!docId"
                  @click="subscribe"
                  block
                >
                  <v-icon start>mdi-database-search</v-icon>
                  取得
                </v-btn>
                <v-btn v-else color="grey" @click="unsubscribe" block>
                  <v-icon start>mdi-close</v-icon>
                  クリア
                </v-btn>
              </v-col>
            </v-row>

            <!-- メッセージ表示 -->
            <v-alert
              v-if="message"
              :type="messageType"
              class="mt-4"
              variant="tonal"
              closable
              @click:close="message = ''"
            >
              {{ message }}
            </v-alert>

            <!-- OperationResult データ表示 -->
            <v-card v-if="isSubscribed" variant="outlined" class="mt-4">
              <v-card-title class="text-subtitle-1">
                OperationResult データ
              </v-card-title>
              <v-divider></v-divider>
              <v-card-text>
                <v-list density="compact">
                  <v-list-item>
                    <v-list-item-title>勤務区分</v-list-item-title>
                    <v-list-item-subtitle>
                      {{ operationResult.workShift || "未設定" }}
                    </v-list-item-subtitle>
                  </v-list-item>
                  <v-list-item>
                    <v-list-item-title>所定労働時間（分）</v-list-item-title>
                    <v-list-item-subtitle>
                      {{ operationResult.regulationWorkMinutes || 0 }}
                    </v-list-item-subtitle>
                  </v-list-item>
                  <v-list-item>
                    <v-list-item-title>従業員数</v-list-item-title>
                    <v-list-item-subtitle>
                      {{ operationResult.employees?.length || 0 }}
                    </v-list-item-subtitle>
                  </v-list-item>
                  <v-list-item>
                    <v-list-item-title>外注先数</v-list-item-title>
                    <v-list-item-subtitle>
                      {{ operationResult.outsourcers?.length || 0 }}
                    </v-list-item-subtitle>
                  </v-list-item>
                </v-list>

                <!-- 従業員リスト -->
                <v-card
                  v-if="operationResult.employees?.length"
                  variant="outlined"
                  class="mt-4"
                >
                  <v-card-title class="text-subtitle-2">従業員</v-card-title>
                  <v-divider></v-divider>
                  <v-card-text>
                    <v-chip
                      v-for="employee in operationResult.employees"
                      :key="employee.code"
                      class="ma-1"
                      size="small"
                    >
                      {{ employee.abbr }}
                    </v-chip>
                  </v-card-text>
                </v-card>

                <!-- 外注先リスト -->
                <v-card
                  v-if="operationResult.outsourcers?.length"
                  variant="outlined"
                  class="mt-4"
                >
                  <v-card-title class="text-subtitle-2">外注先</v-card-title>
                  <v-divider></v-divider>
                  <v-card-text>
                    <v-chip
                      v-for="outsourcer in operationResult.outsourcers"
                      :key="outsourcer.code"
                      class="ma-1"
                      size="small"
                      color="orange"
                    >
                      {{ outsourcer.abbr }}
                    </v-chip>
                  </v-card-text>
                </v-card>
              </v-card-text>
            </v-card>
          </v-card-text>

          <v-divider></v-divider>

          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn
              color="error"
              disabled
            >
              <v-icon start>mdi-backup-restore</v-icon>
              ロールバック停止中
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
