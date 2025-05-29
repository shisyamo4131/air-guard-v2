/**
 * @file ./schemas/Employee.js
 * @description ユーザー情報クラス
 */
// fetchCoordinates is no longer directly used here
import { Employee as BaseClass } from "air-guard-v2-schemas";
import { geocodeAndSetLocation } from "./utils/addressGeocoding.js";

export class Employee extends BaseClass {
  /**
   * ドキュメントが更新される前に `location` を取得してセットします。
   * 住所に変更がない場合はジオコーディングをスキップします。
   * @returns {Promise<void>}
   */
  async beforeUpdate() {
    await super.beforeUpdate();

    const currentFullAddress = this.fullAddress;
    // FireModelの_beforeDataには、fetch時またはinitialize時のプロパティ値が格納されている
    // fullAddressがenumerable: trueであれば、_beforeDataにも含まれる
    const previousFullAddress = this._beforeData?.fullAddress;

    // _beforeDataが存在し、かつfullAddressに変更がない場合はジオコーディングをスキップ
    if (this._beforeData && currentFullAddress === previousFullAddress) {
      // console.log(
      //   `[Employee.beforeUpdate] 住所 (fullAddress) に変更がないため、ジオコーディングをスキップします。Previous: "${previousFullAddress}", Current: "${currentFullAddress}"`
      // );
      return;
    }

    await geocodeAndSetLocation(this, "Employee", "beforeUpdate");
  }

  /**
   * 新しいドキュメントが作成される前に `location` を取得してセットします。
   * @returns {Promise<void>}
   */
  async beforeCreate() {
    // 親クラスの beforeCreate フック（外国籍のバリデーションなど）を実行
    await super.beforeCreate();

    // 住所に基づいてジオコーディングを実行
    await geocodeAndSetLocation(this, "Employee", "beforeCreate");
  }
}
