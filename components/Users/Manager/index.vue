<script setup>
/*****************************************************************************
 * @file ./components/Users/Manager/index.vue
 * @description ユーザー情報管理コンポーネント
 * @author shisyamo4131
 *
 *****************************************************************************/
import { User } from "@/schemas";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { useAuthFunctions } from "@/composables/auth/useAuthFunctions";
import { useMessagesStore } from "@/stores/useMessagesStore";
import { useRolePresets } from "@/composables/useRolePresets";
import { useDefaults } from "vuetify";
import UserCardMenu from "./CardMenu.vue";
import { useBaseManager } from "@/composables/useBaseManager";

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
const { ROLE_PRESETS } = useRolePresets();
const { attrs, isLoading, router, logger } = useBaseManager("UsersManager");

/*****************************************************************************
 * REACTIVE OBJECTS
 *****************************************************************************/
const user = reactive(new User());
const search = ref("");
const toolberMenu = ref(false);
const userCardMenu = ref(false);
const userCardMenuTarget = ref(null);
const userCardMenuTargetUser = ref(null);

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
  const key = loadings.add("ユーザーを無効化しています...");
  try {
    isLoading.value = true;
    await disableUser({ uid: user.docId });
    messages.add("ユーザーアカウントを無効化しました");
  } catch (error) {
    logger.error({ error });
  } finally {
    isLoading.value = false;
    loadings.remove(key);
  }
}

/**
 * ユーザーアカウントを有効化します。
 * @param user - 有効化するユーザーオブジェクト
 * @return {Promise<void>} - 有効化処理が完了するまでの Promise
 */
async function handleEnableUser(user) {
  const key = loadings.add("ユーザーを有効化しています...");
  try {
    isLoading.value = true;
    await enableUser({ uid: user.docId });
    messages.add("ユーザーアカウントを有効化しました");
  } catch (error) {
    logger.error({ error });
  } finally {
    isLoading.value = false;
    loadings.remove(key);
  }
}

/**
 * ユーザーごとのメニューを開きます。
 * @param param - メニューを開くためのイベントとユーザーオブジェクト
 * @property {Event} param.event - メニューを開くためのイベントオブジェクト
 * @property {Object} param.user - メニューの対象となるユーザーオブジェクト
 * @return {Promise<void>} - メニューの表示が完了するまでの Promise
 */
async function showUserCardMenu({ event, user }) {
  if (userCardMenu.value) {
    userCardMenu.value = false;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  userCardMenuTarget.value = event.target;
  userCardMenuTargetUser.value = user;
  userCardMenu.value = true;
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
    :handle-create="(item) => item.create()"
    :handle-update="(item) => item.update()"
    :handle-delete="(item) => item.delete()"
    :disable-delete="(item) => !!item.isAdmin"
    :excluded-keys="
      (item) => {
        return item.isAdmin ? ['roles'] : [];
      }
    "
  >
    <template #[`input.email`]="inputProps">
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
    <template #[`input.roles`]="inputProps">
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
      <v-toolbar class="ps-3 mb-4">
        <AtomsSearchTextField
          :model-value="search"
          @update:model-value="(value) => (search = value)"
        />
        <v-btn icon="mdi-plus" @click="() => tableProps.toCreate()" />
        <v-menu v-model="toolberMenu">
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
        :show-create="props.showCreate"
        show-edit
        @click:create="() => toCreate()"
        @click:edit="(item) => tableProps.toUpdate(item)"
      >
        <template #card-append="{ item }">
          <v-btn
            icon="mdi-dots-vertical"
            size="small"
            @click="(event) => showUserCardMenu({ event, user: item })"
          />
        </template>
      </UsersIterator>
      <UserCardMenu
        v-model="userCardMenu"
        :target="userCardMenuTarget"
        :user="userCardMenuTargetUser"
        :offset="[-8, -12]"
        location="bottom start"
        scroll-strategy="close"
        @click:enable="handleEnableUser"
        @click:disable="handleDisableUser"
      />
    </template>
  </air-array-manager>
</template>
