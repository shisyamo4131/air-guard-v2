<script setup>
function generateKey(label) {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// useLoadingsStore から add/remove を取得
const { add, remove } = useLoadingsStore();

// 処理Aを開始（5秒で終了）
function startProcessA() {
  const key = generateKey("A");
  const text = "処理Aを実行中…";
  add({ key, text });

  setTimeout(() => {
    remove(key);
  }, 5000);
}

// 処理Bを開始（7秒で終了）
function startProcessB() {
  const key = generateKey("B");
  const text = "処理Bを実行中…";
  add({ key, text });

  setTimeout(() => {
    remove(key);
  }, 7000);
}

// A → 少し遅れて B
function startScenario() {
  startProcessA();

  setTimeout(() => {
    startProcessB();
  }, 1000);
}
</script>

<template>
  <v-container class="pa-4">
    <v-btn color="primary" @click="startScenario">
      テスト開始（処理A → 処理B → A終了 → B終了）
    </v-btn>
  </v-container>
</template>
