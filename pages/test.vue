<script setup>
import { ref } from "vue";
import {
  useItemManager,
  props as itemManagerProps,
  emit as itemManagerEmits,
} from "air-vuetify-v3/useItemManager";

// テスト用のダミーitem
const testItem = ref({ name: "テスト", value: 123 });

// 必須propsの用意
const props = defineProps({
  ...itemManagerProps,
  handleCreate: {
    type: Function,
    default: () => {
      alert("作成されました！");
      return Promise.resolve();
    },
  },
  handleUpdate: {
    type: Function,
    default: () => {
      alert("更新されました！");
      return Promise.resolve();
    },
  },
  handleDelete: {
    type: Function,
    default: () => {
      alert("削除されました！");
      return Promise.resolve();
    },
  },
});

// ダミーemit関数
const emit = defineEmits(itemManagerEmits);

// useItemManagerを呼び出し
const manager = useItemManager({ props, emit });

// テスト用に編集開始
function startEdit() {
  manager.toUpdate();
}
</script>

<template>
  <div>
    <h2>useItemManager テスト</h2>
    <div>
      <button @click="startEdit">編集開始</button>
      <button @click="manager.submit" :disabled="!manager.isEditing">
        保存
      </button>
      <button @click="manager.quitEditing" :disabled="!manager.isEditing">
        キャンセル
      </button>
    </div>
    <div>
      <p>編集モード: {{ manager.editMode }}</p>
      <p>isEditing: {{ manager.isEditing }}</p>
      <p>item: {{ manager.item }}</p>
      <p>errors: {{ manager.errors }}</p>
    </div>
  </div>
</template>
