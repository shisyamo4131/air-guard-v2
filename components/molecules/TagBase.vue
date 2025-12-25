<script setup>
/**
 * TagBase.vue
 *
 * Base component for displaying a tag in arrangements.
 * The tag has a fixed height of 48px.
 *
 * @props {Boolean} highlight - Whether the tag is highlighted.
 * @props {String} label - The label to display on the tag.
 * @props {Boolean} loading - Whether the tag is in loading state.
 * @props {Boolean} removable - Displays clear button and emits `remove` event when clicked.
 * @props {String} removeIcon - Icon for the remove button.
 * @props {String} size - Size variant of the tag ('small', 'default', 'large').
 * @props {String} variant - Visual variant of the tag ('default', 'success', 'warning', 'error', 'disabled').
 *
 * @slots
 * - prepend-label: Content before the label.
 * - label: Custom label content.
 * - append-label: Content after the label.
 * - append: Content in the append area.
 * - footer: Content in the footer area.
 * - prepend-action: Content in the prepend action area.
 * - action: Custom clear button content.
 * - append-action: Content in the append action area.
 *
 * @emits remove - Emitted when the clear button is clicked.
 *
 * @update 2025-12-25 `size` プロパティを `TAG_SIZE_VALUES` に基づくよう修正。
 * @update 2025-12-24 Add icon for draggable handle in prepend-label slot.
 */

import { computed } from "vue";
import { TAG_SIZE_VALUES } from "@shisyamo4131/air-guard-v2-schemas/constants";

