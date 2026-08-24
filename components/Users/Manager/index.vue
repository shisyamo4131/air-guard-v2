<script setup>
/*****************************************************************************
 * @file ./components/Users/Manager/index.vue
 * @description ユーザー情報管理コンポーネント
 * @author shisyamo4131
 *
 * @update 2026-05-12 - 従業員と紐づいている場合に削除チェックボックスが無効化されるように変更
 *
 *****************************************************************************/
import { User } from "@/schemas";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { useAuthFunctions } from "@/composables/auth/useAuthFunctions";
import { useMessagesStore } from "@/stores/useMessagesStore";
import { ROLE_PRESETS } from "@/constants/rolePresets";
import { useDefaults } from "vuetify";
import UserCardMenu from "./CardMenu.vue";
import { useBaseManager } from "@/composables/useBaseManager";
import { useTargetedMenu } from "@/composables/overlay/useTargetedMenu";
import { useTemporaryUserDeletion } from "@/composables/application/user/useTemporaryUserDeletion";
import { useTemporaryUserCreation } from "@/composables/application/user/useTemporaryUserCreation";
import { useUserFieldUpdates } from "@/composables/application/user/useUserFieldUpdates";
import { useOperationState } from "@/composables/useOperationState";
import { useUserLifecycleOperations } from "@/composables/application/user/useUserLifecycleOperations";
import {
  canChangeUserEnabledState,
  canTransferCompanyAdmin,
} from "@/utils/auth/policies/userManagementUiPolicy";
import { canDeleteStandaloneRegisteredUser } from "@/utils/auth/policies/userLifecycleUiPolicy";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  docs: { type: Array, default: () => [] },
  hideDefaultFooter: { type: Boolean, default: false },
  itemsPerPage: { type: Number, default: 5 },
  search: { type: String, default: null },
  showCreate: { type: Boolean, default: false },
});
const props = useDefaults(_props, "UsersManager");
const emit = defineEmits(["update:search"]);

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const auth = useAuthStore();
const loadings = useLoadingsStore();
const messages = useMessagesStore();
const { enableUser, disableUser } = useAuthFunctions();
const { deleteTemporaryUser, canDelete } = useTemporaryUserDeletion();
const { createStandaloneTemporaryUser, canCreate, canAssignRoles } =
  useTemporaryUserCreation();
const {
  canManageUserFields,
  canUpdateUserRoles,
  updateManagedUser,
} = useUserFieldUpdates();
const { run, isPending } = useOperationState();
const {
  isPending: isLifecyclePending,
  removeStandaloneRegisteredUser,
} = useUserLifecycleOperations();
const { attrs, router, logger } = useBaseManager("UsersManager");

/*****************************************************************************
 * REACTIVE OBJECTS
 *****************************************************************************/
const user = reactive(new User());
const search = ref("");
const toolberMenu = ref(false);
const {
  isOpen: userCardMenu,
  target: userCardMenuTarget,
  context: userCardMenuTargetUser,
  open: openUserCardMenu,
} = useTargetedMenu();
const registeredUserDeletionDialog = ref(false);
const registeredUserDeletionTarget = ref(null);
const registeredUserDeletionForm = ref(null);
const registeredUserDeletionReason = ref("");

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
 * ユーザーアカウントを無効化します。
 * @param user - 無効化するユーザーオブジェクト
 * @return {Promise<void>} - 無効化処理が完了するまでの Promise
 */
async function handleDisableUser(user) {
  return run("disable", user.docId, async () => {
    const key = loadings.add("ユーザーを無効化しています...");
    try {
      await disableUser({ uid: user.docId });
      messages.add("ユーザーアカウントを無効化しました");
    } catch (error) {
      logger.error({ error });
    } finally {
      loadings.remove(key);
    }
  });
}

/**
 * ユーザーアカウントを有効化します。
 * @param user - 有効化するユーザーオブジェクト
 * @return {Promise<void>} - 有効化処理が完了するまでの Promise
 */
