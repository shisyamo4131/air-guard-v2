/**
 * @file ./composables/useFetchBase.js
 * @description
 * 任意のコレクションのドキュメントを効率的に取得し、キャッシュするためのベースコンポーザブルです。
 *
 * このコンポーザブルは、Employee, Outsourcer, Site などの異なるコレクションに対して
 * 共通のフェッチ・キャッシュ機能を提供します。
 */
import { useLogger } from "../useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { ref, computed } from "vue";

/**
 * ベースフェッチコンポーザブル
 * @template T - スキーマクラスの型
 * @param {Object} config - 設定オブジェクト
 * @param {new () => T} config.SchemaClass - スキーマクラスのコンストラクタ
 * @param {string} config.entityName - エンティティ名（ログ用）
 * @param {string[]} config.idProperties - ID抽出に使用するプロパティ名の配列（優先順位順）
 * @param {boolean} [config.warnIfNotFound=true] - ドキュメントが見つからなかった場合に警告ログを出すかどうか
 * @returns {Object} フェッチ機能を含むオブジェクト
 */
export function useFetchBase({
  SchemaClass,
  entityName,
  idProperties = ["docId"],
  warnIfNotFound = true,
  searchCacheExpireMs = 5 * 60 * 1000, // デフォルト5分
}) {
  const logger = useLogger(`useFetch${entityName}`, useErrorsStore());
  /** @type {import('vue').Ref<T[]>} */
  const cache = ref([]);
  /** @type {import('vue').Ref<boolean>} */
  const isLoading = ref(false);

  // 検索クエリキャッシュ：{ searchKey: { timestamp: number, options: Object } }
  /** @type {import('vue').Ref<Record<string, { timestamp: number, options: Object }>>} */
  const searchCache = ref({});

  /**
   * ソースからドキュメントIDを抽出する関数
   * @param {any} item - ID抽出対象のアイテム
   * @returns {string|null} 抽出されたドキュメントID
   */
  const getDocIdFromItem = (item) => {
    if (typeof item === "string" && item) return item;

    // 設定された優先順位でIDプロパティを確認
    for (const prop of idProperties) {
      if (item && typeof item[prop] === "string" && item[prop]) {
        return item[prop];
      }
    }

    return null;
  };

  /**
   * 指定されたソースからドキュメントIDを抽出し、該当するデータをFirestoreから取得し、
   * 内部キャッシュに格納します。
   * キャッシュに既に存在する場合は何もしません。
   *
   * @param {string | Object | Array<string | Object>} source - 取得するドキュメントのID、IDを含むオブジェクト、またはそれらの配列
   * @returns {Promise<void>}
   */
  async function fetchItems(source) {
    isLoading.value = true;

    try {
      let potentialDocIds = [];
      if (Array.isArray(source)) {
        potentialDocIds = source
          .map(getDocIdFromItem)
          .filter((id) => id !== null);
      } else {
        const singleId = getDocIdFromItem(source);
        if (singleId) {
          potentialDocIds.push(singleId);
        }
      }

      if (potentialDocIds.length === 0) return;

      // 有効かつ未キャッシュのIDのみを抽出（重複排除も行う）
      const idsToActuallyFetch = [
        ...new Set(
          potentialDocIds.filter((id) => {
            return (
              id && !cache.value.some((cachedItem) => cachedItem.docId === id)
            );
          })
        ),
      ];

      if (idsToActuallyFetch.length === 0) {
        return;
      }

      const fetchPromises = idsToActuallyFetch.map(async (docId) => {
        try {
          const instance = await new SchemaClass().fetchDoc({ docId });
          if (instance) {
            cache.value.push(instance);
          } else {
            if (warnIfNotFound) {
              logger.warn({
                message: `${entityName} (ID: ${docId}) not found in Firestore.`,
              });
            }
          }
        } catch (error) {
          logger.error({
            message: `Failed to fetch ${entityName} (ID: ${docId}) from Firestore. Error: ${error.message}`,
            error,
          });
        }
      });

      await Promise.all(fetchPromises);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 単一のアイテムを取得してインスタンスを返します
   * @param {string | Object} source - 取得するドキュメントのID、またはIDを含むオブジェクト
   * @returns {Promise<T | null>} 取得されたインスタンス、または null
   */
  async function getItem(source) {
    const docId = getDocIdFromItem(source);
    if (!docId) {
      logger.warn({
        message: `Invalid source provided to get${entityName}. Could not extract ID.`,
      });
      return null;
    }

    await fetchItems(source);
    return cache.value.find((item) => item.docId === docId) || null;
  }

  /**
   * キャッシュされたインスタンスを docId をキーとしたオブジェクトとして提供します。
   * @type {import('vue').ComputedRef<Readonly<Record<string, T>>>}
   */
  const cachedItems = computed(() => {
    return cache.value.reduce((acc, item) => {
      acc[item.docId] = item;
      return acc;
    }, {});
  });

  /**
   * コンポーネント側から取得済みのインスタンスを直接キャッシュにプッシュします。
   * 既にキャッシュに存在するアイテムは重複を避けるためスキップされます。
   *
   * @param {T[]} newItems - キャッシュに追加するインスタンスの配列
   */
  function pushItems(newItems) {
    if (!Array.isArray(newItems)) {
      logger.warn({
        message: `pushItems expects an array of ${entityName}s.`,
      });
      return;
    }

    if (!newItems.every((item) => item instanceof SchemaClass)) {
      logger.warn({
        message: `All items should be instances of ${entityName}.`,
      });
      return;
    }

    // 重複チェック：既にキャッシュに存在しないもののみ追加
    const newUniqueItems = newItems.filter(
      (item) => !cache.value.some((cached) => cached.docId === item.docId)
    );

    if (newUniqueItems.length > 0) {
      cache.value.push(...newUniqueItems);
      // logger.info({
      //   sender: `useFetch${entityName}`,
      //   message: `Added ${newUniqueItems.length} new ${entityName}(s) to cache.`,
      // });
    }
  }

  /**
   * 検索キャッシュから期限切れのエントリを削除します
   */
  function cleanupExpiredSearchCache() {
    const now = Date.now();
    Object.keys(searchCache.value).forEach((key) => {
      if (now - searchCache.value[key].timestamp > searchCacheExpireMs) {
        delete searchCache.value[key];
      }
    });
  }

  /**
   * 検索キャッシュのキーを生成します
   * @param {string} searchText - 検索文字列
   * @param {Object} options - 検索オプション
   * @returns {string} キャッシュキー
   */
  function generateSearchCacheKey(searchText, options) {
    const { additionalConstraints = [], limit } = options;
    const optionsStr = JSON.stringify({ additionalConstraints, limit });
    return `${searchText}||${optionsStr}`;
  }

  /**
   * N-gram検索を実行し、結果をキャッシュに追加します
   * @param {string} searchText - 検索文字列
   * @param {Object} [options={}] - 追加のオプション
   * @param {Array} [options.additionalConstraints=[]] - 追加の検索制約
   * @param {number} [options.limit] - 取得件数の上限
   * @param {boolean} [options.forceRefresh=false] - 強制的にキャッシュを無視してフェッチする
   * @returns {Promise<T[]>} 検索結果のインスタンス配列
   */
  async function searchItems(searchText, options = {}) {
    const { additionalConstraints = [], limit, forceRefresh = false } = options;

    if (!searchText || typeof searchText !== "string") {
      logger.warn({
        message: `Invalid search text provided to search${entityName}s.`,
      });
      return [];
    }

    // 期限切れの検索キャッシュを削除
    cleanupExpiredSearchCache();

    // 検索キャッシュのキーを生成
    const searchKey = generateSearchCacheKey(searchText, {
      additionalConstraints,
      limit,
    });

    // 強制リフレッシュでない場合、検索キャッシュをチェック
    if (!forceRefresh && searchCache.value[searchKey]) {
      return cache.value;
    }

    isLoading.value = true;

    try {
      // limitが指定されている場合は制約に追加
      const queryOptions = [...additionalConstraints];
      if (limit && typeof limit === "number" && limit > 0) {
        queryOptions.push(["limit", limit]);
      }

      // FireModelのfetchDocsメソッドを使用してN-gram検索を実行
      const instance = new SchemaClass();
      const searchResults = await instance.fetchDocs({
        constraints: searchText, // 検索文字列を渡す
        options: queryOptions, // 追加制約を options として渡す
      });

      if (Array.isArray(searchResults)) {
        // 検索結果をキャッシュに追加（重複チェック付き）
        const newUniqueItems = searchResults.filter(
          (item) => !cache.value.some((cached) => cached.docId === item.docId)
        );

        if (newUniqueItems.length > 0) {
          cache.value.push(...newUniqueItems);
        }

        // 検索クエリをキャッシュに追加
        searchCache.value[searchKey] = {
          timestamp: Date.now(),
          options: { additionalConstraints, limit },
        };

        // logger.info({
        //   message: `Search completed for ${entityName}. Found ${searchResults.length} items. Query cached.`,
        // });

        return searchResults;
      } else {
        logger.warn({
          message: `Unexpected search result format for ${entityName}.`,
        });
        return [];
      }
    } catch (error) {
      logger.error({
        message: `Failed to search ${entityName}s. Error: ${error.message}`,
        error,
      });
      return [];
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 検索キャッシュをクリアします
   */
  function clearSearchCache() {
    searchCache.value = {};
    logger.info({
      message: `Search cache cleared for ${entityName}.`,
    });
  }

  return {
    fetchItems,
    getItem,
    searchItems,
    cachedItems,
    pushItems,
    isLoading,
    clearSearchCache, // 新しく追加
  };
}
