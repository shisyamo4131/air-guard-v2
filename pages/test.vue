<script setup>
import { generateDrivingLogPdf } from "../utils/generateCollectingReport.js";
import { CollectionRoute } from "../schemas/CollectionRoute.js";

async function downloadPdf() {
  const routeDocId = "PlpBaQDixTbLaFk0VQdO";
  const dayOfWeek = 0; // 日曜日

  try {
    const route = new CollectionRoute();
    await route.fetch({ docId: routeDocId });

    if (!route.docId) {
      console.error("指定されたルートが見つかりません。docId:", routeDocId);
      alert("指定されたルートが見つかりません。");
      return;
    }

    // 指定された曜日のstopsをフィルタリング
    const filteredStops = route.stops
      ? route.stops.filter((stop) => stop.dayOfWeek === dayOfWeek)
      : [];

    // generateDrivingLogPdf にフィルタリング済みのstopsと必要な情報を渡す
    generateDrivingLogPdf(filteredStops, dayOfWeek, route.name, route.code);
  } catch (error) {
    // CollectionRoute.fetch やその他の予期せぬエラーをキャッチ
    console.error("PDF出力処理中にエラーが発生しました (test.vue):", error);
    alert(
      "PDF出力処理中にエラーが発生しました。コンソールを確認してください。"
    );
  }
}
</script>

<template>
  <v-container>
    <v-btn color="primary" @click="downloadPdf"> 運転日報PDF出力 (日曜) </v-btn>
  </v-container>
</template>
