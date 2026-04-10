<script setup>
/*****************************************************************************
 * @file ./components/Company/Manager/index.vue
 * @description 会社管理コンポーネント
 * @extends AirItemManager
 *****************************************************************************/
import { useSlots } from "vue";
import { useDocManager } from "@/composables/useDocManager";
import { useDefaults } from "vuetify";
import TableBaseInfo from "@/components/Company/Table/BaseInfo.vue";
import TableBankInfo from "@/components/Company/Table/BankInfo.vue";
import TableSettingInfo from "@/components/Company/Table/SettingInfo.vue";

/*****************************************************************************
 * コンポーネント設定定義
 * title: カードタイトルおよび編集画面タイトル
 * includedKeys: 編集対象プロパティ名の配列
 * viewer: カード内に表示する viewer コンポーネント
 *****************************************************************************/
const DEFINITION = {
  base: {
    title: "基本情報",
    includedKeys: [
      "companyName", // 会社名
      "companyNameKana", // 会社名（カナ）
      "tel", // 電話番号
      "fax", // FAX番号
      "zipcode", // 郵便番号
      "prefCode", // 都道府県コード
      "city", // 市区町村
      "address", // 町域・番地
      "building", // 建物名・部屋番号
    ],
    viewer: TableBaseInfo,
  },
  bank: {
    title: "口座情報",
    includedKeys: [
      "bankName", // 銀行名
      "branchName", // 支店名
      "accountType", // 口座種別
      "accountNumber", // 口座番号
      "accountHolder", // 口座名義
    ],
    viewer: TableBankInfo,
  },
  setting: {
    title: "設定情報",
    includedKeys: [
      "minuteInterval", // 時刻選択間隔（分）
      "roundSetting", // 端数処理
      "firstDayOfWeek", // 週の始まり
    ],
    viewer: TableSettingInfo,
  },
};

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  doc: { type: Object, required: true },
  title: { type: String, default: undefined },
  type: { type: String, default: "base" },
});
const props = useDefaults(_props, "CompanyManager");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const slots = useSlots();
/** AirItemManager への基本的な設定を useDocManager から取得 */
const docManager = useDocManager("CompanyManager", { doc: props.doc });

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
/**
 * スロットのうち、activator スロットを除いたものをパススルー用に抽出する計算プロパティ
 * - activator スロットは AirItemManager 内で使用されるため、パススルーしない
 * - その他のスロットは AirItemManager を通じて親コンポーネントから子コンポーネントへパススルーする
 */
const pathThroughSlots = computed(() => {
  const { activator, ...other } = slots;
  return other;
});

/*****************************************************************************
 * FUNCTIONS
 *****************************************************************************/
/**
 * 会社情報の作成はできないため、エラーをスローするハンドラー
 * @throws {Error} 会社情報の作成はできないことを示す
 */
function handleCreate() {
  throw new Error("会社情報の作成はできません。");
}

/**
 * 会社情報の削除はできないため、エラーをスローするハンドラー
 * @throws {Error} 会社情報の削除はできないことを示す
 */
function handleDelete() {
  throw new Error("会社情報の削除はできません。");
}
</script>

<template>
  <air-item-manager
    v-bind="docManager.attrs.value"
    :handle-create="handleCreate"
    :handle-delete="handleDelete"
    hide-delete-btn
    :label="props.title || DEFINITION[props.type].title"
    :included-keys="DEFINITION[props.type].includedKeys"
  >
    <template #activator="{ toUpdate, item }">
      <v-card>
        <v-toolbar
          color="secondary"
          density="compact"
          :title="props.title || DEFINITION[props.type].title"
        >
          <template #append>
            <v-btn icon="mdi-pencil" size="small" @click="() => toUpdate()" />
          </template>
        </v-toolbar>
        <v-card-text class="py-0">
          <component :is="DEFINITION[props.type].viewer" v-bind="item" />
        </v-card-text>
      </v-card>
    </template>

    <!-- スロットをパススルー -->
    <template
      v-for="(slotFn, slotName) in pathThroughSlots"
      #[slotName]="scope"
    >
      <slot :name="slotName" v-bind="scope ?? {}" />
    </template>
  </air-item-manager>
</template>
