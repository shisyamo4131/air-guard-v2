<script setup>
import { ref } from "vue";
import AirSelect from "../air-vuetify-v3/src/AirSelect.vue";

const selectedItem = ref(null);
const multipleItems = ref([]);
const submitted = ref(false);

const options = ["アップル", "バナナ", "オレンジ", "ぶどう", "メロン"];
</script>

<template>
  <v-container>
    <h2 class="text-h6 mb-4">
      AirSelect - 単一選択 / 複数選択 バリデーションテスト
    </h2>

    <air-select
      v-model="selectedItem"
      :items="options"
      label="フルーツ（必須）"
      required
    />

    <air-select
      v-model="multipleItems"
      :items="options"
      label="フルーツ（2〜3個選んで）"
      required
      multiple
      :min-items="2"
      :max-items="3"
    />

    <v-btn class="mt-4" @click="submitted = true">Submit</v-btn>

    <div v-if="submitted" class="mt-4">
      <p><strong>選択（単一）:</strong> {{ selectedItem || "[未選択]" }}</p>
      <p>
        <strong>選択（複数）:</strong>
        {{ multipleItems.length ? multipleItems.join(", ") : "[未選択]" }}
      </p>
    </div>
  </v-container>
</template>
