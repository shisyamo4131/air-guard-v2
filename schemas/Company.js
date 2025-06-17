/**
 * @file ./schemas/Company.js
 * @description 会社情報クラス
 *  - `beforeUpdate` で `location` を取得します。
 */
import { Company as BaseClass } from "air-guard-v2-schemas"; // fetchCoordinates is no longer directly used here
import { geocodeAndSetLocation } from "./utils/addressGeocoding.js";

export default class Company extends BaseClass {
  /**
   * `prefecture`, `city`, `address` にセットされている値をもとに `location` を取得してセットします
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
      //   `[Company.beforeUpdate] 住所 (fullAddress) に変更がないため、ジオコーディングをスキップします。Previous: "${previousFullAddress}", Current: "${currentFullAddress}"`
      // );
      return;
    }

    // 住所に基づいてジオコーディングを実行
    await geocodeAndSetLocation(this, "Company", "beforeUpdate");
  }
}
