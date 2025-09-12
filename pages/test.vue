<script setup>
import { Customer } from "@/schemas";

async function test() {
  try {
    const instance = new Customer();
    await instance.restore({ docId: "m6uN7uJUZzmuiT3Qo2es" });
    // await Customer.restore({ docId: "m6uN7uJUZzmuiT3Qo2es" });
  } catch (error) {
    console.error(error);
  }
}
</script>

<template>
  <TemplatesFixedHeightContainer>
    <v-btn @click="test">test</v-btn>
  </TemplatesFixedHeightContainer>
</template>
