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
import { useRolePresets } from "@/composables/useRolePresets";

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const router = useRouter();
const auth = useAuthStore();
const loadings = useLoadingsStore();
const messages = useMessagesStore();
const logger = useLogger("UsersManager", useErrorsStore());
const { changeAdminUser, enableUser, disableUser } = useAuthFunctions();
const { ROLE_PRESETS } = useRolePresets();

/*****************************************************************************
 * REACTIVE OBJECTS
 *****************************************************************************/
const user = reactive(new User());
const isLoading = ref(false);

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
/**
 * プリセット役割の選択肢を生成
 * admin と super-user は除外
 */
const roleOptions = computed(() => {
  return Object.entries(ROLE_PRESETS).map(([key, preset]) => ({
    value: key,
    title: preset.label,
    description: preset.description,
    icon: preset.icon,
  }));
});

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
    messages.add("ユーザーアカウントを無効化しました");
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
    messages.add("ユーザーアカウントを有効化しました");
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
    messages.add("管理者権限の移譲に成功しました！");
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
    :disable-delete="(item) => !!item.isAdmin"
    :is-loading="isLoading"
    :excluded-keys="
      (item) => {
        return item.isAdmin ? ['roles'] : [];
      }
    "
    :table-props="{
      headers: [
        { title: 'email', key: 'email' },
        { title: '表示名', key: 'displayName' },
        { title: '役割', key: 'roles', sortable: false },
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

    <!-- 役割選択 UI -->
    <template #input.roles="inputProps">
      <v-card border variant="flat" class="mb-4">
        <v-card-title class="text-subtitle-1">
          <v-icon icon="mdi-shield-account" class="mr-2" />
          役割の設定
        </v-card-title>
        <v-card-subtitle class="text-caption text-wrap">
          ユーザーに割り当てる役割を選択してください。複数選択可能です。
        </v-card-subtitle>
        <v-card-text>
          <!-- プリセット役割 -->
          <v-chip-group
            :model-value="inputProps.item.roles"
            column
            multiple
            @update:modelValue="inputProps.updateProperties({ roles: $event })"
          >
            <v-chip
              v-for="option in roleOptions"
              :key="option.value"
              :value="option.value"
              :prepend-icon="option.icon"
              filter
              variant="flat"
              color="primary"
            >
              {{ option.title }}
              <v-tooltip activator="parent" location="bottom">
                {{ option.description }}
              </v-tooltip>
            </v-chip>
          </v-chip-group>
        </v-card-text>
      </v-card>
    </template>

    <template #table="tableProps">
      <air-data-table v-bind="tableProps">
        <!-- 役割列の表示 -->
        <template #item.roles="{ item }">
          <div v-if="item.roles?.length > 0" class="d-flex flex-wrap ga-1">
            <v-chip
              v-for="role in item.roles"
              :key="role"
              size="x-small"
              color="primary"
            >
              {{ roleOptions.find((opt) => opt.value === role)?.title || role }}
            </v-chip>
          </div>
          <span v-else class="text-medium-emphasis text-caption">
            役割なし
          </span>
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

        <template #item.actions="{ item }">
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
              <template #prepend>
                <v-icon color="white"></v-icon>
              </template>
            </v-btn>
          </div>
        </template>
      </air-data-table>
    </template>
  </air-array-manager>
</template>
