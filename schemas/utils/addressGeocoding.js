/**
 * @file ../../schemas/utils/addressGeocoding.js
 * @description Shared geocoding logic for schema classes.
 */
import { fetchCoordinates } from "@/utils/geocoding.js";

/**
 * Performs geocoding based on the instance's fullAddress and sets the location property.
 * @param {object} instance - The class instance (e.g., Company, Employee, Customer) that has `fullAddress` and `location` properties.
 * @param {string} className - The name of the class for logging purposes (e.g., "Company", "Employee").
 * @param {string} context - The context of the call for logging purposes (e.g., "beforeCreate", "beforeUpdate").
 * @returns {Promise<void>}
 * @throws {Error} Throws an error if geocoding fails, allowing the caller to handle it.
 */
export async function geocodeAndSetLocation(instance, className, context) {
  const currentFullAddress = instance.fullAddress;

  // 住所情報が設定されていなければ `location` は null に設定
  if (!currentFullAddress || currentFullAddress.trim() === "") {
    // console.warn(
    //   `[${className}.${context}] 住所情報が空です。ジオコーディングできません。`
    // );
    instance.location = null; // 住所が実質的に空の場合は location をクリア
    return;
  }
  // console.log(
  //   `[${className}.${context}] ジオコーディング対象の住所: ${currentFullAddress}`
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
      instance.location = {
        lat: coordinates.lat,
        lng: coordinates.lng,
        formattedAddress: coordinates.formattedAddress,
      };
      // console.log(
      //   `[${className}.${context}] ジオコーディング成功。緯度: ${instance.location.lat}, 経度: ${instance.location.lng}`
      // );
    } else {
      console.warn(
        `[${className}.${context}] 住所から座標を取得できませんでした: ${currentFullAddress}`
      );
      instance.location = null; // 取得失敗または無効なデータの場合は location を null に設定
    }
  } catch (error) {
    console.error(
      `[${className}.${context}] 住所のジオコーディング中にエラーが発生しました: ${currentFullAddress}`,
      error
    );
    instance.location = null; // 例外発生時も location を null に設定
    throw error; // エラーを再スローして呼び出し元に通知
  }
}
