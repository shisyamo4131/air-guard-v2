<script setup>
defineOptions({ name: "OutsourcerCustomInput" });

const props = defineProps({
  componentAttrs: { type: Object, default: () => ({}) },
  editMode: { type: String, default: "CREATE" },
});
</script>

<template>
  <v-row>
    <v-col cols="12">
      <air-text-field v-bind="props.componentAttrs['code']" />
    </v-col>
    <v-col cols="12">
      <air-text-field v-bind="props.componentAttrs['name']" />
    </v-col>
    <v-col cols="12">
      <air-text-field v-bind="props.componentAttrs['nameKana']" />
    </v-col>
    <v-col cols="12">
      <air-text-field v-bind="props.componentAttrs['displayName']" />
    </v-col>
    <v-col v-if="props.editMode !== 'CREATE'" cols="12">
      <air-select v-bind="props.componentAttrs['contractStatus']" />
    </v-col>
    <v-col cols="12">
      <air-textarea v-bind="props.componentAttrs['remarks']" />
    </v-col>
  </v-row>
</template>
