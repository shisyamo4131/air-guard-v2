/**
 * @file components/Outsourcer/Tag/test.mock.js
 * @description OutsourcerTagコンポーネントのテスト用モックデータ
 * - Outsourcerクラスのインスタンスとして様々なケースをカバー
 */
import { Outsourcer } from "@/schemas";

/**
 * 外注先モックデータ
 * - remarksに各ケースの説明を記載
 */
export const mockOutsourcers = [
  // ケース1: 通常の外注先（契約中）
  new Outsourcer({
    docId: "outsourcer001abc123def",
    code: "OUT001",
    name: "セキュリティサービス株式会社",
    nameKana: "セキュリティサービスカブシキガイシャ",
    displayName: "セキュリティSV",
    contractStatus: Outsourcer.STATUS_ACTIVE,
    remarks: "【モック】通常の外注先（契約中）",
  }),

  // ケース2: 大手警備会社
  new Outsourcer({
    docId: "outsourcer002xyz456ghi",
    code: "OUT002",
    name: "日本総合警備保障株式会社",
    nameKana: "ニホンソウゴウケイビホショウカブシキガイシャ",
    displayName: "日本総合警備",
    contractStatus: Outsourcer.STATUS_ACTIVE,
    remarks: "【モック】大手警備会社（全国展開）",
  }),

  // ケース3: 地域密着型の警備会社
  new Outsourcer({
    docId: "outsourcer003mno789jkl",
    code: "OUT003",
    name: "東京都市警備株式会社",
    nameKana: "トウキョウトシケイビカブシキガイシャ",
    displayName: "東京都市警備",
    contractStatus: Outsourcer.STATUS_ACTIVE,
    remarks: "【モック】地域密着型の警備会社（東京都内専門）",
  }),

  // ケース4: 契約終了した外注先
  new Outsourcer({
    docId: "outsourcer004pqr012stu",
    code: "OUT004",
    name: "グローバルセキュリティ株式会社",
    nameKana: "グローバルセキュリティカブシキガイシャ",
    displayName: "グローバルSC",
    contractStatus: Outsourcer.STATUS_TERMINATED,
    remarks: "【モック】契約終了した外注先",
  }),

  // ケース5: 施設警備専門会社
  new Outsourcer({
    docId: "outsourcer005vwx345yza",
    code: "OUT005",
    name: "株式会社アイビーシステム",
    nameKana: "カブシキガイシャアイビーシステム",
    displayName: "IB-System",
    contractStatus: Outsourcer.STATUS_ACTIVE,
    remarks: "【モック】施設警備専門会社",
  }),

  // ケース6: 交通誘導専門会社
  new Outsourcer({
    docId: "outsourcer006bcd678efg",
    code: "OUT006",
    name: "ロードガードサービス株式会社",
    nameKana: "ロードガードサービスカブシキガイシャ",
    displayName: "ロードガード",
    contractStatus: Outsourcer.STATUS_ACTIVE,
    remarks: "【モック】交通誘導専門会社",
  }),

  // ケース7: 新規契約の外注先
  new Outsourcer({
    docId: "outsourcer007hij901klm",
    code: "OUT007",
    name: "セーフティパートナーズ株式会社",
    nameKana: "セーフティパートナーズカブシキガイシャ",
    displayName: "セーフティP",
    contractStatus: Outsourcer.STATUS_ACTIVE,
    remarks: "【モック】新規契約の外注先（2026年1月契約開始）",
  }),

  // ケース8: イベント警備専門会社
  new Outsourcer({
    docId: "outsourcer008nop234qrs",
    code: "OUT008",
    name: "株式会社イベントセキュリティジャパン",
    nameKana: "カブシキガイシャイベントセキュリティジャパン",
    displayName: "イベントSJ",
    contractStatus: Outsourcer.STATUS_ACTIVE,
    remarks: "【モック】イベント警備専門会社",
  }),

  // ケース9: 機械警備会社
  new Outsourcer({
    docId: "outsourcer009tuv567wxy",
    code: "OUT009",
    name: "テクノガードシステムズ株式会社",
    nameKana: "テクノガードシステムズカブシキガイシャ",
    displayName: "テクノガード",
    contractStatus: Outsourcer.STATUS_ACTIVE,
    remarks: "【モック】機械警備・セキュリティシステム会社",
  }),

  // ケース10: 略称が短い外注先
  new Outsourcer({
    docId: "outsourcer010zab890cde",
    code: "OUT010",
    name: "エスピーケイサービス株式会社",
    nameKana: "エスピーケイサービスカブシキガイシャ",
    displayName: "SPK",
    contractStatus: Outsourcer.STATUS_ACTIVE,
    remarks: "【モック】略称が短い外注先（アルファベット3文字）",
  }),
];
