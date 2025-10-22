<script setup>
/*****************************************************************************
 * InformationCard ver 1.0.0
 * @author shisyamo4131
 * @description A card component to display information with an edit button.
 * ---------------------------------------------------------------------------
 * @props {Boolean} disableEdit - Disable the edit button.
 * @props {String|Number|Boolean} border - Border property for the card.
 * @props {String} editBtnLabel - Label for the edit button.
 * @props {Boolean} flat - Flat property for the card.
 * @props {Boolean} hideEdit - Hide the edit button.
 * @props {Array} items - Items to display in the information list.
 * ---------------------------------------------------------------------------
 * @emits {click:edit} - Emitted when the edit button is clicked.
 * ---------------------------------------------------------------------------
 * @slots list - Slot to customize the information list.
 * @slots actions - Slot to customize the card actions.
 * @slots prepend-edit-btn - Slot to add content before the edit button.
 * @slots edit-btn - Slot to customize the edit button.
 * @slots append-edit-btn - Slot to add content after the edit button.
 *****************************************************************************/

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const props = defineProps({
  disableEdit: { type: Boolean, default: false },
  border: { type: [String, Number, Boolean], default: true },
  editBtnLabel: { type: String, default: "編集" },
  flat: { type: Boolean, default: true },
  hideEdit: { type: Boolean, default: false },
  items: { type: Array, default: () => [] },
});

const emit = defineEmits(["click:edit"]);

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const editBtnAttrs = computed(() => {
  return {
    disabled: props.disableEdit,
    text: props.editBtnLabel,
    onClick: () => emit("click:edit"),
  };
});
</script>

<template>
  <v-card :border="border" :flat="flat">
    <slot name="list">
      <v-list class="v-list--info-display" slim :items="items" flat />
    </slot>
    <slot name="actions">
      <v-card-actions v-if="!hideEdit">
        <slot name="prepend-edit-btn" />
        <slot name="edit-btn" v-bind="editBtnAttrs">
          <v-btn v-bind="editBtnAttrs" color="primary" block />
        </slot>
        <slot name="append-edit-btn" />
      </v-card-actions>
    </slot>
  </v-card>
</template>
