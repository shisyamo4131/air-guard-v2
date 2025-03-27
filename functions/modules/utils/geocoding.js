/**
 * Geocoding API を使って住所から緯度・経度・正規化された住所を取得するためのユーティリティです。
 */
import { defineString } from "firebase-functions/params";
import { logger } from "firebase-functions/v2";

/**
 * 住所から緯度・経度・正規化住所を取得して返します。
 * @param {string} address - 住所
 * @return {Promise<{ lat: number, lng: number, formattedAddress: string } | null>}
 */
export async function fetchCoordinates(address) {
  try {
    if (!address || typeof address !== "string") {
      throw new Error(`引数 'address' を文字列で指定する必要があります。`);
    }

    const GEOCODING_API_KEY = defineString("GEOCODING_API_KEY");
    const apiKey = GEOCODING_API_KEY.value();

    if (!apiKey) throw new Error(`APIキーが取得できませんでした。`);

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK") {
      logger.info(
        `[fetchCoordinates] 取得した座標: ${data.results[0].geometry.location.lat}, ${data.results[0].geometry.location.lng}`
      );
      return {
        lat: data.results[0].geometry.location.lat,
        lng: data.results[0].geometry.location.lng,
        formattedAddress: data.results[0].formatted_address,
      };
    } else {
      logger.warn(
        `[fetchCoordinates] Geocoding API から有効なデータを取得できませんでした: ${address}`,
        data
      );
      return null;
    }
  } catch (err) {
    logger.error(`[fetchCoordinates] ${err.message}`);
    throw err;
  }
}
