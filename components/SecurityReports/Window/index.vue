<script setup>
/*****************************************************************************
 * @file ./components/SecurityReports/Window/index.vue
 * @description A component to display `SecurityReports`.
 * @extends VWindow
 *
 * 警備日報写真を表示するためのコンポーネントです。
 *
 * @property {Object} imgProps - `v-img` に渡すプロパティ。例: `{ height: 360 }`
 * @property {Array} reports - 表示するレポートの配列。各レポートは `{ url: string, thumbUrl?: string }` の形式である必要があります。
 * @property {Boolean} thumb - `true` の場合、サムネイルがあればサムネイルを表示し、なければ本体 URL を表示します。`false` の場合は常に本体 URL を表示します。
 *
 * @emits currentReport - 現在表示されているレポートが変更されたときに emit されます。ペイロードは新しいレポートオブジェクトです。
 *****************************************************************************/
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  imgProps: { type: Object, default: () => ({}) },
  reports: { type: Array, default: () => [] },
  thumb: { type: Boolean, default: false },
});
const props = useDefaults(_props, "SecurityReportsWindow");
const emit = defineEmits(["update:currentReport", "currentReport"]);

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const window = ref(0);

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
/**
 * `props.reports` の参照が変更されたときに `window` をリセットします。
 * これにより、レポートの内容が変更されたときに常に最初のレポートが表示されるようになります。
 */
watch(
  () => props.reports,
  () => (window.value = 0),
);

/**
 * `window` のインデックスが変更されたときに、または `reports` の内容が変更されたときに、
 * 現在表示されているレポートを emit します。
 * これにより、親コンポーネントは現在表示されているレポートを知ることができます。
 */
watchEffect(() => {
  const currentReport = props.reports[window.value] || null;
  emit("currentReport", currentReport);
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
</script>

<template>
  <v-window v-model="window" show-arrows>
    <v-window-item
      v-for="(report, n) in props.reports"
      :key="n"
      class="fill-height"
    >
      <!-- thumb: true - サムネイルがあればサムネイル、なければ本体 URL を表示 -->
      <!-- thumb: false - 本体 URL を表示 -->
      <v-img
        v-bind="props.imgProps"
        class="fill-height"
        :src="props.thumb ? (report.thumbUrl ?? report.url) : report.url"
        :aspect-ratio="16 / 9"
      >
        <template #placeholder>
          <v-row class="fill-height ma-0" align="center" justify="center">
            <v-progress-circular indeterminate color="grey" />
          </v-row>
        </template>
      </v-img>
    </v-window-item>
  </v-window>
</template>

<style scoped>
:deep(.v-window__container) {
  height: 100%;
}
</style>
