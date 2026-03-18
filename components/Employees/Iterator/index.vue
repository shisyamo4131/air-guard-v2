<script setup>
/*****************************************************************************
 * @file ./components/Employees/Iterator/index.vue
 * @description 従業員情報表示用データイテレーターコンポーネント
 * - `useExtendDataIterator` を使用して v-data-iterator を拡張しています。
 * - `update:modelValue` イベントのペイロードは、`selectStrategy` に応じて、単一の値、配列、またはオブジェクトになります。
 *
 * @author shisyamo4131
 *
 * @property {Array} employees - 表示する従業員情報の配列
 * @property {Boolean} hideDefaultFooter - デフォルトのフッターを非表示にするかどうかを指定するプロパティ
 * @property {Object|Array|String|Number} modelValue - 選択されたアイテムの値。selectStrategy に応じて、単一の値、配列、またはオブジェクトになる。
 * @property {Boolean} showCreate - 新規登録機能の表示有無
 * @property {Boolean} showEdit - 編集ボタンの表示有無
 * @property {Boolean} showDetail - 詳細ボタンの表示有無
 *
 * - その他、v-data-iterator に実装されているすべてのプロパティが使用可能です。
 * @see https://v3.vuetifyjs.com/en/api/v-data-iterator/#props
 *
 * @emits click:create - 新規登録ボタンがクリックされたときに発火するイベント。
 * @emits click:detail - 詳細ボタンがクリックされたときに発火するイベント。引数は詳細対象の従業員情報オブジェクト。
 * @emits click:edit - 編集ボタンがクリックされたときに発火するイベント。引数は編集対象の従業員情報オブジェクト。
 * @emits update:modelValue - 選択されたアイテムが変更されたときに発火するイベント。引数は selectStrategy に応じた形式の選択された値。
 *
 * @slot header - ヘッダーコンテンツを挿入するためのスロット。
 *  @see https://v3.vuetifyjs.com/en/api/v-data-iterator/#slots-header
 *
 * @slot default - 従業員情報オブジェクト群を表示するためのスロット。
 *  @see https://v3.vuetifyjs.com/en/api/v-data-iterator/#slots-default
 *
 * @slot item - 各従業員情報アイテムの表示をカスタマイズするためのスロット。スロットプロパティには、従業員情報オブジェクト、選択状態、編集・展開・選択機能の表示有無などが含まれます。
 *  @property {Object} employee - アイテムに対応する従業員情報オブジェクト
 *  @property {Boolean} isSelected - アイテムが選択されているかどうか
 *  @property {Boolean} showDetail - 詳細ボタンの表示有無
 *  @property {Boolean} showEdit - 編集ボタンの表示有無
 *  @property {Boolean} showSelect - 選択チェックボックスの表示有無
 *  @property {Function} onClick:detail - 詳細ボタンがクリックされたときのイベントハンドラー
 *  @property {Function} onClick:edit - 編集ボタンがクリックされたときのイベントハンドラー
 *  @property {Function} onClick:select - アイテムが選択されたときのイベントハンドラー
 *
 * @slot footer - フッターコンテンツを挿入するためのスロット。
 *  @see https://v3.vuetifyjs.com/ja/components/data-iterators/#slots-footer
 *****************************************************************************/
import {
  props as compProps,
  emit as compEmit,
  useExtendDataIterator,
} from "@/composables/extends/useExtendDataIterator.js";
import { useDefaults } from "vuetify";

defineOptions({ name: "EmployeesIterator" });

/** SETUP PROPS & EMITS */
const _props = defineProps({
  ...compProps,
  employees: { type: Array, default: () => [] },
  hideDefaultFooter: { type: Boolean, default: false },
  showCreate: { type: Boolean, default: false },
  showEdit: { type: Boolean, default: false },
  showSelect: { type: Boolean, default: false },
});
const props = useDefaults(_props, "EmployeesIterator");
const emit = defineEmits([
  ...compEmit,
  "click:create",
  "click:detail",
  "click:edit",
]);

/** SETUP COMPOSABLES */
const { attrs } = useExtendDataIterator(props, emit);
</script>

