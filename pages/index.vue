<script setup>
import { User } from "air-guard-v2-schemas";
const UserModel = new User();
const dialog = ref(false);
async function test() {
  const Model = new User({ email: "maruyama@yuisin.net" });
  await Model.create();
}
</script>

<template>
  <RenderlessItemManager v-model="UserModel" :is-editing="dialog">
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
          <v-card-title>User</v-card-title>
          <v-card-text>
            {{ UserModel }}
            <v-btn @click="test">test</v-btn>
          </v-card-text>
          <v-card-actions>
            <v-dialog :model-value="isEditing" @update:modelValue="quitEditing">
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
                    :model-value="item.email"
                    variant="outlined"
                    @update:model-value="updateProperties({ email: $event })"
                  />
                  <v-checkbox
                    :model-value="item.isAdmin"
                    @update:model-value="updateProperties({ isAdmin: $event })"
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
      <div>{{ UserModel }}</div>
      <div>{{ item }}</div>
    </template>
  </RenderlessItemManager>
</template>
