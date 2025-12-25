<script setup>
/** define props */
const props = defineProps({
  isVisible: { type: Boolean, default: false },
  title: { type: String, default: "ウィンドウ" },
  initialX: { type: Number, default: 100 },
  initialY: { type: Number, default: 100 },
  width: { type: [String, Number], default: 216 },
  height: { type: [String, Number], default: 324 },
});

/** define emits */
const emit = defineEmits(["close", "move"]);

/** define refs */
const floatingWindow = ref(null);
const isDragging = ref(false);
const dragOffset = ref({ x: 0, y: 0 });
const position = ref({ x: props.initialX, y: props.initialY });

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
// initialX, initialY の変更を監視して位置を更新
watch(
  () => [props.initialX, props.initialY],
  ([newX, newY]) => {
    if (!isDragging.value) position.value = { x: newX, y: newY };
  }
);

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const windowStyle = computed(() => ({
  left: `${position.value.x}px`,
  top: `${position.value.y}px`,
  width: typeof props.width === "number" ? `${props.width}px` : props.width,
  height: typeof props.height === "number" ? `${props.height}px` : props.height,
  zIndex: isDragging.value ? 1020 : 1015,
}));

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function startDrag(event) {
  // window-header (v-toolbar) の場合のみドラッグを許可
  if (
    !event.target.closest(".window-header") &&
    !event.target.closest(".v-toolbar") &&
    !event.target.classList.contains("window-header") &&
    !event.target.classList.contains("v-toolbar")
  ) {
    return;
  }

  // クローズボタンの場合はドラッグしない
  if (event.target.closest(".v-btn")) {
    return;
  }

  isDragging.value = true;
  // v-cardコンポーネントの実際のDOM要素を取得
  const element = floatingWindow.value?.$el || floatingWindow.value;
  const rect = element.getBoundingClientRect();
  dragOffset.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };

  document.addEventListener("mousemove", onDrag);
  document.addEventListener("mouseup", stopDrag);
  event.preventDefault();
}

function onDrag(event) {
  if (!isDragging.value) return;

  const newX = event.clientX - dragOffset.value.x;
  const newY = event.clientY - dragOffset.value.y;

  // ウィンドウが画面外に出ないようにする
  const element = floatingWindow.value?.$el || floatingWindow.value;
  const maxX = window.innerWidth - element.offsetWidth;
  const maxY = window.innerHeight - element.offsetHeight;

  position.value = {
    x: Math.max(0, Math.min(newX, maxX)),
    y: Math.max(0, Math.min(newY, maxY)),
  };

  emit("move", position.value);
}

function stopDrag() {
  isDragging.value = false;
  document.removeEventListener("mousemove", onDrag);
  document.removeEventListener("mouseup", stopDrag);
}

function startDragTouch(event) {
  if (
    !event.target.closest(".window-header") &&
    !event.target.closest(".v-toolbar") &&
    !event.target.classList.contains("window-header") &&
    !event.target.classList.contains("v-toolbar")
  ) {
    return;
  }

  if (event.target.closest(".v-btn")) {
    return;
  }

  isDragging.value = true;
  const touch = event.touches[0];
  const element = floatingWindow.value?.$el || floatingWindow.value;
  const rect = element.getBoundingClientRect();
  dragOffset.value = {
    x: touch.clientX - rect.left,
    y: touch.clientY - rect.top,
  };

  document.addEventListener("touchmove", onDragTouch, { passive: false });
  document.addEventListener("touchend", stopDragTouch);
  event.preventDefault();
}

function onDragTouch(event) {
  if (!isDragging.value) return;

  const touch = event.touches[0];
  const newX = touch.clientX - dragOffset.value.x;
  const newY = touch.clientY - dragOffset.value.y;

  const element = floatingWindow.value?.$el || floatingWindow.value;
  const maxX = window.innerWidth - element.offsetWidth;
  const maxY = window.innerHeight - element.offsetHeight;

  position.value = {
    x: Math.max(0, Math.min(newX, maxX)),
    y: Math.max(0, Math.min(newY, maxY)),
  };

  emit("move", position.value);
  event.preventDefault();
}

function stopDragTouch() {
  isDragging.value = false;
  document.removeEventListener("touchmove", onDragTouch);
  document.removeEventListener("touchend", stopDragTouch);
}

/*****************************************************************************
 * LIFECYCLE HOOKS
 *****************************************************************************/
onBeforeUnmount(() => {
  document.removeEventListener("mousemove", onDrag);
  document.removeEventListener("mouseup", stopDrag);
  document.removeEventListener("touchmove", onDragTouch);
  document.removeEventListener("touchend", stopDragTouch);
});
</script>

<template>
  <v-card
    v-if="isVisible"
    ref="floatingWindow"
    class="floating-window"
    :class="{ dragging: isDragging }"
    :style="windowStyle"
    elevation="8"
  >
    <v-toolbar
      class="window-header"
      density="compact"
      @mousedown="startDrag"
      @touchstart="startDragTouch"
    >
      <v-toolbar-title class="window-title">{{ title }}</v-toolbar-title>
      <v-spacer />
      <v-btn
        icon
        size="small"
        variant="text"
        @click="$emit('close')"
        @mousedown.stop
      >
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </v-toolbar>
    <v-card-text class="window-content pa-0">
      <slot />
    </v-card-text>
  </v-card>
</template>

<style scoped>
.floating-window {
  position: fixed;
  user-select: none;
  border-radius: 8px !important;
}

.window-header {
  cursor: move;
  user-select: none;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)) !important;
}

.window-title {
  font-weight: 500;
  font-size: 14px;
  pointer-events: none;
}

.window-content {
  height: calc(100% - 48px); /* v-toolbarの高さに合わせて調整 */
  overflow: hidden;
  user-select: auto;
  cursor: default;
}

/* ドラッグ中の状態 */
.floating-window.dragging {
  cursor: move;
}

/* ドラッグ可能な要素内でのカーソル調整 */
.window-content :deep(.sortable-ghost) {
  opacity: 0.5;
}

.window-content :deep(.sortable-drag) {
  cursor: grabbing !important;
}
</style>
