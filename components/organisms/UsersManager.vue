<script setup>
/**
 * @file UsersManager.vue
 * @description A component for managing users.
 */
import { reactive, onMounted, onUnmounted } from "vue";
import { User } from "@/schemas";
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";

/*****************************************************************************
 * DEFINE STORES & COMPOSABLES
 *****************************************************************************/
const auth = useAuthStore();
const { error, clearError } = useLogger("UsersManager", useErrorsStore());

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const user = reactive(new User());
const password = ref("");
const confirmPassword = ref("");

/*****************************************************************************
 * LIFECYCLE HOOKS
 *****************************************************************************/
onMounted(() => {
  user.subscribeDocs();
});

onUnmounted(() => {
  user.unsubscribe();
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * Create a new user.
 * - Use the `createUserInCompany` method from the `auth` store to create a new user.
 * @param item
 */
async function handleCreate(item) {
  clearError();
  try {
    await auth.createUserInCompany({
      ...item,
      password: password.value,
    });
  } catch (err) {
    error({ error: err, message: "Failed to create user." });
  }
}

/**
 * Disable a user account.
 * @param item - User item to be disabled
 */
async function handleDisableUser(item) {
  clearError();
  try {
    await auth.disableUser({ uid: item.docId });
  } catch (err) {
    error({ error: err, message: "Failed to disable user." });
  }
}

/**
 * Enable a user account.
 * @param item - User item to be enabled
 */
async function handleEnableUser(item) {
  clearError();
  try {
    await auth.enableUser({ uid: item.docId });
  } catch (err) {
    error({ error: err, message: "Failed to enable user." });
  }
}

/**
 * Initialize password fields.
 */
function initPassword() {
  password.value = "";
  confirmPassword.value = "";
}
</script>

<template>
  <air-array-manager
    :model-value="user.docs"
    :schema="User"
    disable-delete
    :handle-create="handleCreate"
    :handle-update="(item) => item.update()"
    @initialized="initPassword"
    @submit:complete="initPassword"
    @error="error"
    @error:clear="clearError"
  >
    <template #table="tableProps">
      <air-data-table v-bind="tableProps">
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
            <v-btn
              prepend-icon="mdi-pencil"
              color="secondary"
              :disabled="item.disabled"
              size="x-small"
              @click="tableProps.toUpdate(item)"
              >編集
              <template v-slot:prepend>
                <v-icon color="white"></v-icon>
              </template>
            </v-btn>
          </div>
        </template>
      </air-data-table>
    </template>
    <template #input-footer="inputProps">
      <v-col v-if="inputProps.isCreate" cols="12">
        <air-password
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
      <v-col v-if="inputProps.isCreate" cols="12">
        <air-password
          label="確認用パスワード"
          required
          :rules="[(v) => v === password || 'パスワードが一致しません。']"
          v-model="confirmPassword"
        />
      </v-col>
    </template>
  </air-array-manager>
</template>
