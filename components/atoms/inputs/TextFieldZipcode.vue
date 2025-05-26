<script setup>
defineOptions({ name: "AtomsInputsTextFieldZipcode" });
const model = defineModel();
const emit = defineEmits(["update:address"]);
watch(model, async (newVal) => {
  console.log("fetchedAddress");
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
