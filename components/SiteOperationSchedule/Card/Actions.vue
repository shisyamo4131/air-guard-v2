<script setup>
/*****************************************************************************
 * 現場稼働予定管理用カードアクションコンポーネント
 * - `SiteOperationSchedule/Card/index.vue` で使用されるコンポーネント
 *
 * @inject {Object} props - 親コンポーネントから提供されるプロパティ
 * @inject {Function} emit - 親コンポーネントから提供されるイベントエミッター
 *
 * @emits click:notify - 作業員への通知ボタンがクリックされたときに発火
 * @emits click:duplicate - 複製ボタンがクリックされたときに発火
 * @emits click:edit - 編集ボタンがクリックされたときに発火
 *****************************************************************************/
const props = inject("props");
const emit = inject("emit");

const color = "medium-emphasis";
const size = "small";

/**
 * 現場稼働予定が編集可能かどうかを返します。
 */
const editable = computed(() => {
  return props.schedule.isEditable;
});

/**
 * 現場稼働予定について作業員への通知が可能かどうかを返します。
 * - 編集可能かつ、全作業員に通知済みでない場合に通知可能とします。
 * - `isNotifiedAllWorkers` プロパティは全作業員に対して通知済みかどうかを表すフラグで
 *   作業員が割り当てられていない場合は `true` を返します。
 */
const notifiable = computed(() => {
  return editable.value && !props.schedule.isNotifiedAllWorkers;
});

const btns = computed(() => {
  return [
    {
      icon: "mdi-bullhorn",
      disabled: !notifiable.value,
      onClick: () => emit("click:notify"),
    },
    { icon: "mdi-content-copy", onClick: () => emit("click:duplicate") },
    {
      icon: "mdi-pencil",
      disabled: !editable.value,
      onClick: () => emit("click:edit"),
    },
  ];
});
</script>

<template>
  <v-card-actions style="min-height: unset" class="py-0">
    <v-spacer />
    <v-btn
      v-for="(btn, index) of btns"
      :key="index"
      v-bind="btn"
      :color="color"
      :size="size"
    />
  </v-card-actions>
</template>
