/**
 * @file ./schemas/Company.js
 * @description 会社情報クラス
 *  - `beforeUpdate` で `location` を取得します。
 */
import { Company as BaseClass } from "air-guard-v2-schemas";
import { fetchCoordinates } from "../utils/geocoding.js";

export class Company extends BaseClass {
  /**
   * `prefecture`, `city`, `address` にセットされている値をもとに `location` を取得してセットします
   * @returns {Promise<void>}
   */
  async beforeUpdate() {
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

    // 住所情報が設定されていなければ `location` は null に設定
    if (!currentFullAddress || currentFullAddress.trim() === "") {
      // console.warn(
      //   "[Company.beforeUpdate] 住所情報が空です。ジオコーディングできません。"
      // );
      this.location = null; // 住所が実質的に空の場合は location をクリア
      return;
    }
    // console.log(
    //   `[Company.beforeUpdate] ジオコーディング対象の住所: ${currentFullAddress}`
    // );

    try {
      // 住所から座標を取得
      const coordinates = await fetchCoordinates(currentFullAddress);

      // 正常なデータが取得できたら `location` をセット
      if (
        coordinates &&
        typeof coordinates.lat === "number" &&
        typeof coordinates.lng === "number"
      ) {
        this.location = {
          lat: coordinates.lat,
          lng: coordinates.lng,
          formattedAddress: coordinates.formattedAddress,
        };
        // console.log(
        //   `[Company.beforeUpdate] ジオコーディング成功。緯度: ${this.location.lat}, 経度: ${this.location.lng}`
        // );
      } else {
        console.warn(
          `[Company.beforeUpdate] 住所から座標を取得できませんでした: ${currentFullAddress}`
        );
        this.location = null; // 取得失敗または無効なデータの場合は location を null に設定
      }
    } catch (error) {
      console.error(
        `[Company.beforeUpdate] 住所のジオコーディング中にエラーが発生しました: ${currentFullAddress}`,
        error
      );
      this.location = null; // 例外発生時も location を null に設定
      throw error;
    }
  }
}
