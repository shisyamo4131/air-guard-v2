<script setup>
const props = defineProps({ docs: { type: Array, default: () => [] }, search: { type: String, default: null }, error: { type: String, default: "" }, loading: Boolean, hideDefaultFooter: Boolean, itemsPerPage: { type: Number, default: 5 }, showCreate: Boolean, sortBy: { type: Array, default: () => [] } });
const emit = defineEmits(['update:search', 'click:detail', 'create', 'reload']);
</script>
<template>
  <div class="d-flex flex-column flex-grow-1 overflow-hidden">
    <v-toolbar class="ps-3 mb-4">
      <AtomsSearchTextField :model-value="props.search" :delay="300" @update:model-value="emit('update:search', $event)" />
      <EmployeeEditor v-if="props.showCreate" operation="create" title="従業員の新規登録" @saved="emit('create', { docId: $event.employeeId })">
        <template #default="{ open, canEdit }"><v-btn v-if="canEdit" icon="mdi-plus" aria-label="従業員を登録" @click="open" /></template>
      </EmployeeEditor>
    </v-toolbar>
    <v-progress-linear v-if="props.loading" indeterminate />
    <v-alert v-else-if="props.error" type="error">
      {{ props.error }}
      <template #append>
        <v-btn text="再読込" @click="emit('reload')" />
      </template>
    </v-alert>
    <EmployeesIterator class="flex-grow-1" grid :employees="props.docs" :hide-default-footer="props.hideDefaultFooter" :items-per-page="props.itemsPerPage" show-detail :sort-by="props.sortBy" @click:detail="emit('click:detail', $event)" />
  </div>
</template>
