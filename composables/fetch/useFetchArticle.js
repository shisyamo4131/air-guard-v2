/**
 * @file ./composables/fetch/useFetchArticle.js
 * @description
 * Articles コレクションのドキュメントを効率的に取得し、キャッシュするためのコンポーザブルです。
 *
 * - `fetchArticle(source)`:
 *   指定されたソース（ドキュメントID文字列、IDを含むオブジェクト、またはそれらの配列）から
 *   ドキュメントIDを抽出し、該当するArticleデータをFirestoreから取得して内部キャッシュに格納します。
 *   既にキャッシュに存在するデータは再取得しません。
 *
 * - `cachedArticles`:
 *   キャッシュされたArticleインスタンスを、docIdをキーとしたリアクティブなオブジェクトとして提供します。
 */
import { Article } from "~/schemas";
import { useFetchBase } from "./useFetchBase";

export function useFetchArticle({
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
    SchemaClass: Article,
    entityName: "Article",
    idProperties: ["articleId", "docId"],
    warnIfNotFound,
    searchCacheExpireMs,
  });

  /**
   * 商品をN-gram検索で取得します
   * @param {string} searchText - 検索文字列
   * @param {Object} [options={}] - 検索オプション
   * @param {number} [options.limit=50] - 取得件数の上限（デフォルト50件）
   * @param {boolean} [options.returnAllCached=true] - trueの場合は全アイテムキャッシュを返す、falseの場合は検索結果のみを返す
   * @returns {Promise<Article[]>} 検索結果の商品配列
   */
  async function searchArticles(searchText, options = {}) {
    const { limit = 50, ...otherOptions } = options;

    return await searchItems(searchText, {
      limit,
      ...otherOptions,
    });
  }

  return {
    fetchArticle: fetchItems,
    getArticle: getItem,
    searchArticles,
    cachedArticles: cachedItems,
    cachedArticlesArray: cachedArray,
    pushArticles: pushItems,
    pushArticle: pushItem,
    isLoading,
    clearCache,
  };
}
