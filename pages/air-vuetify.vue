<script setup>
import { ref } from "vue";
import AirTextField from "../air-vuetify-v3/src/AirTextField.vue";

const email = ref("");
const hiragana = ref("");
const katakana = ref("");
const alphabet = ref("");
const numeric = ref("");
const phone = ref("");
const submitted = ref(false);
</script>

<template>
  <v-container>
    <h2 class="text-h6 mb-4">AirTextField inputType 検証テスト</h2>

    <air-text-field
      v-model="email"
      label="Email"
      input-type="email"
      required
      :email-message="'正しいメールアドレスを入力してください'"
    />

    <air-text-field
      v-model="hiragana"
      label="ひらがな"
      input-type="hiragana"
      required
      :hiragana-message="'ひらがなで入力してください'"
    />

    <air-text-field
      v-model="katakana"
      label="カタカナ"
      input-type="katakana"
      required
      :katakana-message="'カタカナで入力してください'"
    />

    <air-text-field
      v-model="alphabet"
      label="Alphabet"
      input-type="alphabet"
      required
      :alphabet-message="'アルファベットのみ入力できます'"
    />

    <air-text-field
      v-model="numeric"
      label="Numeric"
      input-type="numeric"
      required
      :numeric-message="'数字のみ入力してください'"
    />

    <air-text-field
      v-model="phone"
      label="Phone Number"
      input-type="phone"
      required
      :phone-message="'有効な電話番号を入力してください'"
    />

    <v-btn class="mt-4" @click="submitted = true">Submit</v-btn>

    <div v-if="submitted" class="mt-4">
      <p><strong>Email:</strong> {{ email || "[empty]" }}</p>
      <p><strong>ひらがな:</strong> {{ hiragana || "[empty]" }}</p>
      <p><strong>カタカナ:</strong> {{ katakana || "[empty]" }}</p>
      <p><strong>Alphabet:</strong> {{ alphabet || "[empty]" }}</p>
      <p><strong>Numeric:</strong> {{ numeric || "[empty]" }}</p>
      <p><strong>Phone:</strong> {{ phone || "[empty]" }}</p>
    </div>
  </v-container>
</template>
