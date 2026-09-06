<script setup>
import { useOperationRows } from "@/composables/application/operation/useOperationRows";
import { useOperationEditor } from "@/composables/application/operation/useOperationEditor";
import RowInput from "./RowInput.vue";
import { useFetch } from "@/composables/fetch/useFetch";
const props = defineProps({ documentId: { type: String, required: true }, kind: { type: String, default: "result" }, group: { type: String, default: "workers" }, label: { type: String, default: "作業員" }, disabled: { type: Boolean, default: false } });
const { fetchArticleComposable } = useFetch("OperationRowsManager");
const { cachedArticles, fetchArticle } = fetchArticleComposable;
const editor = useOperationEditor({ kind: props.kind, defaultAction: props.group });
const { raw, readError } = useOperationRows(props, editor, (value) => { if (props.group === "articles" && Array.isArray(value.articles)) fetchArticle(value.articles.map((item) => item.articleId)); });
const rows = computed(() => {
  if (!raw.value) return [];
  return (props.group === "articles" ? ["articles"] : ["employees", "outsourcers"]).flatMap((array) => (raw.value[array] || []).map((item, position) => ({ array, position, item, raw: raw.value })));
});
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
    <v-table>
      <tbody>
        <tr v-for="row in rows" :key="`${row.array}/${row.position}`">
          <td><WorkerChip v-if="group === 'workers'" :worker="row.item" /><span v-else>{{ cachedArticles[row.item.articleId]?.name || '商品名を取得中' }}</span></td>
          <td>{{ group === 'workers' ? `${row.item.startTime || ''} ～ ${row.item.endTime || ''}` : `${row.item.price}円 × ${row.item.quantity}` }}</td>
          <td class="text-right">
            <v-btn icon="mdi-pencil" size="small" variant="text" :aria-label="`${row.array} ${row.position + 1}行目を編集`" :disabled="disabled" @click="open('update', row)" />
            <v-btn icon="mdi-delete" size="small" variant="text" :aria-label="`${row.array} ${row.position + 1}行目を削除`" :disabled="disabled" @click="open('remove', row)" />
          </td>
        </tr>
      </tbody>
    </v-table>
    <OperationEditor :controller="editor" :title="label" :custom-input="RowInput" />
  </v-card>
</template>
