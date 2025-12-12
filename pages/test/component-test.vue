<script setup>
const props = defineProps({
  prependIcon: { type: String, default: "mdi-magnify" },
});
</script>

<template>
  <v-container>
    <v-card>
      <template #title>
        <v-card
          class="flex-grow-0"
          :prepend-icon="prependIcon"
          title="テスト"
          color="primary"
          subtitle="component test"
          :border="false"
          variant="flat"
        />
      </template>
      <v-card-text> sadflkjasdf;lkjasdfl;kjasdf;lkjsadflkj </v-card-text>
    </v-card>
  </v-container>
</template>
