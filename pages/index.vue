<script setup>
import User from "../models/User";
const dialog = ref(false);
const Model = new User();
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
