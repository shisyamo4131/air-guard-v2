/**
 * @file ./composables/fetch/useFetchCustomer.js
 * @description
 * Customers コレクションのドキュメントを効率的に取得し、キャッシュするためのコンポーザブルです。
 *
 * - `fetchCustomer(source)`:
 *   指定されたソース（ドキュメントID文字列、IDを含むオブジェクト、またはそれらの配列）から
 *   ドキュメントIDを抽出し、該当するCustomerデータをFirestoreから取得して内部キャッシュに格納します。
 *   既にキャッシュに存在するデータは再取得しません。
 *
 * - `cachedCustomers`:
 *   キャッシュされたCustomerインスタンスを、docIdをキーとしたリアクティブなオブジェクトとして提供します。
 *
 * Firestoreからのデータ取得は `Customer.fetchDoc({ docId })` を使用し、
 * エラー発生時には `useLogger` を介してログが出力されます。
 */
import { Customer } from "~/schemas";
import { useFetchBase } from "./useFetchBase";

export function useFetchCustomer({
  warnIfNotFound = true,
  searchCacheExpireMs = 5 * 60 * 1000,
} = {}) {
  const {
    fetchItems,
    getItem,
    cachedItems,
    cachedArray,
    pushItems,
    isLoading,
    searchItems,
    clearCache,
  } = useFetchBase({
    SchemaClass: Customer,
    entityName: "Customer",
    idProperties: ["customerId", "docId"], // 優先順位順
    warnIfNotFound,
    searchCacheExpireMs,
  });

  /**
   * 取引先をN-gram検索で取得します
   * @param {string} searchText - 検索文字列
   * @param {Object} [options={}] - 検索オプション
   * @param {Array} [options.additionalConstraints=[]] - 追加の検索制約
   * @param {number} [options.limit=50] - 取得件数の上限（デフォルト50件）
   * @param {boolean} [options.forceRefresh=false] - trueの場合、検索キャッシュを無視して強制的に再取得
   * @param {boolean} [options.returnAllCached=true] - trueの場合は全アイテムキャッシュを返す、falseの場合は検索結果のみを返す
   * @returns {Promise<Customer[]>} 検索結果の取引先配列
   */
  async function searchCustomers(searchText, options = {}) {
    const { limit = 50, ...otherOptions } = options;

    return await searchItems(searchText, {
      limit,
      ...otherOptions,
    });
  }

  return {
    fetchCustomer: fetchItems,
    getCustomer: getItem,
    searchCustomers,
    cachedCustomers: cachedItems,
    cachedCustomersArray: cachedArray,
    pushCustomers: pushItems,
    isLoading,
    clearCache,
  };
}
