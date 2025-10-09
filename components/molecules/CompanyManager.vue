<script setup>
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";

/*****************************************************************************
 * DEFINE COMPOSABLES / STORES
 *****************************************************************************/
const { error, clearError } = useLogger("CompanyManager", useErrorsStore());

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const model = defineModel({ type: Object, required: true });
const props = defineProps({
  handleCreate: { type: Function, default: (item) => item.create() },
  handleUpdate: { type: Function, default: (item) => item.update() },
  handleDelete: { type: Function, default: (item) => item.delete() },
  items: { type: Array, default: () => [] },
});

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const displayItems = computed(() => {
  if (props.items.length > 0) return props.items;
  return [
    {
      title: "会社名",
      props: {
        subtitle: `${model.value.companyName}`,
        prependIcon: "mdi-tag",
      },
    },
    {
      title: "住所",
      props: {
        subtitle: `${model.value.zipcode} ${model.value.fullAddress}`,
        prependIcon: "mdi-map-marker",
        lines: "two",
      },
    },
    {
      title: "建物",
      props: {
        subtitle: model.value.building || "-",
        prependIcon: "mdi-office-building-marker",
      },
    },
    {
      title: "電話番号",
      props: {
        subtitle: model.value.tel || "-",
        prependIcon: "mdi-phone",
      },
    },
    {
      title: "FAX番号",
      props: {
        subtitle: model.value.fax || "-",
        prependIcon: "mdi-fax",
      },
    },
  ];
});
</script>

<template>
  <air-item-manager
    :model-value="model"
    :handle-create="handleCreate"
    :handle-update="handleUpdate"
    :handle-delete="handleDelete"
    @error="error"
    @error:clear="clearError"
  >
    <template #default="{ toUpdate }">
      <v-card border flat>
        <v-list class="v-list--info-display" slim :items="displayItems" />
        <v-card-actions>
          <v-btn color="primary" block @click="toUpdate()">編集</v-btn>
        </v-card-actions>
      </v-card>
    </template>
  </air-item-manager>
</template>

<style></style>
