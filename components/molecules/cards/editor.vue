<script setup>
defineOptions({ inheritAttrs: false });
const props = defineProps({
  label: { type: String, default: undefined },
  disableSubmit: { type: Boolean, default: false },
});
const emit = defineEmits(["click:close", "click:submit"]);
</script>

<template>
  <v-card v-bind="$attrs">
    <v-toolbar>
      <v-toolbar-title>{{ label }}</v-toolbar-title>
      <v-spacer />
      <AtomsBtnsCloseIcon @click="emit('click:close')" />
    </v-toolbar>
    <v-card-text>
      <slot name="default" />
    </v-card-text>
    <v-card-actions>
      <v-spacer />
      <AtomsBtnsSubmit
        color="primary"
        :disabled="disableSubmit"
        variant="elevated"
        @click="emit('click:submit')"
      />
    </v-card-actions>
  </v-card>
</template>
