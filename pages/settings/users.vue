<script setup>
import { User } from "air-guard-v2-schemas";
import { reactive, onMounted, onUnmounted } from "vue";

const user = reactive(new User());
const docs = computed(() => user.docs);
const isEditing = ref(false);
const manager = ref(null);

const headers = [
  { title: "email", value: "email" },
  { title: "表示名", value: "displayName" },
  { title: "権限", value: "roles" },
  { title: "操作", value: "actions" },
];

onMounted(() => {
  user.subscribeDocs();
});

onUnmounted(() => {
  user.unsubscribe();
});

function edit(item) {
  user.initialize(item);
  manager.value.toUpdate();
}
</script>

<template>
  <v-container>
    <air-item-manager
      ref="manager"
      v-model="user"
      v-model:isEditing="isEditing"
      v-slot="slotProps"
    >
      <v-dialog v-bind="slotProps.dialogProps" max-width="480">
        <v-card>
          <v-card-title>test</v-card-title>
          <v-card-text>
            <MoleculesFormsUser
              :item="slotProps.item"
              :update-properties="slotProps.updateProperties"
            />
          </v-card-text>
          <v-card-actions>
            <v-btn @click="slotProps.quitEditing">close</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
      <v-data-table :items="docs" :headers="headers">
        <template v-slot:item.actions="{ item }">
          <div class="d-flex ga-2 justify-end">
            <v-icon
              color="medium-emphasis"
              icon="mdi-pencil"
              size="small"
              @click="edit(item)"
            ></v-icon>

            <v-icon
              color="medium-emphasis"
              icon="mdi-delete"
              size="small"
            ></v-icon>
          </div>
        </template>
      </v-data-table>
    </air-item-manager>
  </v-container>
</template>
