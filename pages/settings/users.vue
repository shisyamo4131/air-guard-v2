<script setup>
/**
 * @file users.vue
 * @description ユーザー管理画面
 */
import { User } from "air-guard-v2-schemas";
import { reactive, onMounted, onUnmounted } from "vue";

/** auth との連携の為に useAuthStore を使用 */
const auth = useAuthStore();

const user = reactive(new User());
const docs = computed(() => user.docs);
const isEditing = ref(false);
const isValid = ref(null);
const manager = ref(null);

// --- 入力コンポーネントの定義 ---
const schema = Object.entries(User.classProps).map(([key, value]) => {
  return { key, ...value };
});

/** ユーザー追加時の為のパスワード用変数 */
const password = ref("");
const confirmPassword = ref("");

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

async function handleCreate(item) {
  await auth.createUserInCompany({
    ...item,
    password: password.value,
  });
}

function initialized() {
  password.value = "";
  confirmPassword.value = "";
}
</script>

<template>
  <v-container>
    <ItemManager
      ref="manager"
      :schema="user"
      v-model:isEditing="isEditing"
      v-slot="slotProps"
      :handle-create="handleCreate"
      @initialized="initialized"
    >
      <v-dialog v-bind="slotProps.dialogProps">
        <MoleculesCardsEditor
          label="ユーザー情報編集"
          @click:close="slotProps.quitEditing"
          @click:submit="slotProps.submit"
        >
          <air-item-input
            :item="slotProps.item"
            :update-properties="slotProps.updateProperties"
            :schema="schema"
          >
            <template #roles="{ modelValue, updateModelValue }">
              <v-checkbox
                :model-value="modelValue"
                label="管理者"
                disabled
                value="admin"
                @update:model-value="updateModelValue"
              />
            </template>
          </air-item-input>
          <air-password
            v-if="slotProps.isCreate"
            label="パスワード"
            required
            v-model="password"
          />
          <air-password
            v-if="slotProps.isCreate"
            label="確認用パスワード"
            required
            v-model="confirmPassword"
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
    </ItemManager>
  </v-container>
</template>
