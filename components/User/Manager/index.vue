<script setup>
/*****************************************************************************
 * @file ./components/User/Manager/index.vue
 * @description ユーザー情報管理コンポーネント
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
});
const props = useDefaults(_props, "UserManager");

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const userDocId = ref("");
const user = reactive(new User());

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { attrs } = useBaseManager("UserManager");
const auth = useAuthStore();
const { checkEmailAvailabilityGlobal } = useAuthFunctions();

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
/**
 * @description 従業員IDの変更を監視し、対応するユーザードキュメントIDを取得する
 * - 従業員IDに対応するユーザードキュメントが存在しない場合は、userDocIdを空文字に設定する
 * - 従業員IDに対応するユーザードキュメントが存在する場合は、そのドキュメントIDをuserDocIdに設定する
 */
watch(
  () => props.employee,
  async (newValue) => {
    const userInstance = new User();
    const users = await userInstance.fetchDocs({
      constraints: [["where", "employeeId", "==", newValue.docId]],
    });
    if (users.length === 0) {
      userDocId.value = "";
    } else {
      userDocId.value = users[0].docId;
    }
  },
  { immediate: true, deep: true },
);

/**
 * @description userDocIdの変更を監視し、対応するユーザードキュメントを購読する
 * - userDocIdが空文字の場合は、ユーザードキュメントの購読を解除する
 * - userDocIdが有効なドキュメントIDの場合は、そのドキュメントを購読する
 */
watch(userDocId, (newValue) => {
  if (!newValue) {
    user.unsubscribe();
  } else {
    user.subscribe({ docId: newValue });
  }
});

/*****************************************************************************
 * LIFECYCLE HOOKS
 *****************************************************************************/
onUnmounted(() => {
  user.unsubscribe();
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
  await createFn(newUser);
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
    :handle-delete="
      () => {
        throw new Error(
          'このコンポーネントでユーザー情報を削除することはできません。',
        );
      }
    "
    :excluded-keys="['roles', 'tagSize']"
  >
    <template #activator="{ toCreate }">
      <v-card>
        <v-toolbar title="ユーザー情報" color="secondary" density="compact" />
        <v-card-text>
          <div v-if="userDocId">
            <div class="d-flex flex-column pb-2">
              <small class="text-medium-emphasis">メールアドレス</small>
              <div class="text-right text-body-2" style="min-height: 24px">
                {{ user.email }}
              </div>
            </div>
            <div class="d-flex flex-column pb-2">
              <small class="text-medium-emphasis">状態</small>
              <div class="text-right text-body-2" style="min-height: 24px">
                <v-chip
                  v-if="user.isTemporary"
                  color="warning"
                  size="small"
                  text="仮登録"
                />
                <v-chip v-else-if="user.disabled" size="small" text="無効" />
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
      </v-card>
    </template>
  </air-item-manager>
</template>
