/**
 * @file ./schemas/Employee.js
 * @description ユーザー情報クラス
 */
// fetchCoordinates をインポート
import { fetchCoordinates } from "../utils/geocoding.js";
import { Employee as BaseClass } from "air-guard-v2-schemas";

export class Employee extends BaseClass {
  /**
   * 現在の `fullAddress` プロパティに基づいてジオコーディングを行い、`location` プロパティを設定します。
   * 住所情報が空の場合やジオコーディングに失敗した場合は `location` を `null` に設定します。
   * @param {string} context - 呼び出し元のコンテキスト（例: "beforeCreate", "beforeUpdate"）ログ出力用
   * @returns {Promise<void>}
   */
  async _geocodeAndSetLocation(context = "geocode") {
    const currentFullAddress = this.fullAddress;

    // 住所情報が設定されていなければ `location` は null に設定
    if (!currentFullAddress || currentFullAddress.trim() === "") {
      // console.warn(
      //   `[Employee.${context}] 住所情報が空です。ジオコーディングできません。`
      // );
      this.location = null; // 住所が実質的に空の場合は location をクリア
      return;
    }
    // console.log(
    //   `[Employee.${context}] ジオコーディング対象の住所: ${currentFullAddress}`
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
        //   `[Employee.${context}] ジオコーディング成功。緯度: ${this.location.lat}, 経度: ${this.location.lng}`
        // );
      } else {
        console.warn(
          `[Employee.${context}] 住所から座標を取得できませんでした: ${currentFullAddress}`
        );
        this.location = null; // 取得失敗または無効なデータの場合は location を null に設定
      }
    } catch (error) {
      console.error(
        `[Employee.${context}] 住所のジオコーディング中にエラーが発生しました: ${currentFullAddress}`,
        error
      );
      this.location = null; // 例外発生時も location を null に設定
      throw error; // エラーを再スローして呼び出し元に通知
    }
  }

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

    await this._geocodeAndSetLocation("beforeUpdate");
  }

  /**
   * 新しいドキュメントが作成される前に `location` を取得してセットします。
   * @returns {Promise<void>}
   */
  async beforeCreate() {
    // 親クラスの beforeCreate フック（外国籍のバリデーションなど）を実行
    await super.beforeCreate();

    // 住所に基づいてジオコーディングを実行
    await this._geocodeAndSetLocation("beforeCreate");
  }
}
