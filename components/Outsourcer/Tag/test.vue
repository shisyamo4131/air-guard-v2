<script setup>
import { ref, computed } from "vue";
import { mockOutsourcers } from "./test.mock.js";
import { useFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";

const sizes = ["small", "medium", "large"];
const variants = ["default", "success", "warning", "error", "disabled"];

// useFetchOutsourcerのインスタンスを作成し、モックデータをキャッシュに追加
const outsourcerComposable = useFetchOutsourcer();
const { pushOutsourcers } = outsourcerComposable;

// モックデータを事前にキャッシュに追加（Firestoreアクセスを回避）
pushOutsourcers(mockOutsourcers);

// 選択された外注先のインデックス
const selectedOutsourcerIndex = ref(0);

// 選択された外注先
const selectedOutsourcer = computed(
  () => mockOutsourcers[selectedOutsourcerIndex.value],
);

// 外注先選択用のオプション
const outsourcerOptions = computed(() =>
  mockOutsourcers.map((out, index) => ({
    value: index,
    title: `${out.displayName} (${out.code})`,
    subtitle: out.remarks,
  })),
);

const highlight = ref(false);
const removable = ref(false);
const showDraggableIcon = ref(false);

const handleRemove = (label) => {
  console.log(`削除ボタンがクリックされました: ${label}`);
};
</script>

<template>
  <v-container fluid class="pa-4">
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 mb-4">OutsourcerTag</h1>
      </v-col>
    </v-row>

    <!-- コントロールパネル -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4 mb-6">
          <h2 class="text-h6 mb-4">コントロール</h2>
          <v-row>
            <v-col cols="12">
              <v-select
                v-model="selectedOutsourcerIndex"
                :items="outsourcerOptions"
                label="表示する外注先を選択"
                density="compact"
                hide-details
              >
                <template #item="{ props, item }">
                  <v-list-item v-bind="props">
                    <v-list-item-subtitle class="text-caption">
                      {{ item.raw.subtitle }}
                    </v-list-item-subtitle>
                  </v-list-item>
                </template>
              </v-select>
            </v-col>
            <v-col cols="12">
              <v-card variant="tonal" color="info" class="pa-3">
                <div class="text-caption mb-2">
                  <strong>選択中の外注先情報:</strong>
                </div>
                <div class="text-caption">
                  <strong>コード:</strong> {{ selectedOutsourcer.code }}
                </div>
                <div class="text-caption">
                  <strong>名称:</strong> {{ selectedOutsourcer.name }}
                </div>
                <div class="text-caption">
                  <strong>略称:</strong> {{ selectedOutsourcer.displayName }}
                </div>
                <div class="text-caption">
                  <strong>カナ:</strong> {{ selectedOutsourcer.nameKana }}
                </div>
                <div class="text-caption">
                  <strong>契約状態:</strong>
                  {{
                    selectedOutsourcer.contractStatus === "active"
                      ? "契約中"
                      : "契約終了"
                  }}
                </div>
                <div class="text-caption mt-2 text-grey-darken-1">
                  {{ selectedOutsourcer.remarks }}
                </div>
              </v-card>
            </v-col>
            <v-col cols="12" md="6">
              <v-switch
                v-model="highlight"
                label="ハイライト表示"
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
            <v-col cols="12" md="6">
              <v-switch
                v-model="showDraggableIcon"
                label="ドラッグアイコン表示"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12">
              <div class="text-subtitle-2 mb-2">プレビュー</div>
              <OutsourcerTag
                :doc-id="selectedOutsourcer.docId"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                :highlight="highlight"
                :removable="removable"
                :show-draggable-icon="showDraggableIcon"
                @click:remove="handleRemove(selectedOutsourcer.displayName)"
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
              <OutsourcerTag
                :doc-id="selectedOutsourcer.docId"
                :fetch-outsourcer-composable="outsourcerComposable"
                :size="size"
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
              <OutsourcerTag
                :doc-id="selectedOutsourcer.docId"
                :fetch-outsourcer-composable="outsourcerComposable"
                :variant="variant"
                size="medium"
              />
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
              <OutsourcerTag
                :doc-id="selectedOutsourcer.docId"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                :removable="true"
              >
                <template #prepend-label>
                  <v-icon size="small" class="mr-1" color="primary">
                    mdi-domain
                  </v-icon>
                </template>
              </OutsourcerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">Append Label スロット</h3>
              <OutsourcerTag
                :doc-id="selectedOutsourcer.docId"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                :removable="true"
              >
                <template #append-label>
                  <v-chip size="x-small" color="success" class="ml-2">
                    優良業者
                  </v-chip>
                </template>
              </OutsourcerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">Prepend Footer スロット</h3>
              <OutsourcerTag
                :doc-id="selectedOutsourcer.docId"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                :removable="true"
              >
                <template #prepend-footer>
                  <div class="text-caption text-grey">
                    <v-icon size="x-small" class="mr-1">mdi-phone</v-icon>
                    03-1234-5678
                  </div>
                </template>
              </OutsourcerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">Footer スロット</h3>
              <OutsourcerTag
                :doc-id="selectedOutsourcer.docId"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                :removable="true"
              >
                <template #footer>
                  <div class="d-flex align-center text-caption">
                    <v-chip size="x-small" color="primary" class="mr-1">
                      施設警備
                    </v-chip>
                    <span class="text-grey">対応可能人数: 50名</span>
                  </div>
                </template>
              </OutsourcerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">Append Footer スロット</h3>
              <OutsourcerTag
                :doc-id="selectedOutsourcer.docId"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                :removable="true"
              >
                <template #append-footer>
                  <div class="text-caption text-success">
                    <v-icon size="x-small" class="mr-1"
                      >mdi-check-circle</v-icon
                    >
                    対応可能
                  </div>
                </template>
              </OutsourcerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">Prepend Action スロット</h3>
              <OutsourcerTag
                :doc-id="selectedOutsourcer.docId"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                :removable="true"
              >
                <template #prepend-action>
                  <v-icon size="small" color="warning">
                    mdi-alert-circle
                  </v-icon>
                </template>
              </OutsourcerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">
                3つのフッタースロット組み合わせ
              </h3>
              <OutsourcerTag
                :doc-id="selectedOutsourcer.docId"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                :removable="true"
              >
                <template #prepend-footer>
                  <div class="text-caption text-grey">
                    <v-icon size="x-small" class="mr-1">mdi-map-marker</v-icon>
                    東京都新宿区
                  </div>
                </template>
                <template #footer>
                  <div class="d-flex align-center text-caption">
                    <v-chip size="x-small" color="primary">大手企業</v-chip>
                  </div>
                </template>
                <template #append-footer>
                  <div class="text-caption text-success">
                    <v-icon size="x-small" class="mr-1">mdi-check</v-icon>
                    即時対応可
                  </div>
                </template>
              </OutsourcerTag>
            </v-col>
            <v-col cols="12">
              <h3 class="text-subtitle-2 mb-2">全フッタースロットのテスト</h3>
              <p class="text-caption text-grey mb-2">
                prepend-footer → footer → append-footer の順で表示されます
              </p>
              <OutsourcerTag
                :doc-id="selectedOutsourcer.docId"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="large"
                :removable="true"
              >
                <template #prepend-footer>
                  <v-list-item-subtitle class="text-caption text-primary">
                    <v-icon size="x-small" class="mr-1"
                      >mdi-office-building</v-icon
                    >
                    本社: 東京都新宿区西新宿1-1-1
                  </v-list-item-subtitle>
                </template>
                <template #footer>
                  <v-list-item-subtitle
                    class="d-flex align-center text-caption"
                  >
                    <v-chip size="x-small" color="success" class="mr-1"
                      >施設警備</v-chip
                    >
                    <v-chip size="x-small" color="info">交通誘導</v-chip>
                  </v-list-item-subtitle>
                </template>
                <template #append-footer>
                  <v-list-item-subtitle class="text-caption text-warning">
                    <v-icon size="x-small" class="mr-1">mdi-alert</v-icon>
                    備考: 繁忙期対応注意 (12-3月)
                  </v-list-item-subtitle>
                </template>
              </OutsourcerTag>
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
              <h3 class="text-subtitle-2 mb-2">優良業者（特別表示）</h3>
              <OutsourcerTag
                :doc-id="selectedOutsourcer.docId"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                variant="success"
                :highlight="true"
                :removable="true"
              >
                <template #prepend-label>
                  <v-icon size="small" class="mr-1" color="success">
                    mdi-star
                  </v-icon>
                </template>
                <template #append-label>
                  <v-chip size="x-small" color="success" class="ml-2">
                    優良
                  </v-chip>
                </template>
                <template #footer>
                  <div class="text-caption">
                    <v-chip size="x-small" color="success" variant="outlined">
                      実績10年以上
                    </v-chip>
                  </div>
                </template>
              </OutsourcerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">アラート付き外注先</h3>
              <OutsourcerTag
                :doc-id="selectedOutsourcer.docId"
                :fetch-outsourcer-composable="outsourcerComposable"
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
                    契約更新確認必要
                  </div>
                </template>
              </OutsourcerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">新規契約外注先</h3>
              <OutsourcerTag
                :doc-id="selectedOutsourcer.docId"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                :removable="true"
              >
                <template #append-label>
                  <v-chip size="x-small" color="info" class="ml-2">
                    新規
                  </v-chip>
                </template>
                <template #prepend-footer>
                  <div class="text-caption text-info">
                    <v-icon size="x-small" class="mr-1">mdi-information</v-icon>
                    試用期間中 (2026/01/01 - 2026/03/31)
                  </div>
                </template>
              </OutsourcerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">契約終了状態</h3>
              <OutsourcerTag
                :doc-id="selectedOutsourcer.docId"
                :fetch-outsourcer-composable="outsourcerComposable"
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
                    契約終了 (2025/12/31)
                  </div>
                </template>
              </OutsourcerTag>
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
              <OutsourcerTag
                :doc-id="selectedOutsourcer.docId"
                :fetch-outsourcer-composable="outsourcerComposable"
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
              <h3 class="text-subtitle-2 mb-2">通常の外注先</h3>
              <OutsourcerTag
                :doc-id="selectedOutsourcer.docId"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                :removable="true"
              />
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">調整中の外注先</h3>
              <OutsourcerTag
                :doc-id="selectedOutsourcer.docId"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                :removable="true"
              >
                <template #append-label>
                  <v-chip size="x-small" color="grey" class="ml-2">
                    調整中
                  </v-chip>
                </template>
              </OutsourcerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">対応可能（確定）</h3>
              <OutsourcerTag
                :doc-id="selectedOutsourcer.docId"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                variant="success"
                :removable="true"
              >
                <template #append-label>
                  <v-chip size="x-small" color="success" class="ml-2">
                    確定
                  </v-chip>
                </template>
              </OutsourcerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">対応困難（警告）</h3>
              <OutsourcerTag
                :doc-id="selectedOutsourcer.docId"
                :fetch-outsourcer-composable="outsourcerComposable"
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
                    (人員不足の可能性)
                  </span>
                </template>
              </OutsourcerTag>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">対応不可</h3>
              <OutsourcerTag
                :doc-id="selectedOutsourcer.docId"
                :fetch-outsourcer-composable="outsourcerComposable"
                size="medium"
                variant="error"
                :removable="true"
              >
                <template #append-label>
                  <v-chip size="x-small" color="error" class="ml-2">
                    対応不可
                  </v-chip>
                </template>
              </OutsourcerTag>
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
