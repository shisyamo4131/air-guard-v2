<script setup>
/*****************************************************************************
 * @file ./components/Sites/Iterator/index.vue
 * @description 現場情報表示用データイテレーターコンポーネント
 * @author shisyamo4131
 * @extends AirDataIterator
 *
 * @property {Array} sites - 表示する現場情報の配列
 * @property {Object|Array|String|Number} modelValue - 選択されたアイテムの値。selectStrategy に応じて、単一の値、配列、またはオブジェクトになる。
 * @property {Boolean} showCreate - 新規登録機能の表示有無
 * @property {Boolean} showEdit - 編集ボタンの表示有無
 * @property {Boolean} showDetail - 詳細ボタンの表示有無
 *
 * - その他、AirDataIterator に実装されているすべてのプロパティが使用可能です。
 * @property {String|Number} gap - アイテム間のギャップ。CSS の gap プロパティと同様の値を取ります。数値の場合はピクセル単位として解釈されます。
 * @property {Boolean} grid - アイテムをグリッドレイアウトで表示するかどうか
 * @property {Boolean} hideDefaultFooter - デフォルトのフッターを非表示にするかどうかを指定するプロパティ
 * @property {String|Number} minColumnWidth - グリッドレイアウトの最小列幅。CSS の minmax 関数の最小値として使用されます。数値の場合はピクセル単位として解釈されます。
 * @property {Object|Array} modelValue - 選択されたアイテムの値。`selectStrategy` に応じて、単一の値、配列、またはオブジェクトになる。
 * @property {String} selectStrategy - 選択戦略を指定するプロパティ。例: "single"（単一選択）や "page"（ページ単位選択）や "all"（全選択）など。
 * @property {Boolean} showExpand - 展開機能の表示有無
 * @property {Boolean} showSelect - 選択機能の表示有無
 *
 * - その他、v-data-iterator に実装されているすべてのプロパティが使用可能です。
 * @see https://v3.vuetifyjs.com/en/api/v-data-iterator/#props
 *
 * @emits click:create - 新規登録ボタンがクリックされたときに発火するイベント。
 * @emits click:detail - 詳細ボタンがクリックされたときに発火するイベント。引数は詳細対象の現場情報オブジェクト。
 * @emits click:edit - 編集ボタンがクリックされたときに発火するイベント。引数は編集対象の現場情報オブジェクト。
 * @emits update:modelValue - 選択されたアイテムが変更されたときに発火するイベント。引数は selectStrategy に応じた形式の選択された値。
 *
 * @slot header - ヘッダーコンテンツを挿入するためのスロット。
 *  @see https://v3.vuetifyjs.com/en/api/v-data-iterator/#slots-header
 *
 * @slot default - 現場情報オブジェクト群を表示するためのスロット。
 *  @see https://v3.vuetifyjs.com/en/api/v-data-iterator/#slots-default
 *
 * @slot item - 各現場情報アイテムの表示をカスタマイズするためのスロット。スロットプロパティには、現場情報オブジェクト、選択状態、編集・展開・選択機能の表示有無などが含まれます。
 *  @property {Object} site - アイテムに対応する現場情報オブジェクト
 *  @property {Function} isSelected - アイテムが選択されているかどうか
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
import { useDefaults } from "vuetify";

defineOptions({ name: "SitesIterator" });

/** SETUP PROPS & EMITS */
const _props = defineProps({
  sites: { type: Array, default: () => [] },
  hideDefaultFooter: { type: Boolean, default: false },
  showCreate: { type: Boolean, default: false },
  showDetail: { type: Boolean, default: false },
  showEdit: { type: Boolean, default: false },
});
const props = useDefaults(_props, "SitesIterator");
const emit = defineEmits(["click:create", "click:detail", "click:edit"]);
</script>

<template>
  <air-data-iterator item-value="docId" :items="props.sites">
    <!-- HEADER -->
    <template v-if="$slots.header" #header="slotProps">
      <!-- SLOT: header -->
      <!-- @see https://v3.vuetifyjs.com/ja/components/data-iterators/#slots-header -->
      <slot name="header" v-bind="slotProps" />
    </template>

    <!-- SLOT: DEFAULT -->
    <template v-if="$slots.default" #default="slotProps">
      <slot name="default" v-bind="slotProps" />
    </template>

    <template #item="{ item, isSelected, select, showSelect }">
      <SiteCard
        v-bind="{
          site: item.raw,
          isSelected: isSelected(item),
          showEdit: props.showEdit,
          showDetail: props.showDetail,
          showSelect: showSelect,
          'onClick:detail': () => emit('click:detail', item.raw),
          'onClick:edit': () => emit('click:edit', item.raw),
          'onClick:select': () => select([item], !isSelected(item)),
        }"
        style="position: relative"
      />
    </template>

    <!-- NO DATA -->
    <template #no-data>
      <v-card>
        <v-empty-state
          title="現場情報はありません"
          icon="mdi-alert-circle-outline"
          :action-text="props.showCreate ? '新規登録' : undefined"
          color="primary"
          @click:action="() => emit('click:create')"
        >
          <template #text>
            <div>指定された条件に該当する現場情報は登録されていません。</div>
          </template>
        </v-empty-state>
      </v-card>
    </template>
  </air-data-iterator>
</template>

<style scoped></style>
