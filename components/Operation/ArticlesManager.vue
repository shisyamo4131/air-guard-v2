<script setup>
import { ArticleDetail, OperationBilling, OperationResult } from "@/schemas";
import ArticleDetailsManager from "@/components/ArticleDetails/Manager/index.vue";

class ArticleDetailRow extends ArticleDetail {
  constructor(item = {}) {
    super(item);
    if (item?._airGuardRowKey) this._airGuardRowKey = item._airGuardRowKey;
  }
}

defineOptions({ inheritAttrs: false });

const props = defineProps({
  doc: {
    type: Object,
    default: null,
    validator: (value) => value === null || value instanceof OperationBilling || value instanceof OperationResult,
  },
});

const articles = ref([]);
let nextRowKey = 0;
const rows = ref([]);
const activeRowKey = ref(null);
const busy = ref(false);
const error = ref("");
const disabled = computed(() => busy.value || !props.doc?.docId || (props.doc instanceof OperationResult && props.doc.isLocked && !(props.doc instanceof OperationBilling)));

function createRowKey() {
  return `${props.doc?.docId || "operation"}:${++nextRowKey}`;
}

function syncRows(doc) {
  if (activeRowKey.value) return;
  const nextArticles = doc?.articles || [];
  rows.value = nextArticles.map((item, index) => ({
    key: rows.value[index]?.key || createRowKey(),
    item,
  }));
}

watch(
  () => props.doc?.articles,
  (articles) => syncRows(props.doc),
  { immediate: true, deep: true },
);

function beforeEdit(mode, item) {
  if (disabled.value) return false;
  if (mode !== "CREATE" && !item?._airGuardRowKey) {
    throw new Error("稼働外売上行の識別情報を確認できません。");
  }
  activeRowKey.value = item?._airGuardRowKey || null;
  return true;
}

function clearEditing() {
  activeRowKey.value = null;
  syncRows(props.doc);
}

function toArticleDetail(item) {
  if (item instanceof ArticleDetail && !Object.hasOwn(item, "_airGuardRowKey")) return item;
  const { _airGuardRowKey, ...raw } = item || {};
  return new ArticleDetail(raw);
}

async function persist(nextArticles) {
  if (disabled.value) {
    const cause = new Error("稼働外売上の保存対象が編集可能な状態ではありません。");
    error.value = cause.message;
    throw cause;
  }
  busy.value = true;
  error.value = "";
  try {
    const draft = props.doc.clone();
    const canonicalArticles = nextArticles.map(toArticleDetail);
    draft.articles = canonicalArticles;
    if (props.doc instanceof OperationBilling) {
      await OperationBilling.runTransaction(async (transaction) => {
        await draft.update({ transaction });
      });
    } else {
      await draft.update();
    }
    articles.value = draft.articles;
    rows.value = canonicalArticles.map((item, index) => ({
      key: nextArticles[index]?._airGuardRowKey || rows.value[index]?.key || createRowKey(),
      item,
    }));
    activeRowKey.value = null;
    return true;
  } catch (cause) {
    error.value = cause?.message || "稼働外売上を保存できません。入力を保持して再試行してください。";
    throw cause;
  } finally {
    busy.value = false;
  }
}

async function handleCreate(item) {
  return await persist([...rows.value.map(({ item: row }) => row), item]);
}

async function handleUpdate(item) {
  const index = rows.value.findIndex(({ key }) => key === activeRowKey.value);
  if (index < 0) throw new Error("編集対象の稼働外売上行を確認できません。");
  const nextArticles = rows.value.map(({ item: row }) => row);
  nextArticles[index] = item;
  return await persist(nextArticles);
}

async function handleDelete(item) {
  const rowKey = item?._airGuardRowKey || activeRowKey.value;
  const nextRows = rows.value.filter(({ key }) => key !== rowKey);
  if (!rowKey || nextRows.length === rows.value.length) {
    throw new Error("削除対象の稼働外売上行を確認できません。");
  }
  return await persist(nextRows.map(({ item: row }) => row));
}

const displayArticles = computed(() => rows.value.map(({ key, item }) => new ArticleDetailRow({ ...item, _airGuardRowKey: key })));
</script>

<template>
  <v-alert v-if="error" class="mb-3" type="warning" variant="tonal">{{ error }}</v-alert>
  <ArticleDetailsManager
    v-if="props.doc"
    v-bind="$attrs"
    :model-value="displayArticles"
    :schema="ArticleDetailRow"
    item-key="_airGuardRowKey"
    :disabled="disabled"
    :before-edit="beforeEdit"
    :handle-create="handleCreate"
    :handle-update="handleUpdate"
    :handle-delete="handleDelete"
    @quit="clearEditing"
  />
</template>
