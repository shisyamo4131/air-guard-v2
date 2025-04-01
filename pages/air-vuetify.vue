<script setup>
import { ref } from "vue";
import AirTextField from "../air-vuetify-v3/src/AirTextField.vue";
import AirSelect from "../air-vuetify-v3/src/AirSelect.vue";

const name = ref("");
const email = ref("");
const fruits = ref([]);
const selectedFruit = ref(null);
const submitted = ref(false);

const fruitOptions = ["リンゴ", "バナナ", "オレンジ", "メロン", "ぶどう"];
</script>

<template>
  <v-container>
    <h2 class="text-h6 mb-4">AirTextField & AirSelect バリデーションテスト</h2>

    <air-text-field
      v-model="name"
      label="名前"
      :min-length="3"
      :max-length="10"
      :min-length-message="'3文字以上で入力してください'"
      :max-length-message="'10文字以内で入力してください'"
      required
    />

    <air-text-field
      v-model="email"
      label="メールアドレス"
      input-type="email"
      :email-message="'有効なメールアドレスを入力してください'"
    />

    <air-select
      v-model="selectedFruit"
      :items="fruitOptions"
      label="好きな果物（単一選択）"
      required
    />

    <air-select
      v-model="fruits"
      :items="fruitOptions"
      label="果物を2〜3個選択してください"
      multiple
      :min-items="2"
      :max-items="3"
      :min-items-message="'2つ以上選んでください'"
      :max-items-message="'3つまで選んでください'"
    />

    <v-btn class="mt-4" @click="submitted = true">Submit</v-btn>

    <div v-if="submitted" class="mt-4">
      <p><strong>名前:</strong> {{ name || "[未入力]" }}</p>
      <p><strong>メール:</strong> {{ email || "[未入力]" }}</p>
      <p><strong>果物（単一）:</strong> {{ selectedFruit || "[未選択]" }}</p>
      <p>
        <strong>果物（複数）:</strong>
        {{ fruits.length ? fruits.join(", ") : "[未選択]" }}
      </p>
    </div>
  </v-container>
</template>
