<script setup>
/**
 * @file UsersManager.vue
 * @description ユーザー管理コンポーネント
 */
import { User } from "air-guard-v2-schemas";
import { reactive, onMounted, onUnmounted } from "vue";

/** ストア連携 */
const auth = useAuthStore();

const user = reactive(new User());
const docs = computed(() => user.docs);
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

/**
 * ユーザーアカウント追加処理
 * @param item
 */
async function handleCreate(item) {
  await auth.createUserInCompany({
    ...item,
    password: password.value,
  });
}

async function handleDisableUser(item) {
  await auth.disableUser({ uid: item.docId });
}

async function handleEnableUser(item) {
  await auth.enableUser({ uid: item.docId });
}

/**
 * パスワードの初期化処理
 */
function initPassword() {
  password.value = "";
  confirmPassword.value = "";
}
</script>

<template>
  <ItemManager
    :schema="user"
    v-slot="slotProps"
    :handle-create="handleCreate"
    label="ユーザー情報"
    @initialized="initPassword"
  >
    <v-dialog v-bind="slotProps.dialogProps">
      <MoleculesCardsEditor v-bind="slotProps.editorProps">
        <air-item-input v-bind="slotProps" :schema="User.schema" />
        <v-row>
          <v-col>
            <air-password
              v-if="slotProps.isCreate"
              label="パスワード"
              required
              :rules="[
                (v) =>
                  !v ||
                  v.length >= 8 ||
                  'パスワードは8文字以上で入力してください。',
                (v) => v === password || 'パスワードが一致しません。',
              ]"
              counter
              v-model="password"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col>
            <air-password
              v-if="slotProps.isCreate"
              label="確認用パスワード"
              required
              :rules="[(v) => v === password || 'パスワードが一致しません。']"
              v-model="confirmPassword"
            />
          </v-col>
        </v-row>
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
          <v-btn size="x-small" @click="handleEnableUser(item)">有効化</v-btn>
          <v-btn size="x-small" @click="handleDisableUser(item)">無効化</v-btn>
        </div>
      </template>
    </v-data-table>
  </ItemManager>
</template>
