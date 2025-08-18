<script setup>
/**
 * @file UsersManager.vue
 * @description ユーザー管理コンポーネント
 */
import { User } from "@/schemas/User.js";
import { reactive, onMounted, onUnmounted } from "vue";

/** ストア連携 */
const auth = useAuthStore();

const user = reactive(new User());
const docs = ref([]);
const password = ref("");
const confirmPassword = ref("");

const headers = [
  { title: "email", value: "email" },
  { title: "表示名", value: "displayName" },
  { title: "管理者", value: "roles" },
  { title: "操作", value: "actions", align: "end", sortable: false },
];

onMounted(() => {
  docs.value = user.subscribeDocs();
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
  <v-container>
    <array-manager
      v-model="docs"
      :schema="User"
      v-slot="slotProps"
      :handle-create="handleCreate"
      @submit:complete="initPassword"
    >
      <air-data-table v-bind="slotProps.tableProps">
        <template v-slot:item.roles="{ item }">
          <v-icon v-if="item.roles.includes('admin')" color="primary"
            >mdi-check</v-icon
          >
        </template>
        <template v-slot:item.actions="{ item }">
          <div class="d-flex ga-2 justify-end">
            <v-btn
              color="primary"
              :disabled="!item.disabled"
              size="x-small"
              @click="handleEnableUser(item)"
              >有効化</v-btn
            >
            <v-btn
              color="medium-emphasis"
              :disabled="item.disabled || item.docId === auth.uid"
              size="x-small"
              @click="handleDisableUser(item)"
              >無効化</v-btn
            >
          </div>
        </template>
      </air-data-table>
      <v-dialog v-bind="slotProps.dialogProps">
        <MoleculesCardsEdit v-bind="slotProps.editorProps">
          <air-item-input v-bind="slotProps.inputProps" />
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
        </MoleculesCardsEdit>
      </v-dialog>
    </array-manager>
  </v-container>
</template>
