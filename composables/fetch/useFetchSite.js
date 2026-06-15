/**
 * @file ./composables/fetch/useFetchSite.js
 * @description
 * Sites コレクションのドキュメントを効率的に取得し、キャッシュするためのコンポーザブルです。
 *
 * - `fetchSite(source)`:
 *   指定されたソース（ドキュメントID文字列、IDを含むオブジェクト、またはそれらの配列）から
 *   ドキュメントIDを抽出し、該当するSiteデータをFirestoreから取得して内部キャッシュに格納します。
 *   既にキャッシュに存在するデータは再取得しません。
 *
 * - `cachedSites`:
 *   キャッシュされたSiteインスタンスを、docIdをキーとしたリアクティブなオブジェクトとして提供します。
 *
 * Firestoreからのデータ取得は `Site.fetchDoc({ docId })` を使用し、
 * エラー発生時には `useLogger` を介してログが出力されます。
 */
import { Site } from "~/schemas";
import { useFetchBase } from "./useFetchBase";

export function useFetchSite({
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
    SchemaClass: Site,
    entityName: "Site",
    idProperties: ["siteId", "docId"], // 優先順位順
    warnIfNotFound,
    searchCacheExpireMs,
  });

  /**
   * サイトをN-gram検索で取得します
   * @param {string} searchText - 検索文字列
   * @param {Object} [options={}] - 検索オプション
   * @param {Array} [options.additionalConstraints=[]] - 追加の検索制約
   * @param {number} [options.limit=50] - 取得件数の上限（デフォルト50件）
   * @param {boolean} [options.forceRefresh=false] - trueの場合、検索キャッシュを無視して強制的に再取得
   * @param {boolean} [options.returnAllCached=true] - trueの場合は全アイテムキャッシュを返す、falseの場合は検索結果のみを返す
   * @returns {Promise<Site[]>} 検索結果のサイト配列
   */
  async function searchSites(searchText, options = {}) {
    const { limit = 50, ...otherOptions } = options;

    return await searchItems(searchText, {
      limit,
      ...otherOptions,
    });
  }

  return {
    fetchSite: fetchItems,
    getSite: getItem,
    searchSites,
    cachedSites: cachedItems,
    cachedSitesArray: cachedArray,
    pushSites: pushItems,
    pushSite: pushItem,
    isLoading,
    clearCache,
  };
}
