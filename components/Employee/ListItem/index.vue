<script setup>
/*****************************************************************************
 * @file ./components/Employee/ListItem/index.vue
 * @description A ListItem component of Employee.
 *****************************************************************************/
import dayjs from "dayjs";
import { useDefaults } from "vuetify";
import { Employee } from "@/schemas";

defineOptions({ name: "EmployeeListItem", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  item: { type: Object, required: true }, // ListItem
});
const props = useDefaults(_props, "EmployeeListItem");

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const internalItem = reactive(new Employee());
watch(
  () => props.item,
  (newValue) => {
    internalItem.initialize(newValue?.raw || newValue || null);
  },
  { immediate: true, deep: true },
);

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const isForeigner = computed(() => internalItem.isForeigner);

const dateOfHire = computed(() => {
  const date = internalItem.dateOfHire;
  return date ? `入社日: ${dayjs(date).format("YYYY/MM/DD")}` : "N/A";
});

const dateOfTermination = computed(() => {
  const date = internalItem.dateOfTermination;
  return date ? `退社日: ${dayjs(date).format("YYYY/MM/DD")}` : "N/A";
});

const showDateOfTermination = computed(() => {
  return (
    internalItem.employmentStatus === Employee.STATUS_RESIGNED ||
    internalItem.employmentStatus === Employee.STATUS_TERMINATED
  );
});
const icon = computed(() => {
  if (internalItem.employmentStatus === Employee.STATUS_ACTIVE) {
    return "mdi-account";
  } else if (internalItem.employmentStatus === Employee.STATUS_RESIGNED) {
    return "mdi-account-off";
  } else {
    return "mdi-account-question";
  }
});

/**
 * Returns `displayName` used to `title` of `VListItem`.
 * If the employee is a foreigner, returns a string in the format of `displayName(fullName)`.
 */
const title = computed(() => {
  const displayName = internalItem.displayName || "N/A";
  const fullName = internalItem.fullName || "N/A";
  return isForeigner.value ? `${displayName} (${fullName})` : displayName;
});
</script>

<template>
  <v-list-item v-bind="$attrs" slim three-line>
    <template #prepend>
      <v-icon color="primary" :icon="icon" />
    </template>

    <!-- 親コンポーネントからルートコンポーネントに対して `title` プロパティが提供された場合に -->
    <!-- `v-list-item-title` を使用するとタイトル行が重複してしまうため、スロットを利用する -->
    <template #title>
      {{ title }}
    </template>

    <!-- 親コンポーネントからルートコンポーネントに対して `subtitle` プロパティが提供された場合に -->
    <!-- `v-list-item-subtitle` を使用するとサブタイトル行が重複してしまうため、スロットを利用する -->
    <template #subtitle>
      <div class="d-flex flex-column">
        <div class="mb-1">{{ internalItem.fullNameKana }}</div>
        <div>{{ dateOfHire }}</div>
        <div v-if="showDateOfTermination">{{ dateOfTermination }}</div>
      </div>
    </template>
  </v-list-item>
</template>
