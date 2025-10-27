/**
 * 住所文字列から緯度・経度・正規化された住所表記を取得するためのユーティリティ
 * `fetchCoordinates` を呼び出すための API エントリーポイントを提供します。
 */
import { onCall } from "firebase-functions/v2/https";
import { fetchCoordinates } from "./utils/geocoding.js";

// onCall は自動的に CORS が false に設定され、Cloud Run 側で適宜処理される？？？
export const geocoding = onCall(
  // { region: "asia-northeast1", cors: ["https://air-guard-v2-dev.web.app"] },
  // { region: "asia-northeast1", cors: false },
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