defineOptions({ inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const props = defineProps({
  /** Whether the tag is highlighted. */
  highlight: { type: Boolean, default: false },

  /** The label to display on the tag. */
  label: {
    type: String,
    default: undefined,
    validator: (value) =>
      value === undefined ||
      (typeof value === "string" && value.trim().length > 0),
  },

  /** Whether the tag is in loading state. */
  loading: { type: Boolean, default: false },

  /** Displays clear button and emit `remove` event when clicked */
  removable: { type: Boolean, default: false },

  /** Icon for the remove button */
  removeIcon: { type: String, default: "mdi-close" },

  /** Size variant of the tag */
  size: {
    type: String,
    default: TAG_SIZE_VALUES.MEDIUM.value,
    validator: (value) => Object.keys(TAG_SIZE_VALUES).includes(value),
  },

  /** Visual variant of the tag */
  variant: {
    type: String,
    default: "default",
    validator: (value) =>
      ["default", "success", "warning", "error", "disabled"].includes(value),
  },
});

const emit = defineEmits(["click:remove"]);

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
/**
 * Computed property for tag classes
 */
const tagClasses = computed(() => ({
  "tag-base": true,
  "tag-base--highlighted": props.highlight,
  [`tag-base--${props.size.toLowerCase()}`]: true,
  [`tag-base--${props.variant}`]: props.variant !== "default",
  "tag-base--loading": isLoading.value,
}));

/**
 * Computed property to determine if the tag is in loading state
 */
const isLoading = computed(() => props.loading || !props.label);

/**
 * Computed property to determine if label content should be shown
 */
const showLabelContent = computed(() => props.label && !isLoading.value);

/**
 * Computed property for tag height based on size
 */
const tagHeight = computed(() => {
  const heights = {
    small: "40px",
    default: "48px",
    large: "56px",
  };
  return heights[props.size.toLowerCase()] || heights.default;
});

const removeButtonAttrs = computed(() => {
  return {
    disabled: isLoading.value,
    icon: props.removeIcon,
    isLoading: isLoading.value,
    // size: props.size === "small" ? "x-small" : "small",
    size: props.size === TAG_SIZE_VALUES.SMALL.value ? "x-small" : "small",
    onClick: handleClickRemove,
  };
});

/**
 * Computed property for title classes based on size
 */
const titleClasses = computed(() => {
  const sizeClasses = {
    small: "text-caption",
    default: "text-subtitle-2",
    large: "text-body-1",
  };

  // return ["tag-base__title", sizeClasses[props.size] || sizeClasses.default];
  return [
    "tag-base__title",
    sizeClasses[props.size.toLowerCase()] || sizeClasses.default,
  ];
});

/**
 * Computed property for progress circular size based on tag size
 */
const progressSize = computed(() => {
  const sizeMap = {
    small: "x-small",
    default: "x-small",
    large: "small",
  };

  // return sizeMap[props.size] || "x-small";
  return sizeMap[props.size.toLowerCase()] || "x-small";
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * Handler for the remove button click event.
 * Emits the 'remove' event.
 */
function handleClickRemove(event) {
  event.stopPropagation();
  emit("click:remove");
}
</script>

<template>
  <v-list-item
    :class="tagClasses"
    :style="{ height: tagHeight }"
    border
    rounded
  >
    <v-list-item-title :class="titleClasses">
      <!-- Label content (shown when label is available and not loading) -->
      <div v-if="showLabelContent" class="tag-base__label-content">
        <slot name="prepend-label" v-bind="{ label: props.label }">
          <AtomsIconsDraggable />
        </slot>
        <slot name="label" v-bind="{ label: props.label }">
          {{ props.label }}
        </slot>
        <slot name="append-label" v-bind="{ label: props.label }" />
      </div>

      <!-- Loading indicator (shown when loading or no label) -->
      <div v-else-if="isLoading" class="tag-base__loading">
        <v-progress-circular
          indeterminate
          :size="progressSize"
          aria-label="読み込み中"
        />
        <span v-if="size !== 'small'" class="tag-base__loading-text ml-2">
          読み込み中...
        </span>
      </div>
    </v-list-item-title>

    <!-- Footer slot -->
    <slot name="footer" />

    <!-- Append content -->
    <template #append>
      <slot name="append">
        <v-list-item-action v-if="$slots[`prepend-action`]">
          <slot name="prepend-action" />
        </v-list-item-action>
        <v-list-item-action v-if="props.removable" class="pl-2">
          <slot name="action" v-bind="removeButtonAttrs">
            <v-icon v-bind="removeButtonAttrs" />
          </slot>
        </v-list-item-action>
        <v-list-item-action v-if="$slots[`append-action`]">
          <slot name="append-action" />
        </v-list-item-action>
      </slot>
    </template>
  </v-list-item>
</template>

<style scoped>
.tag-base {
  margin-bottom: 8px;
}

.tag-base__title {
  display: flex;
  align-items: center;
  min-height: 100%;
}

.tag-base__label-content {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.tag-base__loading {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
}

.tag-base__loading-text {
  font-size: 0.75rem;
  opacity: 0.7;
}

/* Size variants */
.tag-base--small {
  padding: 4px 8px;
}

.tag-base--medium {
  padding: 8px 8px;
}

.tag-base--large {
  padding: 12px 8px;
}

/* Color variants */
.tag-base--success {
  background-color: rgba(76, 175, 80, 0.1) !important;
  border-color: #4caf50 !important;
}

.tag-base--warning {
  background-color: rgba(255, 152, 0, 0.1) !important;
  border-color: #ff9800 !important;
}

.tag-base--error {
  background-color: rgba(244, 67, 54, 0.1) !important;
  border-color: #f44336 !important;
}

/* 追加: disabled variant */
.tag-base--disabled {
  background-color: rgba(158, 158, 158, 0.1) !important;
  border-color: #9e9e9e !important;
  opacity: 0.6 !important;
  color: #9e9e9e !important;
}

.tag-base--disabled .tag-base__title {
  color: #9e9e9e !important;
}

.tag-base--disabled .v-icon {
  color: #9e9e9e !important;
}

/* Highlighted state */
.tag-base--highlighted {
  background-color: rgba(255, 193, 7, 0.3) !important;
  border-color: #ffc107 !important;
  border-width: 2px !important;
}

/* Loading state */
.tag-base--loading {
  opacity: 0.8;
}

/* Disabled state */
.tag-base:disabled,
.tag-base--loading {
  pointer-events: auto; /* ローディング中でもクリック可能にする場合 */
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .tag-base--large {
    padding: 8px 12px;
  }

  .tag-base__loading-text {
    display: none; /* モバイルでは読み込みテキストを非表示 */
  }
}

/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .tag-base--success {
    background-color: rgba(76, 175, 80, 0.2) !important;
  }

  .tag-base--warning {
    background-color: rgba(255, 152, 0, 0.2) !important;
  }

  .tag-base--error {
    background-color: rgba(244, 67, 54, 0.2) !important;
  }

  /* 追加: disabled variant for dark theme */
  .tag-base--disabled {
    background-color: rgba(97, 97, 97, 0.2) !important;
    border-color: #616161 !important;
    color: #616161 !important;
  }

  .tag-base--disabled .tag-base__title {
    color: #616161 !important;
  }

  .tag-base--disabled .v-icon {
    color: #616161 !important;
  }
}
</style>
