<script setup>
import { useOperationRows } from "@/composables/application/operation/useOperationRows";
import { useOperationEditor } from "@/composables/application/operation/useOperationEditor";
import RowInput from "./RowInput.vue";
import { useFetch } from "@/composables/fetch/useFetch";
import { ArticleDetail, OperationResultDetail, SiteOperationScheduleDetail } from "@/schemas";
import { rawForClass } from "@/composables/domain/shared/valueContract";
import WorkersDataTable from "@/components/Workers/DataTable/index.vue";
import ArticleDetailsDataTable from "@/components/ArticleDetails/DataTable/index.vue";
const props = defineProps({ documentId: { type: String, required: true }, kind: { type: String, default: "result" }, group: { type: String, default: "workers" }, label: { type: String, default: "作業員" }, disabled: { type: Boolean, default: false } });
const { fetchArticleComposable } = useFetch("OperationRowsManager");
const { fetchArticle } = fetchArticleComposable;
const editor = useOperationEditor({ kind: props.kind, defaultAction: props.group });
const { raw, readError } = useOperationRows(props, editor, (value) => { if (props.group === "articles" && Array.isArray(value.articles)) fetchArticle(value.articles.map((item) => item.articleId)); });
const rows = computed(() => {
  if (!raw.value) return [];
  return (props.group === "articles" ? ["articles"] : ["employees", "outsourcers"]).flatMap((array) => (raw.value[array] || []).map((item, position) => ({ array, position, item, raw: raw.value })));
});
// Display models may be sorted by the table. Only this context identifies the
// original raw array position; model keys and visible indexes are not identity.
const displayContext = new WeakMap();
const displayItems = computed(() => rows.value.map((row) => {
  const Schema = props.group === "articles" ? ArticleDetail : props.kind === "schedule" ? SiteOperationScheduleDetail : OperationResultDetail;
  const item = new Schema(rawForClass(row.item));
  displayContext.set(item, row); return item;
}));
const displayKey = (item) => { const row = displayContext.get(toRaw(item)); return row ? `${row.array}/${row.position}` : undefined; };
const displayLabel = (item) => { const row = displayContext.get(toRaw(item)); return row ? `${row.array} ${row.position + 1}行目` : "明細"; };
function openDisplayed(action, item) {
  const row = displayContext.get(toRaw(item));
  if (!row || row.raw !== raw.value) return false;
  return open(action, row);
}
const disabled = computed(() => props.disabled || !raw.value || !editor.canWrite.value || (props.kind === "result" && raw.value.isLocked) || editor.busy.value);
function open(rowAction, row) {
  if (disabled.value) return;
  const array = row?.array || (props.group === "articles" ? "articles" : "employees");
  const snapshot = row?.raw || raw.value;
  const position = row?.position ?? snapshot[array].length;
  return editor.open("UPDATE", props.documentId, { action: props.group, rowAction, array, position, raw: snapshot });
}
</script>
<template>
  <v-card>
    <v-toolbar color="secondary" density="compact" :title="label">
      <v-spacer />
      <v-btn :disabled="disabled" :aria-label="group === 'articles' ? '稼働外売上を追加' : '従業員を追加'" @click="open('add')">{{ group === 'articles' ? '追加' : '従業員を追加' }}</v-btn>
      <v-btn v-if="group === 'workers'" :disabled="disabled" aria-label="外注先を追加" @click="open('add', { array: 'outsourcers' })">外注先を追加</v-btn>
    </v-toolbar>
    <v-alert v-if="readError" type="info">{{ readError }}</v-alert>
    <component :is="group === 'workers' ? WorkersDataTable : ArticleDetailsDataTable" :items="displayItems" :item-value="displayKey" :disabled="disabled" hide-search>
      <template v-if="group === 'workers'" #item.displayName="{ item }">
        <AtomsIconsHasLicense v-if="item.isQualified" size="x-small" />
        <WorkerChip :worker="item" />
      </template>
      <template #item.actions="{ item }">
        <v-btn icon="mdi-pencil" size="small" variant="text" :aria-label="`${displayLabel(item)}を編集`" :disabled="disabled" @click="openDisplayed('update', item)" />
        <v-btn icon="mdi-delete" size="small" variant="text" :aria-label="`${displayLabel(item)}を削除`" :disabled="disabled" @click="openDisplayed('remove', item)" />
      </template>
    </component>
    <OperationEditor :controller="editor" :title="label" :custom-input="RowInput" />
  </v-card>
</template>
