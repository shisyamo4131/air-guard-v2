<script setup>
/*****************************************************************************
 * @file ./components/Site/Autocomplete.vue
 * @description A autocomplete component of 'Site'.
 *
 * @note
 * `air-autocomplete-api` に対する設定は以下のようにする。
 *
 * - `api` には `useSiteUiReads` の検索APIをラップした関数を渡す。
 *   -> `AirApiLoader` は `api` を呼び出す際に検索文字列のみを渡す。
 *   -> 検索結果は直近requestだけを採用し、過去の検索結果を候補へ混入させない。
 *
 * - `custom-filter` は常に `true` を返すようにする。
 *   -> Vuetify の `v-autocomplete` がクライアント側でさらに絞り込みを行うため、
 *      N-gram 検索の結果と競合してしまう。フィルタリングは N-gram 検索に完全に委ねる。
 *
 * - `cache-items` は使用しない（デフォルトのまま `false`）。
 *   -> `true` にすると `AirApiLoader` が検索結果を累積キャッシュし、それが
 *      `custom-filter: () => true` と競合して意図しないアイテムが表示される。
 *      `items` には常に直近の検索結果のみが渡るようにすること。
 *
 * 確定したSiteだけを同じprovide scopeの共有cacheへ登録し、予定・実績editor等の
 * sibling consumerが選択直後から参照できるようにする。
 *****************************************************************************/
import { onBeforeUnmount } from "vue";
import { useSiteUiReads } from "@/composables/dataLayers/site/useSiteUiReads";
import { useSiteActions } from "@/composables/application/site/useSiteActions";
import { useFetch } from "@/composables/fetch/useFetch";
import { useAuthStore } from "@/stores/useAuthStore";
import { Site } from "@/schemas";
import { useDefaults } from "vuetify";

defineOptions({ inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  creatable: { type: Boolean, default: false },
  label: { type: String, default: "現場" },
  itemTitle: { type: String, default: "name" },
  itemValue: { type: String, default: "docId" },
  modelValue: { type: [String, Object], default: null },
  returnObject: { type: Boolean, default: false },
});
const props = useDefaults(_props, "AutocompleteSite");
const emit = defineEmits(["update:model-value", "update:search", "site-selection-confirmed"]);

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const allSlots = useSlots();
const {
  clear,
  errorMessage,
  isEmpty,
  isLoading: isReading,
  lookupSite,
  notFound,
  searchAutocompleteSites,
} = useSiteUiReads();
const { fetchSiteComposable } = useFetch("SiteAutocomplete");
const { pushSite } = fetchSiteComposable;
const auth = useAuthStore();
const { canWrite, isSaving } = useSiteActions();
const confirmDialog = ref(false);
const pendingValue = ref(null);
const pendingSite = ref(null);
const pendingOriginalValue = ref(null);
const pendingCompanyId = ref(null);
const createCompanyId = ref(null);
let selectionSequence = 0;

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
/**
 * Returns a slot object excluding the `item` and `append` slots, which are used internally for rendering items with `EmployeeListItem` and the append slot for creating new employees.
 */
const slots = computed(() =>
  Object.fromEntries(
    Object.entries(allSlots).filter(
      ([name]) => name !== "item" && name !== "append",
    ),
  ),
);

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function clearPendingSelection() {
  confirmDialog.value = false;
  pendingValue.value = null;
  pendingSite.value = null;
  pendingOriginalValue.value = null;
  pendingCompanyId.value = null;
}

function cacheSite(site) {
  if (!(site instanceof Site) || !site.docId) return false;
  pushSite(site);
  return true;
}

function rememberCreateCompany() {
  createCompanyId.value = auth.companyId;
}

function onCreateHandler(event) {
  selectionSequence += 1;
  clear("lookup");
  clearPendingSelection();
  const companyId = createCompanyId.value;
  createCompanyId.value = null;
  if (!companyId || companyId !== auth.companyId || !cacheSite(event)) return;
  const emitValue = props.returnObject ? event : event[props.itemValue];
  emit("update:model-value", emitValue);
}

async function api(text) {
  clear("lookup");
  return await searchAutocompleteSites(text);
}

function onSearch(value) {
  if (!value) clear("autocomplete");
  emit("update:search", value);
}

async function resolveSelectedSite(value) {
  if (!value) return null;
  const raw = value?.raw || value;
  const id = typeof raw === "string" ? raw : raw?.[props.itemValue];
  return id ? await lookupSite(id) : null;
}

