<script setup>
import { User } from "air-guard-v2-schemas";
import { reactive, onMounted, onUnmounted } from "vue";

const user = reactive(new User());
const docs = computed(() => user.docs);
const isEditing = ref(false);
const isValid = ref(null);
const manager = ref(null);

const headers = [
  { title: "email", value: "email" },
  { title: "表示名", value: "displayName" },
  { title: "権限", value: "roles" },
  { title: "操作", value: "actions", align: "end", sortable: false },
];

onMounted(() => {
  user.subscribeDocs();
});

onUnmounted(() => {
  user.unsubscribe();
});
</script>

<template>
  <v-container>
    <air-item-manager
      ref="manager"
      :schema="user"
      v-model:isEditing="isEditing"
      v-slot="slotProps"
      :handle-update="async (item) => await item.update()"
    >
      <v-dialog v-bind="slotProps.dialogProps" max-width="480">
        <MoleculesCardsEditor
          label="ユーザー情報編集"
          :disable-submit="!isValid"
          @click:close="slotProps.quitEditing"
          @click:submit="slotProps.submit"
        >
          <MoleculesFormsUser
            v-model="isValid"
            :item="slotProps.item"
            :update-properties="slotProps.updateProperties"
          />
        </MoleculesCardsEditor>
      </v-dialog>
      <v-data-table :items="docs" :headers="headers">
        <template #top>
          <v-toolbar density="compact" flat>
            <v-toolbar-title>ユーザー一覧</v-toolbar-title>
            <v-btn icon="mdi-plus" @click="slotProps.toCreate()"></v-btn>
          </v-toolbar>
        </template>
        <template v-slot:item.actions="{ item }">
          <div class="d-flex ga-2 justify-end">
            <v-icon
              color="medium-emphasis"
              icon="mdi-pencil"
              size="small"
              @click="slotProps.toUpdate(item)"
            ></v-icon>

            <v-icon
              color="medium-emphasis"
              icon="mdi-delete"
              size="small"
              @click="slotProps.toDelete(item)"
            ></v-icon>
          </div>
        </template>
      </v-data-table>
    </air-item-manager>
  </v-container>
</template>
