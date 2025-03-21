<script setup>
import FireModel from "../air-firebase-v2/fire-model/src/FireModel";
import User from "../schemas/User";
const dialog = ref(false);
console.log("adapter used in:", FireModel);
console.log("current adapter is:", FireModel.getAdapter());
async function test() {
  const Model = new User();
  await Model.create();
}
</script>

<template>
  <RenderlessItemManager v-model="Model" :is-editing="dialog">
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
            {{ Model }}
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
      <div>{{ Model }}</div>
      <div>{{ item }}</div>
    </template>
  </RenderlessItemManager>
</template>
