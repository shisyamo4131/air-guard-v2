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

const dialog = ref(false);
const Customer = ref({
  name: "唯心",
});
</script>

<template>
  <div>
    <RenderlessItemManager v-model="Customer" :is-editing="dialog">
      <template
        #default="{
          isEditing,
          item,
          quitEditing,
          submit,
          updateProperties,
          toUpdate,
        }"
      >
        <v-container>
          <v-card>
            <v-card-title>Customer</v-card-title>
            <v-card-text>
              {{ Customer }}
            </v-card-text>
            <v-card-actions>
              <v-dialog
                :model-value="isEditing"
                @update:modelValue="quitEditing"
              >
                <template #activator="{ props: attrs }">
                  <v-btn
                    v-bind="attrs"
                    color="primary"
                    variant="elevated"
                    @click="toUpdate"
                    >open</v-btn
                  >
                </template>
                <v-card>
                  <v-card-title>edit</v-card-title>
                  <v-card-text>
                    <v-text-field
                      :value="item.name"
                      variant="outlined"
                      @update:model-value="updateProperties({ name: $event })"
                    />
                  </v-card-text>
                  <v-card-actions>
                    <v-btn @click="submit">submit</v-btn>
                  </v-card-actions>
                </v-card>
              </v-dialog>
            </v-card-actions>
          </v-card>
        </v-container>
        <div>{{ Customer }}</div>
        <div>{{ item }}</div>
      </template>
    </RenderlessItemManager>
    <button @click="Customer.name = 'daizo'">aaaa</button>
  </div>
</template>
