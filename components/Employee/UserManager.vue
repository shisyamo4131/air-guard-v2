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
import { useAuthFunctions } from "@/composables/auth/useAuthFunctions";

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
const { checkEmailAvailabilityGlobal } = useAuthFunctions();

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
const isAdmin = computed(() => {
  return props.user.isAdmin;
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
async function handleAction(createFn) {
  const newUser = new User({
    ...props.employee,
    employeeId: props.employee.docId,
    companyId: auth.companyId,
  });
  return await createFn(newUser);
}

/**
 * AirArrayManager の handle-create に渡す関数
 * - ユーザー作成前にメールアドレスのグローバルチェックを行います。
 * @param item
 */
async function handleCreate(item) {
  await checkEmailAvailabilityGlobal(item.email);
  await item.create();
}

/**
 * AirArrayManager の handle-delete に渡す関数
 * @param item
 */
async function handleDelete(item) {
  await item.delete();
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
    :excluded-keys="['roles', 'tagSize']"
    hide-delete-btn
  >
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
            action-text="ユーザーを登録する"
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
            :disabled="isAdmin"
            variant="flat"
            text="ユーザーアカウント削除"
            @click="() => toDelete()"
          />
        </v-card-actions>
      </v-card>
    </template>
  </air-item-manager>
</template>
