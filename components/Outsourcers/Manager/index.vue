<script setup>
/*****************************************************************************
 * @file ./components/Outsourcers/Manager/index.vue
 * @description 外注先情報管理コンポーネント
 *****************************************************************************/
import { Outsourcer } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";
import CustomInput from "@/components/Outsourcer/CustomInput.vue";
import { normalizeTokenText } from "@shisyamo4131/air-firebase-v2/utils/tokenMap";
import { useDefaults } from "vuetify";

defineOptions({ name: "OutsourcersManager", inheritAttrs: false });

const _props = defineProps({
  beforeEdit: { type: Function, default: () => true },
  currentPage: { type: Number, default: 1 },
  customInput: { type: [Object, Function], default: null },
  errorMessage: { type: String, default: null },
  hasNextPage: { type: Boolean, default: false },
  hasPreviousPage: { type: Boolean, default: false },
  hideDefaultFooter: { type: Boolean, default: false },
  itemsPerPage: { type: Number, default: 5 },
  loaded: { type: Boolean, default: true },
  loading: { type: Boolean, default: false },
  modelValue: {
    type: Array,
    default: () => [],
    validator: (value) => value.every((item) => item instanceof Outsourcer),
  },
  search: { type: String, default: null },
  showCreate: { type: Boolean, default: false },
  showPagination: { type: Boolean, default: false },
});
const props = useDefaults(_props, "OutsourcersManager");
const emit = defineEmits([
  "create",
  "load:next",
  "load:previous",
  "retry",
  "update",
  "update:search",
]);
const { attrs } = useBaseManager("OutsourcersManager");

const searchRequiresMoreInput = computed(() => {
  const search = props.search || "";
  const normalizedLength = normalizeTokenText(search).length;
  return search.length > 0 && (normalizedLength < 1 || normalizedLength > 40);
});

function rejectDirectDelete() {
  throw new Error("外注先は直接削除できません。");
}

function resolveCustomInput(context) {
  if (props.customInput) {
    return typeof props.customInput === "function"
      ? props.customInput(context)
      : props.customInput;
  }
  return CustomInput;
}

async function beforeEdit(editMode, item) {
  if (editMode === "DELETE") return rejectDirectDelete();
  return await props.beforeEdit(editMode, item);
}

async function handleCreate(draft) {
  return await draft.create();
}

async function handleUpdate(draft) {
  return await draft.update();
}
</script>

<template>
  <air-array-manager
    v-bind="{ ...$attrs, ...attrs }"
    class="fill-height"
    :model-value="props.modelValue"
    :schema="Outsourcer"
    label="外注先の新規登録"
    :dialog-props="{
      maxWidth: 480,
      persistent: true,
      scrollable: true,
      'aria-label': '外注先の新規登録',
    }"
    :before-edit="beforeEdit"
    :custom-input="resolveCustomInput"
    disable-delete
    hide-delete-btn
    :handle-create="handleCreate"
    :handle-update="handleUpdate"
    :handle-delete="rejectDirectDelete"
    @create="emit('create', $event)"
    @update="emit('update', $event)"
  >
    <template #table="{ items, toCreate, toUpdate }">
      <slot
        name="table"
        v-bind="{
          items,
          canCreate: true,
          canUpdate: true,
          toCreate,
          toUpdate,
        }"
      >
        <slot name="toolbar" v-bind="{ canCreate: true, toCreate }">
          <AppMasterListToolbar
            :search="props.search"
            :search-delay="300"
            @update:search="emit('update:search', $event)"
          >
            <template #append>
              <v-btn icon="mdi-plus" @click="() => toCreate()" />
            </template>
          </AppMasterListToolbar>
        </slot>
        <v-progress-linear v-if="props.loading" color="primary" indeterminate />
        <v-alert
          v-if="props.errorMessage"
          class="mb-4"
          type="error"
          variant="tonal"
        >
          <div class="d-flex flex-wrap align-center justify-space-between ga-2">
            <span>{{ props.errorMessage }}</span>
            <v-btn
              :disabled="props.loading"
              variant="text"
              @click="emit('retry')"
            >
              再試行
            </v-btn>
          </div>
        </v-alert>
        <div
          v-if="!props.loaded && props.loading"
          class="pa-8 text-center text-medium-emphasis"
        >
          外注先情報を読み込んでいます…
        </div>
        <v-empty-state
          v-else-if="searchRequiresMoreInput"
          icon="mdi-magnify"
          title="1〜40文字で入力してください"
          text="外注先名、フリガナ、または略称を1〜40文字で検索します。"
        />
        <OutsourcersIterator
          v-else-if="props.loaded"
          class="flex-grow-1"
          grid
          :outsourcers="items"
          :hide-default-footer="props.hideDefaultFooter"
          :items-per-page="props.itemsPerPage"
          :show-create="props.showCreate"
          show-edit
          @click:create="() => toCreate()"
          @click:edit="toUpdate"
        />
        <div
          v-if="props.showPagination && props.loaded && !searchRequiresMoreInput"
          class="d-flex justify-end ga-2 pt-3"
        >
          <v-btn
            :disabled="props.loading || !props.hasPreviousPage"
            prepend-icon="mdi-chevron-left"
            variant="text"
            @click="emit('load:previous')"
          >
            前へ
          </v-btn>
          <span class="d-flex align-center text-body-2 text-medium-emphasis">
            {{ props.currentPage }}ページ
          </span>
          <v-btn
            :disabled="props.loading || !props.hasNextPage"
            append-icon="mdi-chevron-right"
            variant="text"
            @click="emit('load:next')"
          >
            次へ
          </v-btn>
        </div>
      </slot>
    </template>
  </air-array-manager>
</template>
