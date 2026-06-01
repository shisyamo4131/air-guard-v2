<script setup>
/*****************************************************************************
 * @file ./components/molecules/ActivatorCard.vue
 * @description A card component used as the activator for `AirItemManager`.
 *
 * @property {String} color - The color of the card and toolbar. Default is "secondary".
 * @property {String} density - The density of the card and toolbar. Default is "compact".
 * @property {Boolean} disabled - If `true`, the edit button in the toolbar is disabled.
 * @property {Boolean} hideEditBtn - If `true`, the edit button in the toolbar is hidden.
 * @property {String} icon - The icon displayed on the edit button. Default is "mdi-pencil".
 * @property {Object} item - An object representing the item associated with the card. Default is an empty object.
 * @property {Boolean} noPadding - If `true`, removes horizontal padding from header, default, and footer slots.
 * @property {String} title - The title displayed on the toolbar.
 *
 * @emits click:edit - Emitted when the edit button is clicked.
 *
 * @slot toolbar-action - A slot for custom toolbar actions. If not provided, a default edit button will be displayed.
 * @slot header - A slot for the header content of the card.
 * @slot default - The default slot for the main content of the card.
 * @slot footer - A slot for the footer content of the card.
 *****************************************************************************/
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "MoleculesActivatorCard", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  color: { type: String, default: "secondary" },
  density: { type: String, default: "compact" },
  disabled: { type: Boolean, default: false },
  hideEditBtn: { type: Boolean, default: false },
  icon: { type: String, default: "mdi-pencil" },
  noPadding: { type: Boolean, default: false },
  item: { type: Object, default: () => ({}) },
  title: { type: String, default: undefined },
});
const props = useDefaults(_props, "MoleculesActivatorCard");
const emit = defineEmits(["click:edit"]);

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
/**
 * Toolbar の属性を返す計算プロパティ
 */
const toolbarAttrs = computed(() => {
  return {
    color: props.color,
    density: props.density,
    item: props.item,
    title: props.title,
  };
});

/**
 * Toolbar action slot に渡す属性を返す計算プロパティ
 */
const toolbarActionSlotAttrs = computed(() => {
  return {
    item: props.item,
    onClick: () => emit("click:edit"),
  };
});

const editBtnAttrs = computed(() => {
  return {
    disabled: props.disabled,
    icon: props.icon,
    item: props.item,
    size: "small",
    onClick: () => emit("click:edit"),
  };
});

const headerSlotAttrs = computed(() => {
  return {
    item: props.item,
  };
});

const defaultSlotAttrs = computed(() => {
  return {
    item: props.item,
  };
});

const footerSlotAttrs = computed(() => {
  return {
    item: props.item,
  };
});
</script>

<template>
  <v-card v-bind="$attrs">
    <!-- TOOLBAR -->
    <v-toolbar v-bind="toolbarAttrs">
      <v-spacer />

      <!-- SLOT: TOOLBAR ACTION -->
      <template v-if="!props.hideEditBtn">
        <slot name="toolbar-action" v-bind="toolbarActionSlotAttrs">
          <v-btn v-bind="editBtnAttrs" />
        </slot>
      </template>
    </v-toolbar>

    <!-- SLOT: HEADER -->
    <v-container
      v-if="$slots.header"
      :class="['pt-0', { 'px-0': props.noPadding }]"
    >
      <slot name="header" v-bind="headerSlotAttrs" />
    </v-container>

    <!-- SLOT: DEFAULT -->
    <v-card-text
      v-if="$slots.default"
      :class="['py-0', { 'px-0': props.noPadding }]"
    >
      <slot name="default" v-bind="defaultSlotAttrs" />
    </v-card-text>

    <!-- SLOT: FOOTER -->
    <v-container
      v-if="$slots.footer"
      :class="['pb-0', { 'px-0': props.noPadding }]"
    >
      <slot name="footer" v-bind="footerSlotAttrs" />
    </v-container>

    <!-- SLOT: ACTIONS -->
    <v-card-actions v-if="$slots.actions">
      <slot name="actions" />
    </v-card-actions>
  </v-card>
</template>
