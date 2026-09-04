<script setup>
/*****************************************************************************
 * @file ./components/Outsourcers/Manager/index.vue
 * @description 外注先情報管理コンポーネント
 *****************************************************************************/
import { useDefaults } from "vuetify";
import {
  OUTSOURCER_MUTATIONS,
  evaluateOutsourcerMutation,
} from "@/utils/auth/policies/outsourcerMutationPolicy";
import { normalizeTokenText } from "@shisyamo4131/air-firebase-v2/utils/tokenMap";

defineOptions({ inheritAttrs: false });

const _props = defineProps({
  currentPage: { type: Number, default: 1 },
  docs: { type: Array, default: () => [] },
  errorMessage: { type: String, default: null },
  hasNextPage: { type: Boolean, default: false },
  hasPreviousPage: { type: Boolean, default: false },
  hideDefaultFooter: { type: Boolean, default: false },
  itemsPerPage: { type: Number, default: 5 },
  loaded: { type: Boolean, default: true },
  loading: { type: Boolean, default: false },
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
const auth = useAuthStore();
const createDialog = ref(null);
const editorDialog = ref(null);
const selectedOutsourcer = ref(null);

function mutationDecision(operation) {
  return evaluateOutsourcerMutation({
    operation,
    uid: auth.uid,
    companyId: auth.companyId,
    isSuperUser: auth.isSuperUser,
    isSuperUserClaimValid: auth.isSuperUserClaimValid,
    actorUser: auth.user,
  });
}

const canCreate = computed(
  () => mutationDecision(OUTSOURCER_MUTATIONS.CREATE).allowed,
);
const canUpdate = computed(
  () => mutationDecision(OUTSOURCER_MUTATIONS.UPDATE).allowed,
);
const searchRequiresMoreInput = computed(() => {
  const search = props.search || "";
  const normalizedLength = normalizeTokenText(search).length;
  return search.length > 0 && (normalizedLength < 2 || normalizedLength > 40);
});

function toCreateIfAllowed() {
  if (!mutationDecision(OUTSOURCER_MUTATIONS.CREATE).allowed) return;
  createDialog.value?.open();
}

async function toUpdateIfAllowed(item) {
  if (!mutationDecision(OUTSOURCER_MUTATIONS.UPDATE).allowed) return;
  selectedOutsourcer.value = item;
  await nextTick();
  editorDialog.value?.open();
}
</script>

<template>
  <div v-bind="$attrs" class="d-flex flex-column flex-grow-1 overflow-hidden">
    <slot
      name="table"
      v-bind="{
        items: props.docs,
        canCreate,
        canUpdate,
        toCreate: toCreateIfAllowed,
        toUpdate: toUpdateIfAllowed,
      }"
    >
      <slot name="toolbar" v-bind="{ canCreate, toCreate: toCreateIfAllowed }">
        <v-toolbar class="ps-3 mb-4">
          <AtomsSearchTextField
            :model-value="props.search"
            :delay="300"
            @update:model-value="emit('update:search', $event)"
          />
          <v-btn
            v-if="canCreate"
            icon="mdi-plus"
            @click="toCreateIfAllowed"
          />
        </v-toolbar>
      </slot>
      <v-progress-linear
        v-if="props.loading"
        color="primary"
        indeterminate
      />
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
        title="2〜40文字で入力してください"
        text="外注先名、フリガナ、または略称を2〜40文字で検索します。"
      />
      <OutsourcersIterator
        v-else-if="props.loaded"
        class="flex-grow-1"
        grid
        :outsourcers="props.docs"
        :hide-default-footer="props.hideDefaultFooter"
        :items-per-page="props.itemsPerPage"
        :show-create="props.showCreate && canCreate"
        :show-edit="canUpdate"
        @click:create="toCreateIfAllowed"
        @click:edit="toUpdateIfAllowed"
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

    <OutsourcerCreateDialog ref="createDialog" @created="emit('create', $event)" />
    <OutsourcerEditor
      v-if="selectedOutsourcer"
      ref="editorDialog"
      :outsourcer="selectedOutsourcer"
      @updated="emit('update', $event)"
    />
  </div>
</template>
