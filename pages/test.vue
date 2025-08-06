<script setup>
import { ref } from "vue";
import TagBase from "~/components/arrangements/TagBase.vue";

// テスト用のリアクティブな状態
const loading = ref(false);
const removable = ref(true);
const highlight = ref(false);
const label = ref("サンプルタグ");
const size = ref("medium");
const variant = ref("default");

// テスト用のメソッド
const toggleLoading = () => {
  loading.value = !loading.value;
};

const toggleRemovable = () => {
  removable.value = !removable.value;
};

const toggleHighlight = () => {
  highlight.value = !highlight.value;
};

const clearLabel = () => {
  label.value = label.value ? "" : "サンプルタグ";
};

const onRemove = () => {
  console.log("削除ボタンがクリックされました");
  alert("削除ボタンがクリックされました");
};

const sizes = ["small", "medium", "large"];
const variants = ["default", "success", "warning", "error"];
</script>

<template>
  <v-container class="pa-4">
    <h1 class="mb-4">TagBase Component テスト</h1>

    <!-- コントロールパネル -->
    <v-card class="mb-6">
      <v-card-title>コントロールパネル</v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="12" md="6">
            <v-text-field v-model="label" label="ラベル" clearable />
          </v-col>
          <v-col cols="12" md="6">
            <v-select v-model="size" :items="sizes" label="サイズ" />
          </v-col>
          <v-col cols="12" md="6">
            <v-select v-model="variant" :items="variants" label="バリアント" />
          </v-col>
          <v-col cols="12" md="6">
            <v-switch
              v-model="loading"
              label="ローディング状態"
              color="primary"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-switch
              v-model="removable"
              label="削除ボタン表示"
              color="primary"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-switch v-model="highlight" label="ハイライト" color="primary" />
          </v-col>
        </v-row>

        <v-row>
          <v-col>
            <v-btn @click="toggleLoading" class="mr-2">
              ローディング切り替え
            </v-btn>
            <v-btn @click="clearLabel" class="mr-2"> ラベル切り替え </v-btn>
            <v-btn @click="toggleHighlight" class="mr-2">
              ハイライト切り替え
            </v-btn>
            <v-btn @click="toggleRemovable"> 削除ボタン切り替え </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- メインテスト -->
    <v-card class="mb-6">
      <v-card-title>メインテスト</v-card-title>
      <v-card-text>
        <TagBase
          :label="label"
          :loading="loading"
          :removable="removable"
          :highlight="highlight"
          :size="size"
          :variant="variant"
          @click:remove="onRemove"
        />
      </v-card-text>
    </v-card>

    <!-- 各サイズのテスト -->
    <v-card class="mb-6">
      <v-card-title>サイズ比較</v-card-title>
      <v-card-text>
        <div class="d-flex flex-wrap gap-4">
          <TagBase
            label="Small"
            size="small"
            removable
            @click:remove="onRemove"
          />
          <TagBase
            label="Medium"
            size="medium"
            removable
            @click:remove="onRemove"
          />
          <TagBase
            label="Large"
            size="large"
            removable
            @click:remove="onRemove"
          />
        </div>
      </v-card-text>
    </v-card>

    <!-- 各バリアントのテスト -->
    <v-card class="mb-6">
      <v-card-title>バリアント比較</v-card-title>
      <v-card-text>
        <div class="d-flex flex-wrap gap-4">
          <TagBase
            label="Default"
            variant="default"
            removable
            @click:remove="onRemove"
          />
          <TagBase
            label="Success"
            variant="success"
            removable
            @click:remove="onRemove"
          />
          <TagBase
            label="Warning"
            variant="warning"
            removable
            @click:remove="onRemove"
          />
          <TagBase
            label="Error"
            variant="error"
            removable
            @click:remove="onRemove"
          />
        </div>
      </v-card-text>
    </v-card>

    <!-- ローディング状態のテスト -->
    <v-card class="mb-6">
      <v-card-title>ローディング状態</v-card-title>
      <v-card-text>
        <div class="d-flex flex-wrap gap-4">
          <TagBase
            label="ローディング中"
            :loading="true"
            removable
            @click:remove="onRemove"
          />
          <TagBase
            :loading="true"
            size="small"
            removable
            @click:remove="onRemove"
          />
          <TagBase
            :loading="true"
            size="large"
            removable
            @click:remove="onRemove"
          />
        </div>
      </v-card-text>
    </v-card>

    <!-- ラベルなし状態のテスト -->
    <v-card class="mb-6">
      <v-card-title>ラベルなし状態（自動ローディング）</v-card-title>
      <v-card-text>
        <div class="d-flex flex-wrap gap-4">
          <TagBase size="small" removable @click:remove="onRemove" />
          <TagBase size="medium" removable @click:remove="onRemove" />
          <TagBase size="large" removable @click:remove="onRemove" />
        </div>
      </v-card-text>
    </v-card>

    <!-- ハイライト状態のテスト -->
    <v-card class="mb-6">
      <v-card-title>ハイライト状態</v-card-title>
      <v-card-text>
        <div class="d-flex flex-wrap gap-4">
          <TagBase
            label="ハイライト"
            highlight
            removable
            @click:remove="onRemove"
          />
          <TagBase
            label="Success + ハイライト"
            variant="success"
            highlight
            removable
            @click:remove="onRemove"
          />
        </div>
      </v-card-text>
    </v-card>

    <!-- スロットテスト -->
    <v-card class="mb-6">
      <v-card-title>スロットテスト</v-card-title>
      <v-card-text>
        <div class="d-flex flex-wrap gap-4">
          <TagBase label="カスタムラベル" removable @click:remove="onRemove">
            <template #prepend-label>
              <v-icon size="small" class="mr-1">mdi-star</v-icon>
            </template>
            <template #append-label>
              <v-icon size="small" class="ml-1">mdi-check</v-icon>
            </template>
          </TagBase>

          <TagBase removable @click:remove="onRemove">
            <template #label>
              <strong>カスタム内容</strong>
            </template>
          </TagBase>
        </div>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<style scoped>
.gap-4 {
  gap: 1rem;
}
</style>
