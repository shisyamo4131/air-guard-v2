/**
 * @file ./composables/fetch/useFetchOutsourcer.js
 * @description
 * Outsourcers コレクションのドキュメントを効率的に取得し、キャッシュするためのコンポーザブルです。
 *
 * - `fetchOutsourcer(source)`:
 *   指定されたソース（ドキュメントID文字列、IDを含むオブジェクト、またはそれらの配列）から
 *   ドキュメントIDを抽出し、該当するOutsourcerデータをFirestoreから取得して内部キャッシュに格納します。
 *   既にキャッシュに存在するデータは再取得しません。
 *
 * - `cachedOutsourcers`:
 *   キャッシュされたOutsourcerインスタンスを、docIdをキーとしたリアクティブなオブジェクトとして提供します。
 *
 * Firestoreからのデータ取得は `Outsourcer.fetchDoc({ docId })` を使用し、
 * エラー発生時には `useLogger` を介してログが出力されます。
 */
import { Outsourcer } from "~/schemas";
import { useFetchBase } from "./useFetchBase";

export function useFetchOutsourcer({ warnIfNotFound = true } = {}) {
  const {
    fetchItems,
    getItem,
    cachedItems,
    pushItems,
    isLoading,
    searchItems,
    clearCache,
  } = useFetchBase({
    SchemaClass: Outsourcer,
    entityName: "Outsourcer",
    idProperties: ["outsourcerId", "docId", "workerId"], // 優先順位順
    warnIfNotFound,
  });

  /**
   * 外注先をN-gram検索で取得します
   * @param {string} searchText - 検索文字列
   * @param {Object} [options={}] - 検索オプション
   * @param {Array} [options.additionalConstraints=[]] - 追加の検索制約
   * @param {number} [options.limit=50] - 取得件数の上限（デフォルト50件）
   * @returns {Promise<Outsourcer[]>} 検索結果の外注先配列
   */
  async function searchOutsourcers(searchText, options = {}) {
    const { limit = 50, ...otherOptions } = options;

    return await searchItems(searchText, {
      limit,
      ...otherOptions,
    });
  }

  return {
    fetchOutsourcer: fetchItems,
    getOutsourcer: getItem,
    searchOutsourcers,
    cachedOutsourcers: cachedItems,
    pushOutsourcers: pushItems,
    isLoading,
    clearCache,
  };
}
