const POSTAL_CODE_API_URL = "https://zipcloud.ibsnet.co.jp/api/search";

/**
 * 郵便番号から住所を検索して返します。
 * @param {string} postalCode - 検索する郵便番号 (例: "1000001")。ハイフンなしの7桁の数字を期待します。
 * @returns {Promise<string | null>} - 住所文字列 (例: "東京都千代田区千代田")。見つからない場合やエラー時は null。
 */
export async function fetchAddressFromPostalCode(postalCode) {
  if (!postalCode || typeof postalCode !== "string") {
    console.warn(
      "[fetchAddressFromPostalCode] 無効な郵便番号が渡されました:",
      postalCode
    );
    return null;
  }

  // 郵便番号の形式をチェック (7桁の数字)
  if (!/^\d{7}$/.test(postalCode)) {
    console.warn(
      `[fetchAddressFromPostalCode] 郵便番号の形式が正しくありません（7桁の数字ではありません）: ${postalCode}`
    );
    return null;
  }

  try {
    const apiUrl = `${POSTAL_CODE_API_URL}?zipcode=${postalCode}`;
    console.log(
      `[fetchAddressFromPostalCode] 郵便番号検索APIを呼び出し: ${apiUrl}`
    );

    const response = await fetch(apiUrl);

    if (!response.ok) {
      console.error(
        `[fetchAddressFromPostalCode] APIリクエスト失敗: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const data = await response.json();

    if (data.status === 200 && data.results && data.results.length > 0) {
      const result = data.results[0];
      // const address = `${result.address1}${result.address2}${result.address3}`;
      // console.log(`[fetchAddressFromPostalCode] 取得した住所: ${address}`);
      // return address;
      return result;
    } else {
      console.warn(
        `[fetchAddressFromPostalCode] 住所を取得できませんでした: ${
          data.message || `ステータス ${data.status}`
        }`,
        data
      );
      return null;
    }
  } catch (error) {
    console.error(
      "[fetchAddressFromPostalCode] 郵便番号検索API呼び出し中にエラーが発生しました:",
      error
    );
    return null;
  }
}
