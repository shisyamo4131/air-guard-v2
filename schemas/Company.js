import { Company as BaseClass } from "air-guard-v2-schemas";
import { fetchCoordinates } from "../utils/geocoding.js";

export class Company extends BaseClass {
  async beforeUpdate() {
    // prefecture, city, address プロパティから完全な住所を構築します。
    // null、undefined、または空文字列の可能性を考慮してフィルタリングします。
    const addressParts = [this.prefecture, this.city, this.address].filter(
      (part) => typeof part === "string" && part.trim() !== ""
    );

    if (addressParts.length === 0) {
      console.warn(
        "[Company.beforeUpdate] 住所情報（prefecture, city, address）がすべて空です。ジオコーディングできません。"
      );
      this.location = null; // 住所が実質的に空の場合は location をクリアします。
      return;
    }

    const fullAddress = addressParts.join(""); // 日本の住所は通常スペースなしで連結します。
    console.log(
      `[Company.beforeUpdate] ジオコーディング対象の住所: ${fullAddress}`
    );

    try {
      const coordinates = await fetchCoordinates(fullAddress);

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
        console.log(
          `[Company.beforeUpdate] ジオコーディング成功。緯度: ${this.location.lat}, 経度: ${this.location.lng}`
        );
      } else {
        console.warn(
          `[Company.beforeUpdate] 住所から座標を取得できませんでした: ${fullAddress}`
        );
        this.location = null; // 取得失敗または無効なデータの場合は location を null に設定します。
      }
    } catch (error) {
      console.error(
        `[Company.beforeUpdate] 住所のジオコーディング中にエラーが発生しました: ${fullAddress}`,
        error
      );
      this.location = null; // 例外発生時も location を null に設定します。
    }
  }
}
