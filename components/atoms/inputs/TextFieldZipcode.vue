<script setup>
/**
 * @file AtomsInputsTextFieldZipcode.vue
 * @description 郵便番号入力用コンポーネント
 */
defineOptions({ name: "AtomsInputsTextFieldZipcode" });

const model = defineModel();

const emit = defineEmits(["update:address"]);

watch(model, async (newVal) => {
  if (!newVal || newVal.length !== 7) return;
  const fetchedAddress = await fetchAddressFromPostalCode(newVal);
  if (fetchedAddress) {
    emit("update:address", fetchedAddress);
  }
});
</script>

<template>
  <air-text-field v-bind="$attrs" input-type="zipcode" v-model="model" />
</template>
