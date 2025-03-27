/**
 * 住所文字列から緯度・経度・正規化された住所表記を取得するためのユーティリティ
 * `fetchCoordinates` を呼び出すための API エントリーポイントを提供します。
 */
import { onRequest } from "firebase-functions/v2/https";
import { fetchCoordinates } from "./utils/geocoding.js";

/** CORS 設定 */
const allowedOrigins = [
  "https://air-guard-v1-dev.web.app", // 本番環境
  "http://localhost:3000", // ローカル環境（ポートは必要に応じて変更）
];

export const geocoding = onRequest(
  { region: "asia-northeast1", cors: allowedOrigins },
  async (req, res) => {
    const { address } = req.query;

    if (!address || typeof address !== "string") {
      return res.status(400).json({ error: "Address is required" });
    }

    try {
      const coordinates = await fetchCoordinates(address);

      if (coordinates) {
        res.json(coordinates);
      } else {
        res.status(400).json({
          error: `有効なデータが取得できませんでした。address: ${address}`,
        });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);
