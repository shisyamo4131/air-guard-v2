/**
 * 住所文字列から緯度・経度・正規化された住所表記を取得するためのユーティリティ
 * `fetchCoordinates` を呼び出すための API エントリーポイントを提供します。
 */
import { onCall } from "firebase-functions/v2/https";
import { fetchCoordinates } from "./utils/geocoding.js";

export const geocoding = onCall(
  { region: "asia-northeast1" },
  async (request) => {
    const { address } = request.data;

    if (!address || typeof address !== "string") {
      throw new Error("Address is required");
    }

    try {
      const coordinates = await fetchCoordinates(address);

      if (coordinates) {
        return coordinates;
      } else {
        throw new Error(
          `有効なデータが取得できませんでした。address: ${address}`
        );
      }
    } catch (err) {
      throw new Error(err.message);
    }
  }
);