<template>
  <v-data-iterator
    v-bind="attrs"
    item-value="docId"
    :items="props.employees"
    :show-select="props.showSelect"
    :sort-by="[{ key: 'fullNameKana' }]"
  >
    <!-- HEADER -->
    <template #header="slotProps">
      <!-- SLOT: header -->
      <!-- @see https://v3.vuetifyjs.com/ja/components/data-iterators/#slots-header -->
      <slot name="header" v-bind="slotProps" />
    </template>

    <!-- DEFAULT -->
    <template #default="defaultSlotProps">
      <!-- SLOT: default -->
      <slot name="default" v-bind="defaultSlotProps">
        <!-- grid container -->
        <div class="grid-container">
          <!-- ELEMENTS -->
          <div v-for="item in defaultSlotProps.items" :key="item.docId">
            <!-- SLOT: item -->
            <slot
              name="item"
              v-bind="{
                employee: item.raw,
                isSelected: defaultSlotProps.isSelected([item]),
                showDetail: props.showDetail,
                showEdit: props.showEdit,
                showSelect: props.showSelect,
                'onClick:detail': () => emit('click:detail', item.raw),
                'onClick:edit': () => emit('click:edit', item.raw),
                'onClick:select': () =>
                  defaultSlotProps.select(
                    [item],
                    !defaultSlotProps.isSelected([item]),
                  ),
              }"
            >
              <EmployeeCard
                v-bind="{
                  employee: item.raw,
                  isSelected: defaultSlotProps.isSelected([item]),
                  showEdit: props.showEdit,
                  showDetail: props.showDetail,
                  showSelect: props.showSelect,
                  'onClick:detail': () => emit('click:detail', item.raw),
                  'onClick:edit': () => emit('click:edit', item.raw),
                  'onClick:select': () =>
                    defaultSlotProps.select(
                      [item],
                      !defaultSlotProps.isSelected([item]),
                    ),
                }"
              />
            </slot>
          </div>
        </div>
      </slot>
    </template>

    <!-- NO DATA -->
    <template #no-data>
      <v-card>
        <v-empty-state
          title="従業員情報はありません"
          icon="mdi-alert-circle-outline"
          :action-text="props.showCreate ? '新規登録' : undefined"
          color="primary"
          @click:action="() => emit('click:create')"
        >
          <template #text>
            <div>指定された条件に該当する従業員情報は登録されていません。</div>
          </template>
        </v-empty-state>
      </v-card>
    </template>

    <!-- FOOTER -->
    <template #footer="slotProps">
      <!-- SLOT: footer -->
      <!-- @see https://v3.vuetifyjs.com/ja/components/data-iterators/#slots-footer -->
      <slot name="footer" v-bind="slotProps">
        <MoleculesPagination
          v-bind="{
            page: slotProps.page,
            pageCount: slotProps.pageCount,
            'onClick:prev': slotProps.prevPage,
            'onClick:next': slotProps.nextPage,
          }"
        />
      </slot>
    </template>
  </v-data-iterator>
</template>

<style scoped>
/* v-data-iterator 自体の設定 */
.v-data-iterator {
  display: flex; /* フレックスコンテナにして、子要素を縦に並べる */
  flex-direction: column;
  height: 100%; /* 高さを100%にして、親コンテナの高さを継承 */
  overflow-y: hidden; /* overflow-y: hidden を設定して、スクロールバーを非表示にする */
}

/* v-data-iterator は default スロットのルート要素に div を描画する */
/* これをスクロールコンテナとして使用する */
.v-data-iterator > :deep(div) {
  padding: 8px; /* 内側の余白を追加 -> これを設定しないとモバイル表示の際にスクロールバーの表示が崩れる */
  flex-grow: 1; /* フレックスアイテムが利用可能なスペースをすべて占めるようにする */
  overflow-y: auto;
}

/* grid container の設定 */
.grid-container {
  display: grid;
  gap: 16px;
  /* 1列あたりの最小幅を240px、最大幅を利用可能なスペース全体に設定 */
  /* minmax: 指定した最小値、最大値の範囲内で定義 */
  /* repeat: 繰り返し定義。auto-fill は利用可能なスペースに収まるだけ列を作成する。 */
  /* 結果、親要素の横幅に対して最小幅240pxの列ができるだけ多く配置される */
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
}
</style>
