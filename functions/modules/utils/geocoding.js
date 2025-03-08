/**
 * Geocoding API を使って住所から緯度・経度・正規化された住所を取得するためのユーティリティです。
 *
 * 1. Geocoding API KEY が必要になり、機密性の高い環境変数となるため Google Cloud Secret Manager の使用を推奨。
 * https://firebase.google.com/docs/functions/beta/config-env?hl=ja
 *
 * NOTE: .env ファイルに環境変数として用意して使うことも可能。その場合、gitignoreするのを忘れないようにすること。
 *       2025-03-06 シークレットの管理に不慣れなので、一旦 .env ファイルでテスト
 *
 * 2. Geocoding API の有効化
 * - GCP にアクセスし、当該プロジェクトの [APIとサービス] > [ライブラリ] に移動します。
 * - Geocoding API を有効にします。
 *
 * 3. API キーの発行と制限
 * - [API とサービス] から [Geocoding API] の [Keys] に移動します。
 * - [認証情報を作成] から [API キー] を選択します。
 * - API キーを作成したら、制限をかけます。サーバー側のキーなので「アプリケーションの制限」は「なし」、
 *   APIの制限で「Geocoding API」のみに制限します。名前は「SERVER」とでもしておくのが良いでしょう。
 *
 * 4. API キーを Cloud Functions の環境変数に設定します。
 * firebase functions:config:set GEOCODING_API_KEY="YOUR_GOOGLE_MAPS_API_KEY"
 *
 * [環境変数の利用]
 * defineString 関数に 環境変数のキーを渡すことで利用可能。
 * const { defineString } = require('firebase-functions/params')
 *
 * function hoge() {
 *  const API_KEY = defineString("API_KEY")
 *  const apiKey = API_KEY.value()
 * }
 *
 * - 関数の外で .value() を実行すると警告が出力される。
 *
 */
const { defineString } = require("firebase-functions/params");
const { logger } = require("firebase-functions/v2");

/**
 * 住所から緯度・経度・正規化住所を取得して返します。
 * @param {string} address - 住所
 * @return {Promise<{ lat: number, lng: number, formattedAddress: string } | null>} - 有効なデータが取得できなかった場合は null を返します。
 * @throws {Error} - 引数 `address` が与えられなかった、または文字列でなかった場合
 * @throws {Error} - API キーが取得できなかった場合
 * @throws {Error} - API によるデータの取得に失敗した場合
 */
async function fetchCoordinates(address) {
  try {
    if (!address || typeof address !== "string") {
      throw new Error(`引数 'address' を文字列で指定する必要があります。`);
    }

    // APIキーの取得
    const GEOCODING_API_KEY = defineString("GEOCODING_API_KEY");
    const apiKey = GEOCODING_API_KEY.value();

    if (!apiKey) throw new Error(`APIキーが取得できませんでした。`);

    // APIでデータを取得するための URL を生成1
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

module.exports = { fetchCoordinates };