async function handleEnableUser(user) {
  return run("enable", user.docId, async () => {
    const key = loadings.add("ユーザーを有効化しています...");
    try {
      await enableUser({ uid: user.docId });
      messages.add("ユーザーアカウントを有効化しました");
    } catch (error) {
      logger.error({ error });
    } finally {
      loadings.remove(key);
    }
  });
}

/**
 * AirArrayManager の handle-create に渡す関数
 * - server側の予約transactionを使って仮登録Userを作成します。
 * @param item
 */
async function handleCreate(item) {
  await createStandaloneTemporaryUser(item);
}

/**
 * 仮登録UserをCallable経由で削除します。
 * @param {User} item - 削除対象の仮登録User
 */
async function handleDelete(item) {
  await deleteTemporaryUser(item);
}

/** User管理fieldだけを専用Callableへ送信します。 */
async function handleUpdate(item) {
  await updateManagedUser(item);
}

function canChangeEnabledState(targetUser) {
  return canChangeUserEnabledState({
    companyId: auth.companyId,
    actorUid: auth.uid,
    actorUser: auth.user,
    targetUser,
  });
}

function isEnabledStatePending(targetUser) {
  if (!targetUser?.docId) return false;
  return (
    isPending("enable", targetUser.docId) ||
    isPending("disable", targetUser.docId)
  );
}

function canTransferAdmin() {
  return canTransferCompanyAdmin({
    companyId: auth.companyId,
    actorUid: auth.uid,
    actorUser: auth.user,
  });
}

function canDeleteRegisteredUser(targetUser) {
  return canDeleteStandaloneRegisteredUser({
    companyId: auth.companyId,
    actorUid: auth.uid,
    actorUser: auth.user,
    isSuperUser: auth.isSuperUser,
    targetUser,
  });
}

function hasUserCardActions(targetUser) {
  return canChangeEnabledState(targetUser) || canDeleteRegisteredUser(targetUser);
}

function isUserCardActionPending(targetUser) {
  if (!targetUser?.docId) return false;
  return (
    isEnabledStatePending(targetUser) ||
    isLifecyclePending("delete-registered-user", targetUser.docId)
  );
}

function openRegisteredUserDeletion(targetUser) {
  userCardMenu.value = false;
  if (!canDeleteRegisteredUser(targetUser)) return;
  registeredUserDeletionTarget.value = targetUser;
  registeredUserDeletionReason.value = "";
  registeredUserDeletionDialog.value = true;
}

async function handleRegisteredUserDeletion() {
  const targetUser = registeredUserDeletionTarget.value;
  if (
    !canDeleteRegisteredUser(targetUser) ||
    isLifecyclePending("delete-registered-user", targetUser.docId)
  ) {
    return;
  }
  const validation = await registeredUserDeletionForm.value?.validate();
  if (!validation?.valid) return;
  const key = loadings.add("ユーザーアカウントを削除しています...");
  try {
    await removeStandaloneRegisteredUser({
      targetUserId: targetUser.docId,
      reason: registeredUserDeletionReason.value,
    });
    registeredUserDeletionDialog.value = false;
    registeredUserDeletionTarget.value = null;
    messages.add("ユーザーアカウントを削除しました。");
  } catch (error) {
    logger.error({ error });
  } finally {
    loadings.remove(key);
  }
}

function resolveExcludedKeys(item) {
  if (!item.docId) {
    return canAssignRoles() ? [] : ["roles"];
  }

  return [
    "email",
    "displayName",
    "employeeId",
    "disabled",
    "companyId",
    "isAdmin",
    "isTemporary",
    "tagSize",
    ...(canUpdateUserRoles(item) ? [] : ["roles"]),
  ];
}
</script>

