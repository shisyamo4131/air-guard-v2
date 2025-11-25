<script setup>
/**
 * @file components/organisms/UsersManager.vue
 * @description A component to manage users.
 */
import { useRouter } from "vue-router";
import { User } from "@/schemas";
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { useAuthFunctions } from "@/composables/auth/useAuthFunctions";
import { useMessagesStore } from "@/stores/useMessagesStore";

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const router = useRouter();
const auth = useAuthStore();
const loadings = useLoadingsStore();
const messages = useMessagesStore();
const logger = useLogger("UsersManager", useErrorsStore());
const { changeAdminUser, enableUser, disableUser } = useAuthFunctions();

/*****************************************************************************
 * REACTIVE OBJECTS
 *****************************************************************************/
const user = reactive(new User());
const isLoading = ref(false);

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
 * Disable a user account.
 * @param item - User item to be disabled
 */
async function handleDisableUser(item) {
  const key = loadings.add("ユーザーを無効化しています...");
  try {
    isLoading.value = true;
    await disableUser({ uid: item.docId });
    messages.add({
      text: "ユーザーアカウントを無効化しました",
      color: "success",
    });
  } catch (error) {
    logger.error({ error });
  } finally {
    isLoading.value = false;
    loadings.remove(key);
  }
}

/**
 * Enable a user account.
 * @param item - User item to be enabled
 */
async function handleEnableUser(item) {
  const key = loadings.add("ユーザーを有効化しています...");
  try {
    isLoading.value = true;
    await enableUser({ uid: item.docId });
    messages.add({
      text: "ユーザーアカウントを有効化しました",
      color: "success",
    });
  } catch (error) {
    logger.error({ error });
  } finally {
    isLoading.value = false;
    loadings.remove(key);
  }
}

async function handleDelete(item) {
  try {
    if (item.isAdmin) {
      throw new Error("管理者ユーザーは削除できません。");
    } else {
      await item.delete();
    }
  } catch (error) {
    logger.error({ error });
  }
}

async function handleChangeAdminUser(item) {
  const key = loadings.add("管理者権限を移譲しています...");
  try {
    isLoading.value = true;
    await changeAdminUser({ from: auth.uid, to: item.docId });
    messages.add({
      text: "管理者権限の移譲に成功しました！",
      color: "success",
    });
    router.push("/dashboard");
  } catch (error) {
    logger.error({ error });
  } finally {
    isLoading.value = false;
    loadings.remove(key);
  }
}
</script>

<template>
  <air-array-manager
    :model-value="user.docs"
    :schema="User"
    :before-edit="
      (editMode, item) => {
        item.companyId = auth.companyId;
      }
    "
    :handle-create="(item) => item.create()"
    :handle-update="(item) => item.update()"
    :handle-delete="handleDelete"
    :is-loading="isLoading"
    :table-props="{
      headers: [
        { title: 'email', key: 'email' },
        { title: '表示名', key: 'displayName' },
        { title: '管理者', key: 'isAdmin' },
        { title: '状態', key: 'disabled' },
      ],
    }"
    @error="(error) => logger.error({ error })"
    @error:clear="() => logger.clearError()"
  >
    <template #input.email="inputProps">
      <air-text-field
        v-bind="inputProps.attrs"
        :disabled="
          inputProps.editMode !== 'CREATE' && !inputProps.item.isTemporary
        "
        label="email"
        required
        input-type="email"
      />
    </template>
    <template #table="tableProps">
      <air-data-table v-bind="tableProps">
        <template v-slot:item.roles="{ item }">
          <v-icon v-if="item.roles.includes('admin')" color="primary"
            >mdi-check</v-icon
          >
        </template>
        <template #item.isAdmin="{ item }">
          <v-icon v-if="item.isAdmin" icon="mdi-check" color="primary" />
          <v-btn
            v-if="
              auth.isAdmin &&
              !item.isAdmin &&
              !item.isTemporary &&
              !item.disabled
            "
            color="primary"
            :disabled="isLoading"
            :loading="isLoading"
            size="x-small"
            @click="handleChangeAdminUser(item)"
            >移譲</v-btn
          >
        </template>
        <template #item.disabled="{ item }">
          <span v-if="item.isTemporary">仮登録</span>
          <span v-else-if="item.disabled">無効</span>
          <span v-else>有効</span>
        </template>
        <template v-slot:item.actions="{ item }">
          <div class="d-flex ga-2 justify-end">
            <v-btn
              color="primary"
              :disabled="!item.disabled || item.isTemporary || isLoading"
              :loading="isLoading"
              size="x-small"
              @click="handleEnableUser(item)"
              >有効化</v-btn
            >
            <v-btn
              color="medium-emphasis"
              :disabled="
                item.disabled ||
                item.isTemporary ||
                item.docId === auth.uid ||
                isLoading
              "
              :loading="isLoading"
              size="x-small"
              @click="handleDisableUser(item)"
              >無効化</v-btn
            >
            <v-btn
              prepend-icon="mdi-pencil"
              color="secondary"
              :disabled="item.disabled || isLoading"
              :loading="isLoading"
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
  </air-array-manager>
</template>
