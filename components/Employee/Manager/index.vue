<script setup>
/*****************************************************************************
 * @file ./components/Employee/Manager/index.vue
 * @description 従業員管理コンポーネント
 * @extends AirItemManager
 *****************************************************************************/
import { useSlots } from "vue";
import { useDocManager } from "@/composables/useDocManager";
import { useDefaults } from "vuetify";

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
      "code", // 従業員コード
      "lastName", // 姓
      "firstName", // 名
      "lastNameKana", // 姓（カナ）
      "firstNameKana", // 名（カナ）
      "displayName", // 表示名
      "gender", // 性別
      "dateOfBirth", // 生年月日
      "dateOfHire", // 入社日
      "title", // 肩書
      "zipcode", // 郵便番号
      "prefCode", // 都道府県コード
      "city", // 市区町村
      "address", // 住所
      "building", // 建物名
      "mobile", // 携帯電話番号
      "email", // メールアドレス
      "nationality", // 国籍
      "isForeigner", // 外国人かどうか
      "foreignName", // 外国人氏名
      "residenceStatus", // 在留資格
      "periodOfStay", // 在留期間
      "remarks", // 備考
    ],
  },
  securityGuard: {
    title: "警備員資格情報",
    includedKeys: [
      "hasSecurityGuardRegistration", // 警備員資格登録の有無
      "dateOfSecurityGuardRegistration", // 警備員資格登録日
      "bloodType", // 血液型
      "emergencyContactName", // 緊急連絡先氏名
      "emergencyContactRelation", // 緊急連絡先との関係
      "emergencyContactRelationDetail", // 緊急連絡先との関係詳細
      "emergencyContactAddress", // 緊急連絡先住所
      "emergencyContactPhone", // 緊急連絡先電話番号
      "domicile", // 本籍地
    ],
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
const props = useDefaults(_props, "EmployeeManager");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const slots = useSlots();
/** AirItemManager への基本的な設定を useDocManager から取得 */
const docManager = useDocManager("EmployeeManager", { doc: props.doc });

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
/**
 * スロットのうち、activator と default スロットを除いたものをパススルー用に抽出する計算プロパティ
 * - activator スロットは AirItemManager 内で使用されるため、パススルーしない
 * - default スロットは activator 内で明示的に使用されるため、パススルーしない
 * - その他のスロットは AirItemManager を通じて親コンポーネントから子コンポーネントへパススルーする
 */
const pathThroughSlots = computed(() => {
  const { activator, default: _default, ...other } = slots;
  return other;
});
</script>

<template>
  <air-item-manager
    v-bind="docManager.attrs.value"
    hide-delete-btn
    :label="props.title || DEFINITION[props.type].title"
    :included-keys="DEFINITION[props.type].includedKeys"
  >
    <template #activator="slotProps">
      <v-card>
        <v-toolbar
          color="secondary"
          density="compact"
          :title="props.title || DEFINITION[props.type].title"
        >
          <template #append>
            <v-btn
              icon="mdi-pencil"
              size="small"
              @click="() => slotProps.toUpdate()"
            />
          </template>
        </v-toolbar>
        <v-card-text class="py-0">
          <slot name="default" v-bind="slotProps" />
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
