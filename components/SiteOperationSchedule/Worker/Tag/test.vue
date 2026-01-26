<script setup>
import { ref } from "vue";

const sizes = ["small", "medium", "large"];
const variants = ["default", "success", "warning", "error", "disabled"];

const testLabel = ref("山田 太郎");
const startTime = ref("09:00");
const endTime = ref("18:00");
const highlight = ref(false);
const loading = ref(false);
const removable = ref(true);

const handleRemove = (label) => {
  console.log(`削除ボタンがクリックされました: ${label}`);
};
</script>

<template>
  <v-container fluid class="pa-4">
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 mb-4">WorkerTag</h1>
      </v-col>
    </v-row>

    <!-- コントロールパネル -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4 mb-6">
          <h2 class="text-h6 mb-4">コントロール</h2>
          <v-row>
            <v-col cols="12" md="4">
              <v-text-field
                v-model="testLabel"
                label="ラベル"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field
                v-model="startTime"
                label="開始時刻"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field
                v-model="endTime"
                label="終了時刻"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-switch
                v-model="highlight"
                label="ハイライト"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-switch
                v-model="loading"
                label="ローディング"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-switch
                v-model="removable"
                label="削除可能"
                density="compact"
                hide-details
              />
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>

    <!-- サイズバリアント -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4 mb-6">
          <h2 class="text-h6 mb-4">サイズバリアント</h2>
          <v-row>
            <v-col v-for="size in sizes" :key="size" cols="12" md="4">
              <h3 class="text-subtitle-2 mb-2">{{ size.toUpperCase() }}</h3>
              <WorkerTag
                :label="testLabel"
                :start-time="startTime"
                :end-time="endTime"
                :size="size"
                :highlight="highlight"
                :loading="loading"
                :removable="removable"
                @click:remove="handleRemove(testLabel)"
              />
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>

    <!-- カラーバリアント -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4 mb-6">
          <h2 class="text-h6 mb-4">カラーバリアント (Medium サイズ)</h2>
          <v-row>
            <v-col v-for="variant in variants" :key="variant" cols="12" md="4">
              <h3 class="text-subtitle-2 mb-2">
                {{ variant.toUpperCase() }}
              </h3>
              <WorkerTag
                :label="`${testLabel} (${variant})`"
                :start-time="startTime"
                :end-time="endTime"
                :variant="variant"
                size="medium"
                :removable="removable"
                @click:remove="handleRemove(variant)"
              />
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>

    <!-- ローディング状態 -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4 mb-6">
          <h2 class="text-h6 mb-4">ローディング状態</h2>
          <v-row>
            <v-col v-for="size in sizes" :key="size" cols="12" md="4">
              <h3 class="text-subtitle-2 mb-2">{{ size.toUpperCase() }}</h3>
              <WorkerTag
                :size="size"
                :start-time="startTime"
                :end-time="endTime"
                :loading="true"
              />
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>

    <!-- ラベルなし（自動ローディング） -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4 mb-6">
          <h2 class="text-h6 mb-4">ラベルなし（自動ローディング）</h2>
          <v-row>
            <v-col v-for="size in sizes" :key="size" cols="12" md="4">
              <h3 class="text-subtitle-2 mb-2">{{ size.toUpperCase() }}</h3>
              <WorkerTag :size="size" />
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>

    <!-- 時刻未指定（デフォルト値テスト） -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4 mb-6">
          <h2 class="text-h6 mb-4">時刻未指定（デフォルト値: --:--）</h2>
          <v-row>
            <v-col v-for="size in sizes" :key="size" cols="12" md="4">
              <h3 class="text-subtitle-2 mb-2">{{ size.toUpperCase() }}</h3>
              <WorkerTag :label="testLabel" :size="size" :removable="true" />
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>

    <!-- 時刻のカスタマイズ -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4 mb-6">
          <h2 class="text-h6 mb-4">時刻表示のバリエーション</h2>
          <v-row>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">通常の時刻表示</h3>
              <WorkerTag
                :label="testLabel"
                start-time="09:00"
                end-time="18:00"
                size="medium"
                :removable="true"
              />
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">深夜勤務</h3>
              <WorkerTag
                :label="testLabel"
                start-time="22:00"
                end-time="06:00"
                size="medium"
                variant="warning"
                :removable="true"
              />
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">早朝勤務</h3>
              <WorkerTag
                :label="testLabel"
                start-time="05:00"
                end-time="14:00"
                size="medium"
                variant="success"
                :removable="true"
              />
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">時刻未定（デフォルト値使用）</h3>
              <WorkerTag
                :label="testLabel"
                size="medium"
                variant="disabled"
                :removable="true"
              />
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">時刻未定（明示的に指定）</h3>
              <WorkerTag
                :label="testLabel"
                start-time="--:--"
                end-time="--:--"
                size="medium"
                variant="disabled"
                :removable="true"
              />
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">時刻非表示（hideTime）</h3>
              <WorkerTag
                :label="testLabel"
                start-time="09:00"
                end-time="18:00"
                size="medium"
                :removable="true"
                :hide-time="true"
              />
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>

    <!-- showDraggableIcon プロパティのテスト -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4 mb-6">
          <h2 class="text-h6 mb-4">showDraggableIcon プロパティのテスト</h2>
          <v-row>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">
                ドラッグアイコンなし（デフォルト）
              </h3>
              <WorkerTag
                label="山田 太郎"
                start-time="09:00"
                end-time="18:00"
                size="medium"
                :removable="true"
              />
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">
                ドラッグアイコンあり（showDraggableIcon=true）
              </h3>
              <WorkerTag
                label="山田 太郎"
                start-time="09:00"
                end-time="18:00"
                size="medium"
                :removable="true"
                :show-draggable-icon="true"
              />
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">
                Small サイズ + ドラッグアイコン
              </h3>
              <WorkerTag
                label="鈴木 一郎"
                start-time="09:00"
                end-time="18:00"
                size="small"
                :removable="true"
                :show-draggable-icon="true"
              />
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">
                Large サイズ + ドラッグアイコン
              </h3>
              <WorkerTag
                label="佐藤 花子"
                start-time="09:00"
                end-time="18:00"
                size="large"
                :removable="true"
                :show-draggable-icon="true"
              />
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">
                ドラッグアイコン + カスタムprepend-label
              </h3>
              <WorkerTag
                label="田中 次郎"
                start-time="09:00"
                end-time="18:00"
                size="medium"
                :removable="true"
                :show-draggable-icon="true"
              >
                <template #prepend-label>
                  <v-icon size="small" class="mr-1" color="primary">
                    mdi-account-star
                  </v-icon>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">
                ドラッグアイコン + 各種バリアント
              </h3>
              <WorkerTag
                label="高橋 健太"
                start-time="09:00"
                end-time="18:00"
                size="medium"
                variant="success"
                :removable="true"
                :show-draggable-icon="true"
              >
                <template #append-label>
                  <v-chip size="x-small" color="success" class="ml-2">
                    リーダー
                  </v-chip>
                </template>
              </WorkerTag>
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>

    <!-- hideTime プロパティのテスト -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4 mb-6">
          <h2 class="text-h6 mb-4">hideTime プロパティのテスト</h2>
          <v-row>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">時刻表示あり（デフォルト）</h3>
              <WorkerTag
                label="山田 太郎"
                start-time="09:00"
                end-time="18:00"
                size="medium"
                :removable="true"
              />
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">
                時刻表示なし（hideTime=true）
              </h3>
              <WorkerTag
                label="山田 太郎"
                start-time="09:00"
                end-time="18:00"
                size="medium"
                :removable="true"
                :hide-time="true"
              />
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">
                時刻非表示 + フッタースロット使用
              </h3>
              <WorkerTag
                label="鈴木 一郎"
                start-time="09:00"
                end-time="18:00"
                size="medium"
                :removable="true"
                :hide-time="true"
              >
                <template #prepend-footer>
                  <div class="text-caption text-grey">
                    <v-icon size="x-small" class="mr-1">mdi-map-marker</v-icon>
                    現場A - 日勤
                  </div>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">
                時刻非表示 + 複数フッタースロット
              </h3>
              <WorkerTag
                label="佐藤 花子"
                start-time="09:00"
                end-time="18:00"
                size="medium"
                :removable="true"
                :hide-time="true"
              >
                <template #prepend-footer>
                  <div class="text-caption">
                    <v-chip size="x-small" color="primary">責任者</v-chip>
                  </div>
                </template>
                <template #footer>
                  <div class="text-caption text-grey">配属: 東京本社</div>
                </template>
                <template #append-footer>
                  <div class="text-caption text-success">
                    <v-icon size="x-small" class="mr-1"
                      >mdi-check-circle</v-icon
                    >
                    出勤確認済み
                  </div>
                </template>
              </WorkerTag>
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>

    <!-- スロットのテスト -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4 mb-6">
          <h2 class="text-h6 mb-4">スロットのテスト</h2>
          <v-row>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">Prepend Label スロット</h3>
              <WorkerTag
                :label="testLabel"
                :start-time="startTime"
                :end-time="endTime"
                size="medium"
                :removable="true"
              >
                <template #prepend-label>
                  <v-icon size="small" class="mr-1" color="primary">
                    mdi-account-star
                  </v-icon>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">Append Label スロット</h3>
              <WorkerTag
                :label="testLabel"
                :start-time="startTime"
                :end-time="endTime"
                size="medium"
                :removable="true"
              >
                <template #append-label>
                  <v-chip size="x-small" color="success" class="ml-2">
                    リーダー
                  </v-chip>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">
                カスタム時刻表示（StartTime スロット）
              </h3>
              <WorkerTag
                :label="testLabel"
                :start-time="startTime"
                :end-time="endTime"
                size="medium"
                :removable="true"
              >
                <template #startTime="{ startTime }">
                  <v-icon size="x-small" class="mr-1">mdi-clock-start</v-icon>
                  <span class="font-weight-bold">{{ startTime }}</span>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">
                カスタム時刻表示（EndTime スロット）
              </h3>
              <WorkerTag
                :label="testLabel"
                :start-time="startTime"
                :end-time="endTime"
                size="medium"
                :removable="true"
              >
                <template #endTime="{ endTime }">
                  <span class="font-weight-bold">{{ endTime }}</span>
                  <v-icon size="x-small" class="ml-1">mdi-clock-end</v-icon>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">
                Prepend Footer スロット（時刻下・最上部）
              </h3>
              <WorkerTag
                :label="testLabel"
                :start-time="startTime"
                :end-time="endTime"
                size="medium"
                :removable="true"
              >
                <template #prepend-footer>
                  <div class="text-caption text-grey">
                    <v-icon size="x-small" class="mr-1">mdi-map-marker</v-icon>
                    現場A
                  </div>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">
                Footer スロット（中央エリア）
              </h3>
              <WorkerTag
                :label="testLabel"
                :start-time="startTime"
                :end-time="endTime"
                size="medium"
                :removable="true"
              >
                <template #footer>
                  <div class="d-flex align-center text-caption">
                    <v-chip size="x-small" color="primary" class="mr-1">
                      シフトA
                    </v-chip>
                    <span class="text-grey">休憩: 12:00-13:00</span>
                  </div>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">
                Append Footer スロット（最下部）
              </h3>
              <WorkerTag
                :label="testLabel"
                :start-time="startTime"
                :end-time="endTime"
                size="medium"
                :removable="true"
              >
                <template #append-footer>
                  <div class="text-caption text-success">
                    <v-icon size="x-small" class="mr-1"
                      >mdi-check-circle</v-icon
                    >
                    出勤確認済み
                  </div>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">Prepend Action スロット</h3>
              <WorkerTag
                :label="testLabel"
                :start-time="startTime"
                :end-time="endTime"
                size="medium"
                :removable="true"
              >
                <template #prepend-action>
                  <v-icon size="small" color="warning">
                    mdi-alert-circle
                  </v-icon>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">
                3つのフッタースロット組み合わせ
              </h3>
              <WorkerTag
                :label="testLabel"
                :start-time="startTime"
                :end-time="endTime"
                size="medium"
                :removable="true"
              >
                <template #prepend-footer>
                  <div class="text-caption text-grey">
                    <v-icon size="x-small" class="mr-1">mdi-map-marker</v-icon>
                    東京支店
                  </div>
                </template>
                <template #footer>
                  <div class="d-flex align-center text-caption">
                    <v-chip size="x-small" color="primary">日勤</v-chip>
                  </div>
                </template>
                <template #append-footer>
                  <div class="text-caption text-success">
                    <v-icon size="x-small" class="mr-1">mdi-check</v-icon>
                    確定
                  </div>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12">
              <h3 class="text-subtitle-2 mb-2">全フッタースロットのテスト</h3>
              <p class="text-caption text-grey mb-2">
                時刻表示 → prepend-footer → footer → append-footer
                の順に表示されます
              </p>
              <WorkerTag
                :label="testLabel"
                :start-time="startTime"
                :end-time="endTime"
                size="large"
                :removable="true"
              >
                <template #prepend-footer>
                  <v-list-item-subtitle class="text-caption text-primary">
                    <v-icon size="x-small" class="mr-1"
                      >mdi-office-building</v-icon
                    >
                    配属: 本社ビル 3階
                  </v-list-item-subtitle>
                </template>
                <template #footer>
                  <v-list-item-subtitle
                    class="d-flex align-center text-caption"
                  >
                    <v-chip size="x-small" color="success" class="mr-1"
                      >正社員</v-chip
                    >
                    <v-chip size="x-small" color="info">リーダー</v-chip>
                  </v-list-item-subtitle>
                </template>
                <template #append-footer>
                  <v-list-item-subtitle class="text-caption text-warning">
                    <v-icon size="x-small" class="mr-1">mdi-alert</v-icon>
                    備考: 資格更新が近づいています (2026/02/15)
                  </v-list-item-subtitle>
                </template>
              </WorkerTag>
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>

    <!-- 複合的なカスタマイズ -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4 mb-6">
          <h2 class="text-h6 mb-4">複合的なカスタマイズ</h2>
          <v-row>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">リーダー（特別表示）</h3>
              <WorkerTag
                :label="testLabel"
                start-time="08:00"
                end-time="17:00"
                size="medium"
                variant="success"
                :highlight="true"
                :removable="true"
              >
                <template #prepend-label>
                  <v-icon size="small" class="mr-1" color="success">
                    mdi-shield-star
                  </v-icon>
                </template>
                <template #append-label>
                  <v-chip size="x-small" color="success" class="ml-2">
                    班長
                  </v-chip>
                </template>
                <template #footer>
                  <div class="text-caption">
                    <v-chip size="x-small" color="success" variant="outlined">
                      経験5年
                    </v-chip>
                  </div>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">アラート付き作業員</h3>
              <WorkerTag
                label="鈴木 一郎"
                start-time="09:00"
                end-time="18:00"
                size="medium"
                variant="warning"
                :removable="true"
              >
                <template #prepend-action>
                  <v-icon size="small" color="warning">
                    mdi-alert-circle
                  </v-icon>
                </template>
                <template #append-footer>
                  <div class="text-warning text-caption">
                    <v-icon size="x-small" class="mr-1">mdi-alert</v-icon>
                    資格更新必要
                  </div>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">新人作業員</h3>
              <WorkerTag
                label="佐藤 花子"
                start-time="09:00"
                end-time="17:00"
                size="medium"
                :removable="true"
              >
                <template #append-label>
                  <v-chip size="x-small" color="info" class="ml-2">
                    新人
                  </v-chip>
                </template>
                <template #prepend-footer>
                  <div class="text-caption text-info">
                    <v-icon size="x-small" class="mr-1">mdi-school</v-icon>
                    研修: 安全教育
                  </div>
                </template>
                <template #startTime="{ startTime }">
                  <v-icon size="x-small" class="mr-1">mdi-clock-start</v-icon>
                  <span>{{ startTime }}</span>
                </template>
                <template #endTime="{ endTime }">
                  <span>{{ endTime }}</span>
                  <v-icon size="x-small" class="ml-1">mdi-clock-end</v-icon>
                </template>
                <template #append-footer>
                  <div class="text-caption text-grey">
                    <v-icon size="x-small" class="mr-1">mdi-information</v-icon>
                    研修期間中 (2026/01/15 - 2026/03/15)
                  </div>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">エラー状態</h3>
              <WorkerTag
                label="田中 三郎"
                start-time="22:00"
                end-time="06:00"
                size="medium"
                variant="error"
                :removable="true"
              >
                <template #prepend-action>
                  <v-icon size="small" color="error">
                    mdi-alert-octagon
                  </v-icon>
                </template>
                <template #append-footer>
                  <div class="text-error text-caption">
                    <v-icon size="x-small" class="mr-1"
                      >mdi-close-circle</v-icon
                    >
                    資格期限切れ (2025/12/31)
                  </div>
                </template>
              </WorkerTag>
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>

    <!-- ハイライト状態の組み合わせ -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4 mb-6">
          <h2 class="text-h6 mb-4">ハイライト状態</h2>
          <v-row>
            <v-col v-for="variant in variants" :key="variant" cols="12" md="4">
              <h3 class="text-subtitle-2 mb-2">
                {{ variant.toUpperCase() }} + Highlight
              </h3>
              <WorkerTag
                :label="`${testLabel} (${variant})`"
                :start-time="startTime"
                :end-time="endTime"
                :variant="variant"
                size="medium"
                :highlight="true"
                :removable="true"
              />
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>

    <!-- 実際の使用例 -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4 mb-6">
          <h2 class="text-h6 mb-4">実際の使用例</h2>
          <v-row>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">通常の作業員</h3>
              <WorkerTag
                label="山田 太郎"
                start-time="09:00"
                end-time="18:00"
                size="medium"
                :removable="true"
              />
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">時刻未定の作業員</h3>
              <WorkerTag label="高橋 健太" size="medium" :removable="true">
                <template #append-label>
                  <v-chip size="x-small" color="grey" class="ml-2">
                    調整中
                  </v-chip>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">正社員（出勤済み）</h3>
              <WorkerTag
                label="田中 次郎"
                start-time="08:30"
                end-time="17:30"
                size="medium"
                variant="success"
                :removable="true"
              >
                <template #append-label>
                  <v-chip size="x-small" color="success" class="ml-2">
                    出勤済
                  </v-chip>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">派遣社員（遅刻警告）</h3>
              <WorkerTag
                label="佐藤 花子"
                start-time="09:00"
                end-time="18:00"
                size="medium"
                variant="warning"
                :removable="true"
              >
                <template #prepend-action>
                  <v-icon size="small" color="warning">
                    mdi-clock-alert
                  </v-icon>
                </template>
                <template #append-footer>
                  <span class="text-warning text-caption ml-2">
                    (遅刻の可能性)
                  </span>
                </template>
              </WorkerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">欠勤者</h3>
              <WorkerTag
                label="鈴木 一郎"
                start-time="09:00"
                end-time="18:00"
                size="medium"
                variant="error"
                :removable="true"
              >
                <template #append-label>
                  <v-chip size="x-small" color="error" class="ml-2">
                    欠勤
                  </v-chip>
                </template>
              </WorkerTag>
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>

    <!-- 削除不可のテスト -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4">
          <h2 class="text-h6 mb-4">削除不可のタグ</h2>
          <v-row>
            <v-col v-for="size in sizes" :key="size" cols="12" md="4">
              <h3 class="text-subtitle-2 mb-2">{{ size.toUpperCase() }}</h3>
              <WorkerTag
                :label="`${testLabel} (${size})`"
                :start-time="startTime"
                :end-time="endTime"
                :size="size"
                :removable="false"
              />
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.v-card {
  border: 1px solid rgba(0, 0, 0, 0.12);
}
</style>
