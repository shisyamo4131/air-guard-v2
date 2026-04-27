<script setup>
import {
  useNotification,
  NOTIFICATION_STATUS,
  NOTIFICATION_STATUS_LABEL,
} from "@/composables/useNotification";
import { useAuthStore } from "@/stores/useAuthStore";

const { permission, refreshPermission, requestPermission, registFCMToken } =
  useNotification();
const auth = useAuthStore();

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
</script>

<template>
  <v-dialog max-width="480">
    <template #activator="activatorProps">
      <slot name="activator" v-bind="activatorProps" />
    </template>
    <v-card :border="false">
      <v-toolbar color="primary" density="compact" title="設定" />
      <v-card-text>
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
    </v-card>
  </v-dialog>
</template>
