/**
 * Cloud Functions が提供する Geocoding API エントリーポイントを利用して
 * 住所文字列から緯度・経度・正規化された住所表記を取得するためのユーティリティです。
 */
import { httpsCallable } from "firebase/functions";
/**
 * 住所から整形された住所表記、緯度・経度を取得して返します。
 * @param {string} address - 住所
 * @returns {Promise<{ formattedAddress: string, lat: number, lng: number } | null>} - 整形された住所表記、緯度・経度のオブジェクト（取得できなかった場合は null）
 */
export async function fetchCoordinates(address) {
  const { $functions } = useNuxtApp();

  if (!address || typeof address !== "string") {
    console.warn("[fetchCoordinates] 無効な住所が渡されました:", address);
    return null;
  }

  try {
    console.log(`[fetchCoordinates] Geocoding API を呼び出し: ${address}`);

    const callable = httpsCallable($functions, "geocoding");
    const result = await callable({ address });

    const data = result.data;
    if (data.lat && data.lng) {
      console.log(`[fetchCoordinates] 取得した座標: ${data.lat}, ${data.lng}`);
      return {
        lat: data.lat,
        lng: data.lng,
        formattedAddress: data.formattedAddress,
      };
    } else {
      console.warn(
        "[fetchCoordinates] Geocoding API から座標を取得できませんでした:",
        data
      );
      return null;
    }
  } catch (error) {
    console.error("[fetchCoordinates] Geocoding API 呼び出し失敗:", error);
    return null;
  }
}
