<script setup>
import { ref } from "vue";
import { TAG_SIZE_VALUES } from "@shisyamo4131/air-guard-v2-schemas/constants";

const sizes = Object.values(TAG_SIZE_VALUES).map((v) => v.value);
const variants = ["default", "success", "warning", "error", "disabled"];

const testLabel = ref("テストラベル");
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
        <h1 class="text-h4 mb-4">TagBase コンポーネント テスト</h1>
      </v-col>
    </v-row>

    <!-- コントロールパネル -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4 mb-6">
          <h2 class="text-h6 mb-4">コントロール</h2>
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="testLabel"
                label="ラベル"
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
              <MoleculesTagBase
                :label="testLabel"
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
              <MoleculesTagBase
                :label="`${variant} タグ`"
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
              <MoleculesTagBase :size="size" :loading="true" />
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
              <MoleculesTagBase :size="size" />
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
              <h3 class="text-subtitle-2 mb-2">カスタムラベルスロット</h3>
              <MoleculesTagBase size="medium" :removable="true">
                <template #label>
                  <v-icon size="small" class="mr-1">mdi-star</v-icon>
                  <span>カスタムラベル</span>
                </template>
              </MoleculesTagBase>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">Append Label スロット</h3>
              <MoleculesTagBase label="ラベル" size="medium" :removable="true">
                <template #append-label>
                  <v-chip size="x-small" color="primary" class="ml-2">
                    New
                  </v-chip>
                </template>
              </MoleculesTagBase>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">Footer スロット</h3>
              <MoleculesTagBase
                label="フッター付きタグ"
                size="large"
                :removable="true"
              >
                <template #footer>
                  <div class="text-caption text-grey mt-1">
                    補足情報がここに表示されます
                  </div>
                </template>
              </MoleculesTagBase>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">Prepend Action スロット</h3>
              <MoleculesTagBase
                label="アクション付きタグ"
                size="medium"
                :removable="true"
              >
                <template #prepend-action>
                  <v-icon size="small">mdi-information</v-icon>
                </template>
              </MoleculesTagBase>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">Append Action スロット</h3>
              <MoleculesTagBase
                label="アクション付きタグ"
                size="medium"
                :removable="true"
              >
                <template #append-action>
                  <v-icon size="small">mdi-pencil</v-icon>
                </template>
              </MoleculesTagBase>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">カスタム削除ボタン</h3>
              <MoleculesTagBase
                label="カスタムアクション"
                size="medium"
                :removable="true"
                @click:remove="handleRemove('custom')"
              >
                <template #action="{ onClick }">
                  <v-btn
                    icon
                    size="small"
                    color="error"
                    variant="text"
                    @click="onClick"
                  >
                    <v-icon>mdi-delete</v-icon>
                  </v-btn>
                </template>
              </MoleculesTagBase>
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
              <MoleculesTagBase
                :label="`${variant} + ハイライト`"
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
              <h3 class="text-subtitle-2 mb-2">従業員タグ</h3>
              <MoleculesTagBase
                label="山田 太郎"
                size="medium"
                variant="default"
                :removable="true"
              >
                <template #append-label>
                  <v-chip size="x-small" color="primary" class="ml-1">
                    正社員
                  </v-chip>
                </template>
              </MoleculesTagBase>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">アラートタグ</h3>
              <MoleculesTagBase
                label="確認が必要です"
                size="medium"
                variant="warning"
                :removable="true"
              >
                <template #prepend-action>
                  <v-icon size="small" color="warning">
                    mdi-alert-circle
                  </v-icon>
                </template>
              </MoleculesTagBase>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">完了タグ</h3>
              <MoleculesTagBase
                label="作業完了"
                size="medium"
                variant="success"
                :removable="false"
              >
                <template #prepend-label>
                  <v-icon size="small" color="success">mdi-check-circle</v-icon>
                </template>
              </MoleculesTagBase>
            </v-col>
            <v-col cols="12" md="6">
              <h3 class="text-subtitle-2 mb-2">エラータグ</h3>
              <MoleculesTagBase
                label="エラーが発生しました"
                size="medium"
                variant="error"
                :removable="true"
              >
                <template #footer>
                  <div class="text-caption text-error mt-1">
                    詳細: 接続がタイムアウトしました
                  </div>
                </template>
              </MoleculesTagBase>
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
              <MoleculesTagBase
                :label="`${size} タグ`"
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
