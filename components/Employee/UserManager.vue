<script setup>
/*****************************************************************************
 * @file ./components/Employee/UserManager/index.vue
 * @description 従業員/ユーザー情報管理コンポーネント
 * - 従業員詳細画面で使用することを前提としたユーザー情報管理コンポーネント
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { User } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";
import { useAuthStore } from "@/stores/useAuthStore";
import { useTemporaryUserDeletion } from "@/composables/application/user/useTemporaryUserDeletion";
import { useTemporaryUserCreation } from "@/composables/application/user/useTemporaryUserCreation";
import { ROLE_PRESETS } from "@/constants/rolePresets";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  employee: { type: Object, required: true },
  user: { type: Object, required: true },
});
const props = useDefaults(_props, "EmployeeUserManager");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { attrs } = useBaseManager("EmployeeUserManager");
const auth = useAuthStore();
const { deleteTemporaryUser, getDeleteControl } =
  useTemporaryUserDeletion();
const { createEmployeeLinkedTemporaryUser, canCreate, canAssignRoles } =
  useTemporaryUserCreation();

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const isUser = ref(false);

watch(
  () => props.user,
  (newValue) => {
    isUser.value = !!newValue.docId;
  },
  { immediate: true, deep: true },
);

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const deleteControl = computed(() => {
  return getDeleteControl(props.user, {
    employeeId: props.employee.docId,
  });
});
const excludedKeys = computed(() => [
  "displayName",
  "tagSize",
  "receiveConfirmedArrangementNotification",
  "receiveArrivedArrangementNotification",
  "receiveLeavedArrangementNotification",
  ...(canAssignRoles() ? [] : ["roles"]),
]);
const roleOptions = computed(() =>
  Object.entries(ROLE_PRESETS).map(([value, preset]) => ({
    value,
    title: preset.label,
    description: preset.description,
    icon: preset.icon,
  })),
);

/*****************************************************************************
 * METHODS
 *****************************************************************************/
async function handleAction(createFn) {
  if (!canCreate()) return;
  const newUser = new User({
    displayName: props.employee.displayName,
    employeeId: props.employee.docId,
    companyId: auth.companyId,
    roles: [],
  });
  return await createFn(newUser);
}

/**
 * AirArrayManager の handle-create に渡す関数
 * - Employee IDと入力email/rolesだけをCallableへ送信します。
 * @param item
 */
async function handleCreate(item) {
  await createEmployeeLinkedTemporaryUser(item, {
    employeeId: props.employee.docId,
  });
}

/**
 * AirArrayManager の handle-delete に渡す関数
 * @param item
 */
async function handleDelete(item) {
  await deleteTemporaryUser(item, {
    employeeId: props.employee.docId,
  });
}
</script>

<template>
  <air-item-manager
    v-bind="attrs"
    :model-value="user"
    :handle-create="handleCreate"
    :handle-update="
      () => {
        throw new Error(
          'このコンポーネントでユーザー情報を更新することはできません。',
        );
      }
    "
    :handle-delete="handleDelete"
    :excluded-keys="excludedKeys"
    hide-delete-btn
  >
    <template #[`input.roles`]="inputProps">
      <v-card v-if="canAssignRoles()" border variant="flat" class="mb-4">
        <v-card-title class="text-subtitle-1">
          <v-icon icon="mdi-shield-account" class="mr-2" />
          役割の設定
        </v-card-title>
        <v-card-subtitle class="text-caption text-wrap">
          必要な役割を選択してください。未選択でも登録できます。
        </v-card-subtitle>
        <v-card-text>
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

    <template #activator="{ toCreate, toDelete }">
      <v-card>
        <v-toolbar title="ユーザー情報" color="secondary" density="compact" />
        <v-card-text>
          <div v-if="isUser">
            <div class="d-flex flex-column pb-2">
              <small class="text-medium-emphasis">メールアドレス</small>
              <div class="text-right text-body-2" style="min-height: 24px">
                {{ props.user.email }}
              </div>
            </div>
            <div class="d-flex flex-column pb-2">
              <small class="text-medium-emphasis">状態</small>
              <div class="text-right text-body-2" style="min-height: 24px">
                <v-chip
                  v-if="props.user.isTemporary"
                  color="warning"
                  size="small"
                  text="仮登録"
                />
                <v-chip
                  v-else-if="props.user.disabled"
                  size="small"
                  text="無効"
                />
                <v-chip v-else color="info" size="small" text="有効" />
              </div>
            </div>
          </div>
          <v-empty-state
            v-else
            title="ユーザー未登録"
            icon="mdi-account-off"
            :action-text="canCreate() ? 'ユーザーを登録する' : undefined"
            @click:action="() => handleAction(toCreate)"
          >
            <template #text>
              <div>この従業員はユーザー登録が完了していません。</div>
              <div>
                ユーザーを登録すると、従業員はAirGuardにログインできるようになります。
              </div>
            </template>
          </v-empty-state>
        </v-card-text>
        <v-card-actions v-if="isUser">
          <v-btn
            block
            color="warning"
            :disabled="deleteControl.disabled"
            variant="flat"
            text="ユーザーアカウント削除"
            @click="() => toDelete()"
          />
        </v-card-actions>
      </v-card>
    </template>
  </air-item-manager>
</template>
