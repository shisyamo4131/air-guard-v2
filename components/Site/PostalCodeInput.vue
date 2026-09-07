<script setup>
import { onBeforeUnmount, ref, watch } from "vue";
import { fetchAddressFromPostalCode } from "../../air-vuetify-v3/src/utils/postalCode.js";

const props = defineProps({
  item: { type: Object, required: true },
  lookupAddress: { type: Function, default: fetchAddressFromPostalCode },
  updateProperties: { type: Function, required: true },
});
const model = defineModel({ type: String, default: "" });
const isLoading = ref(false);
const errorMessage = ref("");
let requestSequence = 0;

function addressSnapshot() {
  return {
    prefCode: props.item?.prefCode ?? "",
    city: props.item?.city ?? "",
    address: props.item?.address ?? "",
  };
}

function isSameAddress(left, right) {
  return left.prefCode === right.prefCode && left.city === right.city && left.address === right.address;
}

watch(model, async (postalCode) => {
  const sequence = ++requestSequence;
  errorMessage.value = "";
  if (!/^\d{7}$/u.test(postalCode || "")) {
    isLoading.value = false;
    return;
  }
  const baseline = addressSnapshot();
  isLoading.value = true;
  try {
    const result = await props.lookupAddress(postalCode);
    if (sequence !== requestSequence || model.value !== postalCode ||
        !isSameAddress(addressSnapshot(), baseline)) return;
    const prefCode = String(result?.prefcode || "").padStart(2, "0");
    if (!result || !/^(0[1-9]|[1-3][0-9]|4[0-7])$/u.test(prefCode) ||
        typeof result.address2 !== "string" || !result.address2 ||
        typeof result.address3 !== "string") {
      errorMessage.value = "住所を確認できませんでした。入力中の住所は変更していません。";
      return;
    }
    props.updateProperties({
      prefCode,
      city: result.address2,
      address: result.address3,
    });
  } catch {
    if (sequence === requestSequence && model.value === postalCode) {
      errorMessage.value = "住所を確認できませんでした。入力中の住所は変更していません。";
    }
  } finally {
    if (sequence === requestSequence) isLoading.value = false;
  }
});

onBeforeUnmount(() => {
  requestSequence += 1;
  isLoading.value = false;
});
</script>

<template>
  <air-text-field
    v-model="model"
    label="郵便番号"
    inputmode="numeric"
    :loading="isLoading"
    :error-messages="errorMessage || undefined"
    aria-label="現場の郵便番号"
  />
</template>
