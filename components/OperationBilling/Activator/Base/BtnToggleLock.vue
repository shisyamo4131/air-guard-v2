<script setup>
/*****************************************************************************
 * @file ./components/OperationBilling/Activator/Base/BtnToggleLock.vue
 * @description A btn component for diplaying `isLocked` status of `OperationBilling` document.
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { OperationBilling } from "@/schemas";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { useLogger } from "@/composables/useLogger";

defineOptions({
  name: "OperationBillingActivatorBaseBtnToggleLock",
  inheritAttrs: false,
});

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  item: {
    type: Object,
    required: true,
    validator: (value) => value instanceof OperationBilling,
  },
});
const props = useDefaults(_props, "OperationBillingActivatorBaseBtnToggleLock");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const logger = useLogger(
  "OperationBillingActivatorBaseBtnToggleLock",
  useErrorsStore(),
);
const loadings = useLoadingsStore();

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const color = computed(() => {
  return props.item.isLocked ? "error" : "primary";
});

const prependIcon = computed(() => {
  return props.item.isLocked ? "mdi-lock-open" : "mdi-lock";
});

const text = computed(() => {
  return props.item.isLocked
    ? "この稼働情報のロックを解除"
    : "この稼働情報をロック";
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
async function toggleLock() {
  const message = props.item.isLocked
    ? "ロックを解除しています。"
    : "ロックしています。";
  const key = loadings.add(message);
  try {
    await props.item.toggleLock();
  } catch (error) {
    logger.error("Failed to toggle lock:", error);
  } finally {
    loadings.remove(key);
  }
}
</script>

<template>
  <v-btn
    v-bind="$attrs"
    class="mb-4"
    block
    :color="color"
    :prepend-icon="prependIcon"
    :text="text"
    variant="flat"
    @click="toggleLock"
  />
</template>