<template>
  <air-array-manager
    v-bind="attrs"
    :model-value="props.docs"
    :schema="User"
    :before-edit="
      (editMode, item) => {
        item.companyId = auth.companyId;
      }
    "
    :handle-create="handleCreate"
    :handle-update="handleUpdate"
    :handle-delete="handleDelete"
    :disable-delete="(item) => !canDelete(item)"
    :excluded-keys="resolveExcludedKeys"
  >
    <!-- 役割選択 UI -->
    <template #[`input.roles`]="inputProps">
      <v-card v-if="canAssignRoles()" border variant="flat" class="mb-4">
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
      <v-toolbar class="ps-3 mb-4">
        <AtomsSearchTextField
          :model-value="search"
          @update:model-value="(value) => (search = value)"
        />
        <v-btn
          :disabled="!canCreate()"
          icon="mdi-plus"
          @click="() => tableProps.toCreate()"
        />
        <v-menu v-if="canTransferAdmin()" v-model="toolberMenu">
          <template #activator="{ props: activatorProps }">
            <v-btn v-bind="activatorProps" icon="mdi-dots-vertical" />
          </template>
          <v-list density="compact" slim>
            <OrganismsChangeAdminUserDialog
              @complete="router.push('/dashboard')"
            >
              <template #activator="{ props: dialogProps }">
                <v-list-item v-bind="dialogProps" title="管理者変更" />
              </template>
            </OrganismsChangeAdminUserDialog>
          </v-list>
        </v-menu>
      </v-toolbar>
      <UsersIterator
        class="flex-grow-1 flex-shrink-0"
        grid
        :users="tableProps.items"
        :hide-default-footer="props.hideDefaultFooter"
        :items-per-page="props.itemsPerPage"
        :show-create="props.showCreate && canCreate()"
        :show-edit="() => canManageUserFields()"
        @click:create="() => tableProps.toCreate()"
        @click:edit="(item) => tableProps.toUpdate(item)"
      >
        <template #card-append="{ item }">
          <v-btn
            v-if="hasUserCardActions(item)"
            :disabled="isUserCardActionPending(item)"
            :loading="isUserCardActionPending(item)"
            icon="mdi-dots-vertical"
            size="small"
            @click="(event) => openUserCardMenu(event, item)"
          />
        </template>
      </UsersIterator>
      <UserCardMenu
        v-model="userCardMenu"
        :target="userCardMenuTarget"
        :user="userCardMenuTargetUser"
        :loading="isUserCardActionPending(userCardMenuTargetUser)"
        :show-enabled-state="canChangeEnabledState(userCardMenuTargetUser)"
        :show-delete="canDeleteRegisteredUser(userCardMenuTargetUser)"
        :offset="[-8, -12]"
        location="bottom start"
        scroll-strategy="close"
        @click:enable="handleEnableUser"
        @click:disable="handleDisableUser"
        @click:delete="openRegisteredUserDeletion"
      />
      <v-dialog v-model="registeredUserDeletionDialog" max-width="520" persistent>
        <v-card>
          <v-toolbar color="error" density="compact" title="アカウント削除" />
          <v-card-text>
            <p>
              {{ registeredUserDeletionTarget?.displayName || "対象ユーザー" }}
              の本登録UserとAuthを物理削除します。
            </p>
            <v-form
              ref="registeredUserDeletionForm"
              class="mt-4"
              @submit.prevent="handleRegisteredUserDeletion"
            >
              <v-text-field
                v-model="registeredUserDeletionReason"
                label="削除理由"
                maxlength="20"
                :rules="[
                  (value) => !!value || '削除理由は必須です。',
                  (value) =>
                    value?.trim() === value ||
                    '理由の前後に空白は使用できません。',
                  (value) =>
                    value?.length <= 20 || '理由は20文字以内で入力してください。',
                ]"
              />
            </v-form>
            <v-alert type="warning" density="compact">
              この操作は元に戻せません。必要になった場合は新しいUserとして再登録してください。
            </v-alert>
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn
              :disabled="
                isLifecyclePending(
                  'delete-registered-user',
                  registeredUserDeletionTarget?.docId || 'none',
                )
              "
              text="キャンセル"
              @click="registeredUserDeletionDialog = false"
            />
            <v-btn
              color="error"
              :disabled="
                isLifecyclePending(
                  'delete-registered-user',
                  registeredUserDeletionTarget?.docId || 'none',
                )
              "
              :loading="
                isLifecyclePending(
                  'delete-registered-user',
                  registeredUserDeletionTarget?.docId || 'none',
                )
              "
              text="削除する"
              @click="handleRegisteredUserDeletion"
            />
          </v-card-actions>
        </v-card>
      </v-dialog>
    </template>
  </air-array-manager>
</template>
