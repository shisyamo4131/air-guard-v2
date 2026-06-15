/**
 * @file ./composables/fetch/useFetchEmployee.js
 * @description
 * Employees コレクションのドキュメントを効率的に取得し、キャッシュするためのコンポーザブルです。
 *
 * - `fetchEmployee(source)`:
 *   指定されたソース（ドキュメントID文字列、IDを含むオブジェクト、またはそれらの配列）から
 *   ドキュメントIDを抽出し、該当するEmployeeデータをFirestoreから取得して内部キャッシュに格納します。
 *   既にキャッシュに存在するデータは再取得しません。
 *
 * - `cachedEmployees`:
 *   キャッシュされたEmployeeインスタンスを、docIdをキーとしたリアクティブなオブジェクトとして提供します。
 *
 * Firestoreからのデータ取得は `Employee.fetchDoc({ docId })` を使用し、
 * エラー発生時には `useLogger` を介してログが出力されます。
 */
import { Employee } from "~/schemas";
import { useFetchBase } from "./useFetchBase";

export function useFetchEmployee({
  warnIfNotFound = true,
  searchCacheExpireMs = 5 * 60 * 1000,
} = {}) {
  const {
    fetchItems,
    getItem,
    cachedItems,
    cachedArray,
    pushItems,
    pushItem,
    isLoading,
    searchItems,
    clearCache,
  } = useFetchBase({
    SchemaClass: Employee,
    entityName: "Employee",
    idProperties: ["employeeId", "docId", "workerId"], // 優先順位順
    warnIfNotFound,
    searchCacheExpireMs,
  });

  /**
   * 従業員をN-gram検索で取得します
   * @param {string} searchText - 検索文字列
   * @param {Object} [options={}] - 検索オプション
   * @param {Array} [options.additionalConstraints=[]] - 追加の検索制約
   * @param {number} [options.limit=50] - 取得件数の上限（デフォルト50件）
   * @param {boolean} [options.forceRefresh=false] - trueの場合、検索キャッシュを無視して強制的に再取得
   * @param {boolean} [options.returnAllCached=true] - trueの場合は全アイテムキャッシュを返す、falseの場合は検索結果のみを返す
   * @returns {Promise<Employee[]>} 検索結果の従業員配列
   */
  async function searchEmployees(searchText, options = {}) {
    const { limit = 50, ...otherOptions } = options;

    return await searchItems(searchText, {
      limit,
      ...otherOptions,
    });
  }

  return {
    fetchEmployee: fetchItems,
    getEmployee: getItem,
    searchEmployees,
    cachedEmployees: cachedItems,
    cachedEmployeesArray: cachedArray,
    pushEmployees: pushItems,
    pushEmployee: pushItem,
    isLoading,
    clearCache,
  };
}
