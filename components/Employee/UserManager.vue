<script setup>
/*****************************************************************************
 * @file ./components/Employee/UserManager/index.vue
 * @description 従業員/ユーザー情報管理コンポーネント
 * - 従業員詳細画面で使用することを前提としたユーザー情報管理コンポーネント
 *****************************************************************************/
import { User } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLogger } from "@/composables/useLogger";
import { useTemporaryUserDeletion } from "@/composables/application/user/useTemporaryUserDeletion";
import { useTemporaryUserCreation } from "@/composables/application/user/useTemporaryUserCreation";
import { ROLE_PRESETS } from "@shisyamo4131/air-guard-v2-schemas/constants";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const props = defineProps({
  employee: { type: Object, required: true },
  user: { type: Object, required: true },
});

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const auth = useAuthStore();
const logger = useLogger("EmployeeUserManager", useErrorsStore());
const { deleteTemporaryUser, getDeleteControl } =
  useTemporaryUserDeletion();
const { createEmployeeLinkedTemporaryUser, canCreate, canAssignRoles } =
  useTemporaryUserCreation();

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const dialog = ref(false);
const editMode = ref("CREATE");
const busy = ref(false);
const draft = ref(new User());

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const deleteControl = computed(() => {
  return getDeleteControl(props.user, {
    employeeId: props.employee.docId,
  });
});
const isUser = computed(() => Boolean(props.user.docId));
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
function createDraft(value = {}) {
  return new User(value?.toObject?.() ?? value);
}

function updateDraft(changes) {
  if (!changes || typeof changes !== "object") return;
  for (const [key, value] of Object.entries(changes)) {
    if (key in draft.value) draft.value[key] = value;
  }
}

function openCreate() {
  if (!canCreate()) return;
  draft.value = createDraft({
    displayName: props.employee.displayName,
    employeeId: props.employee.docId,
    companyId: auth.companyId,
    roles: [],
  });
  editMode.value = "CREATE";
  dialog.value = true;
}

function openDelete() {
  if (deleteControl.value.disabled || busy.value) return;
  draft.value = createDraft(props.user);
  editMode.value = "DELETE";
  dialog.value = true;
}

function closeDialog() {
  if (!busy.value) dialog.value = false;
}

/**
 * - Employee IDと入力email/rolesだけをCallableへ送信します。
 * @param item
 */
async function handleCreate(item) {
  await createEmployeeLinkedTemporaryUser(item, {
    employeeId: props.employee.docId,
  });
}

/**
 * @param item
 */
async function handleDelete(item) {
  await deleteTemporaryUser(item, {
    employeeId: props.employee.docId,
  });
}

async function submit() {
  if (busy.value) return;
  busy.value = true;
  logger.clearError();
  try {
    if (editMode.value === "CREATE") await handleCreate(draft.value);
    else await handleDelete(draft.value);
    dialog.value = false;
  } catch (error) {
    logger.error({ error });
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div>
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
            @click:action="openCreate"
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
            @click="openDelete"
          />
        </v-card-actions>
    </v-card>

    <v-dialog
      v-model="dialog"
      max-width="480"
      persistent
      scrollable
      transition="dialog-bottom-transition"
    >
      <air-edit-card
        :disabled="busy || editMode === 'DELETE'"
        :edit-mode="editMode"
        :is-create="editMode === 'CREATE'"
        :is-delete="editMode === 'DELETE'"
        :is-loading="busy"
        label="ユーザー"
        hide-delete-btn
        @click:close="closeDialog"
        @click:submit="submit"
        @error="({ message }) => logger.error({ error: new Error(message) })"
        @error:clear="logger.clearError"
      >
        <air-item-input
          :item="draft"
          :schema="User.schema"
          :excluded-keys="excludedKeys"
          :disabled="busy || editMode === 'DELETE'"
          :edit-mode="editMode"
          :is-create="editMode === 'CREATE'"
          :is-delete="editMode === 'DELETE'"
          :update-properties="updateDraft"
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
                  :model-value="draft.roles"
                  column
                  multiple
                  :disabled="busy || editMode === 'DELETE'"
                  @update:modelValue="updateDraft({ roles: $event })"
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
        </air-item-input>
      </air-edit-card>
    </v-dialog>
  </div>
</template>
