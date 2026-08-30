/**
 * @file ./schemas/Company.js
 * @description 会社情報クラス
 *  - GeocodableMixin により自動的にジオコーディング機能を提供します。
 *  - `delete` は許可されていません。
 */
import { Company as BaseClass } from "@shisyamo4131/air-guard-v2-schemas";

export default class Company extends BaseClass {
  // 後日実装予定のカスタムカラー用プロパティ
  // static classProps = {
  //   ...BaseClass.classProps,
  //   colorDefinitions: {
  //     type: Object,
  //     default: () => {
  //       return {
  //         dayType: {
  //           WEEKDAY: "green",
  //           SATURDAY: "blue",
  //           SUNDAY: "red",
  //           HOLIDAY: "pink",
  //         },
  //         shiftType: {
  //           DAY: "deep-orange",
  //           NIGHT: "indigo",
  //         },
  //       };
  //     },
  //   },
  // };

  async delete() {
    throw new Error("Companyドキュメントの削除は許可されていません。");
  }
}