async function onSelection(value) {
  const sequence = ++selectionSequence;
  const companyId = auth.companyId;
  if (!value) {
    clear("lookup");
    confirmDialog.value = false;
    pendingValue.value = null;
    pendingSite.value = null;
    pendingOriginalValue.value = null;
    pendingCompanyId.value = null;
    emit("site-selection-confirmed", null);
    emit("update:model-value", value);
    return;
  }
  const originalValue = props.modelValue;
  clear("lookup");
  try {
    const site = await resolveSelectedSite(value);
    if (sequence !== selectionSequence || companyId !== auth.companyId) return;
    if (!(site instanceof Site)) {
      confirmDialog.value = false;
      pendingValue.value = null;
      pendingSite.value = null;
      pendingOriginalValue.value = null;
      pendingCompanyId.value = null;
      emit("update:model-value", originalValue);
      return;
    }
    if (site.status === "TERMINATED") {
      pendingValue.value = value;
      pendingSite.value = site;
      pendingOriginalValue.value = originalValue;
      pendingCompanyId.value = companyId;
      confirmDialog.value = true;
      return;
    }
    pendingValue.value = null;
    pendingSite.value = null;
    pendingOriginalValue.value = null;
    pendingCompanyId.value = null;
    confirmDialog.value = false;
    cacheSite(site);
    emit("site-selection-confirmed", null);
    emit("update:model-value", value);
  } catch {
    if (sequence !== selectionSequence || companyId !== auth.companyId) return;
    confirmDialog.value = false;
    pendingValue.value = null;
    pendingSite.value = null;
    pendingOriginalValue.value = null;
    pendingCompanyId.value = null;
    emit("update:model-value", originalValue);
  }
}

function confirmTerminatedSelection() {
  if (!pendingSite.value) return;
  if (pendingCompanyId.value !== auth.companyId) {
    selectionSequence += 1;
    confirmDialog.value = false;
    pendingValue.value = null;
    pendingSite.value = null;
    pendingOriginalValue.value = null;
    pendingCompanyId.value = null;
    emit("site-selection-confirmed", null);
    emit("update:model-value", null);
    return;
  }
  const context = Object.freeze({
    companyId: auth.companyId,
    siteId: pendingSite.value.docId,
    status: "TERMINATED",
  });
  cacheSite(pendingSite.value);
  emit("site-selection-confirmed", context);
  emit("update:model-value", pendingValue.value);
  confirmDialog.value = false;
  pendingValue.value = null;
  pendingSite.value = null;
  pendingOriginalValue.value = null;
  pendingCompanyId.value = null;
}

function cancelTerminatedSelection() {
  selectionSequence += 1;
  confirmDialog.value = false;
  const originalValue = pendingOriginalValue.value;
  pendingValue.value = null;
  pendingSite.value = null;
  pendingOriginalValue.value = null;
  pendingCompanyId.value = null;
  emit("site-selection-confirmed", null);
  emit("update:model-value", originalValue);
}

onBeforeUnmount(() => {
  selectionSequence += 1;
  clear();
  pendingValue.value = null;
  pendingSite.value = null;
  pendingOriginalValue.value = null;
  pendingCompanyId.value = null;
  createCompanyId.value = null;
});
</script>

<template>
  <air-autocomplete-api
    v-bind="$attrs"
    :api="api"
    :fetch-item-by-key-api="lookupSite"
    :custom-filter="() => true"
    :model-value="props.modelValue"
    api-error-message="現場を検索できませんでした。"
    hint="名称入力で検索"
    :item-title="itemTitle"
    :item-value="itemValue"
    :label="label"
    persistent-hint
    :return-object="returnObject"
    @update:model-value="onSelection"
    @update:search="onSearch"
  >
    <template v-if="creatable && canWrite" #append>
      <SiteCreateDialog @created="onCreateHandler">
        <template #activator="{ open }">
          <v-btn
            :disabled="isSaving"
            icon="mdi-plus"
            size="small"
            aria-label="現場を新規登録"
            @click.capture="rememberCreateCompany"
            @click="open"
          />
        </template>
      </SiteCreateDialog>
    </template>

    <template #item="slotProps">
      <slot name="item" v-bind="slotProps">
        <SiteListItem v-bind="slotProps.props" :item="slotProps.item" />
      </slot>
    </template>

    <template #no-data>
      <v-list-item
        :title="isReading ? '検索中です' : errorMessage ? errorMessage : '該当する現場はありません'"
      />
    </template>

    <!-- スロットのパススルー -->
    <template v-for="(slotFn, name) in slots" #[name]="scope">
      <slot :name="name" v-bind="scope ?? {}"></slot>
    </template>
  </air-autocomplete-api>

  <v-alert v-if="notFound" density="compact" type="warning" variant="tonal" class="mt-2">
    選択された現場が見つかりません。
  </v-alert>
  <v-alert v-else-if="errorMessage" density="compact" type="error" variant="tonal" class="mt-2">
    {{ errorMessage }}
  </v-alert>
  <span v-else-if="isEmpty" class="text-caption text-medium-emphasis">検索結果は0件です。</span>

  <v-dialog v-model="confirmDialog" max-width="520" persistent>
    <v-card>
      <v-toolbar color="warning" density="compact" title="終了済み現場の確認" />
      <v-card-text>
        <div class="mb-3">この現場は終了済みです。残工事などの単発予定に使用しますか？</div>
        <SiteListItem v-if="pendingSite" :item="pendingSite" />
        <v-alert class="mt-3" type="info" variant="tonal">選択しても現場は再有効化されません。</v-alert>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn @click="cancelTerminatedSelection">キャンセル</v-btn>
        <v-btn color="warning" variant="flat" @click="confirmTerminatedSelection">終了済みのまま使用</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
