<script setup>
import { useErrorsStore } from "@/stores/useErrorsStore";

/*****************************************************************************
 * DEFINE COMPOSABLES
 *****************************************************************************/
const { error, clearError } = useLogger("SiteManager", useErrorsStore());

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const model = defineModel({ type: Object, required: true });
const props = defineProps({
  handleCreate: { type: Function, default: (item) => item.create() },
  handleUpdate: { type: Function, default: (item) => item.update() },
  handleDelete: { type: Function, default: (item) => item.delete() },
});

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const items = computed(() => {
  return [
    {
      title: "CODE",
      props: { subtitle: model.value.code, prependIcon: "mdi-code-tags" },
    },
    {
      title: "住所",
      props: {
        subtitle: `${model.value.zipcode} ${model.value.fullAddress}`,
        prependIcon: "mdi-map-marker",
      },
    },
    {
      title: "建物名",
      props: {
        subtitle: model.value.building,
        prependIcon: "mdi-office-building-marker",
      },
    },
    {
      title: "取引先",
      props: {
        subtitle: model.value.customer?.name || "loading",
        prependIcon: "mdi-domain",
      },
    },
  ];
});
</script>

<template>
  <air-item-manager
    v-model="model"
    :handle-create="handleCreate"
    :handle-update="handleUpdate"
    :handle-delete="handleDelete"
    @error="error"
    @error:clear="clearError"
  >
    <template #default="{ toUpdate }">
      <v-card border flat>
        <v-list class="v-list--info-display" slim :items="items" />
        <v-card-actions>
          <v-btn color="primary" block @click="toUpdate()">編集</v-btn>
        </v-card-actions>
      </v-card>
    </template>
    <template v-for="(slotFn, slotName) in $slots" #[slotName]="scope">
      <slot :name="slotName" v-bind="scope ?? {}" />
    </template>
  </air-item-manager>
</template>

<style scoped></style>
