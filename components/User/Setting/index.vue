<script setup>
import {
  useNotification,
  NOTIFICATION_STATUS,
  NOTIFICATION_STATUS_LABEL,
} from "@/composables/useNotification";
import { useAuthStore } from "@/stores/useAuthStore";
import { useUserSettingsActions } from "@/composables/application/user/useUserSettingsActions";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { useMessagesStore } from "@/stores/useMessagesStore";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLogger } from "@/composables/useLogger";
import { TAG_SIZE_VALUES } from "@shisyamo4131/air-guard-v2-schemas/constants";

const { permission, refreshPermission, requestPermission, registFCMToken } =
  useNotification();
const auth = useAuthStore();
const loadings = useLoadingsStore();
const messages = useMessagesStore();
const logger = useLogger("UserSetting", useErrorsStore());
const { updateProfile } = useUserSettingsActions();
const dialog = ref(false);
const form = ref(null);
const model = reactive({ displayName: "", tagSize: "" });

const tagSizeOptions = Object.values(TAG_SIZE_VALUES).map(({ value, title }) => ({
  value,
  title,
}));
const displayNameRules = [
  (value) => (typeof value === "string" && value.length > 0) || "表示名は必須です。",
  (value) => value?.trim() === value || "表示名の前後に空白は使用できません。",
  (value) => value?.length <= 6 || "表示名は6文字以内で入力してください。",
];

watch(
  dialog,
  (isOpen) => {
    if (!isOpen) return;
    model.displayName = auth.user.displayName;
    model.tagSize = auth.tagSize;
  },
  { immediate: true },
);

const items = computed(() => {
  return [
    {
      title: NOTIFICATION_STATUS_LABEL[permission.value] || "？？？",
      props: { subtitle: "プッシュ通知" },
    },
  ];
});

/**
 * コンポーネントのマウント時に通知権限を取得
 */
onMounted(() => {
  refreshPermission();
});

/**
 * 通知許可ボタンをクリックした時の処理
 */
async function handleRequestPermission() {
  const result = await requestPermission();
  if (result === NOTIFICATION_STATUS.GRANTED) {
    // ユーザーが通知を許可した場合、FCMトークンの登録などの処理を行う
    await registFCMToken(auth.user);
  }
}

async function handleSaveProfile() {
  const validation = await form.value?.validate();
  if (!validation?.valid) return;

  const loadingKey = loadings.add("ユーザー設定を保存しています...");
  try {
    await updateProfile({
      displayName: model.displayName,
      tagSize: model.tagSize,
    });
    messages.add("ユーザー設定を保存しました。");
    dialog.value = false;
  } catch (error) {
    logger.error({ error });
  } finally {
    loadings.remove(loadingKey);
  }
}
</script>

<template>
  <v-dialog v-model="dialog" max-width="480">
    <template #activator="activatorProps">
      <slot name="activator" v-bind="activatorProps" />
    </template>
    <v-card :border="false">
      <v-toolbar color="primary" density="compact" title="設定" />
      <v-card-text>
        <v-form ref="form" @submit.prevent="handleSaveProfile">
          <v-text-field
            v-model="model.displayName"
            label="表示名"
            :rules="displayNameRules"
          />
          <v-select
            v-model="model.tagSize"
            label="タグサイズ"
            :items="tagSizeOptions"
          />
        </v-form>
        <v-list>
          <v-list-item v-for="(item, index) of items" :key="index">
            <v-list-item-title>{{ item.props.subtitle }}</v-list-item-title>
            <v-list-item-subtitle>{{ item.title }}</v-list-item-subtitle>
            <template #append v-if="permission === NOTIFICATION_STATUS.DEFAULT">
              <v-list-item-action>
                <v-btn
                  color="primary"
                  size="small"
                  @click="handleRequestPermission"
                  >許可</v-btn
                >
              </v-list-item-action>
            </template>
          </v-list-item>
        </v-list>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn text="キャンセル" @click="dialog = false" />
        <v-btn color="primary" text="保存" @click="handleSaveProfile" />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
