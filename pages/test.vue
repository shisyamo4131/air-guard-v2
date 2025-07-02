<script setup>
import { ref } from "vue";

// テーブルのヘッダー定義
const headers = [
  { title: "ID", key: "id" },
  { title: "名前", key: "name" },
  { title: "アクティブ", key: "isActive", align: "center" },
];

// テーブルのデータ定義
const items = ref([
  { id: 1, name: "Alice", isActive: true },
  { id: 2, name: "Bob", isActive: false },
  { id: 3, name: "Charlie", isActive: true },
  { id: 4, name: "David", isActive: false },
]);

// 編集モードを常にtrueに設定し、v-checkbox-btnがreadonlyにならないようにする
const isEdit = ref(true);

// v-checkbox-btn の modelValue が更新されたときのハンドラ
function updateIsActive(newValue, item) {
  item.isActive = newValue;
  console.log(`Item ${item.id} isActive updated to: ${newValue}`);
}
</script>

<template>
  <v-container>
    <v-card>
      <v-card-title>VCheckbox Color Test</v-card-title>
      <v-card-text>
        <v-data-table
          :headers="headers"
          :items="items"
          hide-default-footer
          items-per-page="-1"
        >
          <!-- 'isActive' カラムのカスタムテンプレート -->
          <template #item.isActive="{ item }">
            <v-checkbox-btn
              inline
              :model-value="item.isActive"
              color="red"
              :readonly="!isEdit"
              @update:modelValue="updateIsActive($event, item)"
            />
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>
  </v-container>
</template>
