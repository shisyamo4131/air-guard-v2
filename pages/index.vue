<script setup>
import { FireModel } from "air-firebase-v2";

const addTestData = async () => {
  try {
    const model = new FireModel();
    await model.create();
    alert("データ追加成功");
    const location = await fetchCoordinates("東京都");
    console.log(location);
  } catch (err) {
    console.error("Firestore 書き込みエラー:", err);
  }
};
</script>

<template>
  <div>
    <v-btn @click="addTestData">Add customer</v-btn>
    <AtomsGBtn />
  </div>
</template>
