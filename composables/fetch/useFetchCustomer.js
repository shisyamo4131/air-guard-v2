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

export function useFetchCustomer({ warnIfNotFound = true } = {}) {
  const {
    fetchItems,
    getItem,
    cachedItems,
    pushItems,
    isLoading,
    searchItems,
  } = useFetchBase({
    SchemaClass: Customer,
    entityName: "Customer",
    idProperties: ["customerId", "docId"], // 優先順位順
    warnIfNotFound,
  });

  /**
   * サイトをN-gram検索で取得します
   * @param {string} searchText - 検索文字列
   * @param {Object} [options={}] - 検索オプション
   * @param {Array} [options.additionalConstraints=[]] - 追加の検索制約
   * @param {number} [options.limit=50] - 取得件数の上限（デフォルト50件）
   * @returns {Promise<Customer[]>} 検索結果のサイト配列
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
    pushCustomers: pushItems,
    isLoading,
  };
}
