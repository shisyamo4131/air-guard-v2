/**
 * @file ./composables/useFetchBase.js
 * @description
 * 任意のコレクションのドキュメントを効率的に取得し、キャッシュするためのベースコンポーザブルです。
 *
 * このコンポーザブルは、Employee, Outsourcer, Site などの異なるコレクションに対して
 * 共通のフェッチ・キャッシュ機能を提供します。
 *
 * **主要機能:**
 * 1. **アイテムキャッシュ**: 取得したドキュメントを `cache.value` に保持し、再取得を防ぐ
 * 2. **検索キャッシュ**: N-gram検索の結果を時限付き（デフォルト5分）でキャッシュ
 * 3. **重複フェッチ防止**: `inFlightFetches` により、並行実行時の重複フェッチを防止
 * 4. **複数コンポーネント間でのキャッシュ共有**: provide/inject パターンで複数箇所から同じキャッシュを参照可能
 *
 * **使用例:**
 * ```javascript
 * // コンポーザブルの初期化
 * const { fetchSite, searchSites, cachedSites } = useFetchSite();
 *
 * // 単一ドキュメントの取得（キャッシュがあれば再取得しない）
 * await fetchSite("site123");
 *
 * // N-gram検索（検索結果とクエリをキャッシュ）
 * const results = await searchSites("大手町", { limit: 50 });
 *
 * // キャッシュされた全データを参照
 * console.log(cachedSites.value); // { "site123": Site, ... }
 * ```
 *
 * **注意事項:**
 * - `subscribeDocs` などのリアルタイム更新機能と併用する場合、
 *   同じIDに対して複数回 `fetchItems` が呼ばれる可能性があります
 * - `inFlightFetches` により重複フェッチは防止されますが、
 *   意図しないタイミングでキャッシュが更新される可能性があるため注意してください
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
 * @param {string[]} [config.idProperties=["docId"]] - ID抽出に使用するプロパティ名の配列（優先順位順）
 * @param {boolean} [config.warnIfNotFound=true] - ドキュメントが見つからなかった場合に警告ログを出すかどうか
 * @param {number} [config.searchCacheExpireMs=300000] - 検索キャッシュの有効期限（ミリ秒）
 *   - デフォルト: 5分（300,000ms）
 *   - 0 を指定すると、検索キャッシュを無効化し、常にFirestoreから再取得します
 *   - この設定は `searchItems` の検索キャッシュにのみ影響し、`fetchItems` のアイテムキャッシュには影響しません
 *
 * @returns {Object} フェッチ機能を含むオブジェクト
 * @returns {Function} returns.fetchItems - ドキュメントを取得してキャッシュに追加する関数
 * @returns {Function} returns.getItem - 単一のアイテムを取得してインスタンスを返す関数
 * @returns {Function} returns.searchItems - N-gram検索を実行する関数
 * @returns {import('vue').ComputedRef<Record<string, T>>} returns.cachedItems - キャッシュされたアイテムをオブジェクトとして提供
 * @returns {Function} returns.pushItems - 取得済みのインスタンスをキャッシュに追加する関数
 * @returns {import('vue').Ref<boolean>} returns.isLoading - ローディング状態
 * @returns {Function} returns.clearSearchCache - 検索キャッシュをクリアする関数
 *
 * @example
 * // 検索キャッシュを10分に設定
 * const { searchSites } = useFetchSite({
 *   searchCacheExpireMs: 10 * 60 * 1000
 * });
 *
 * @example
 * // 検索キャッシュを無効化（常に再取得）
 * const { searchSites } = useFetchSite({
 *   searchCacheExpireMs: 0
 * });
 */
export function useFetchBase({
  SchemaClass,
  entityName,
  idProperties = ["docId"],
  warnIfNotFound = true,
  searchCacheExpireMs = 5 * 60 * 1000,
}) {
  const logger = useLogger(`useFetch${entityName}`, useErrorsStore());
  const cache = ref([]);
  const isLoading = ref(false);
  const searchCache = ref({});

  // フェッチ中のIDを記録する Set
  const inFlightFetches = ref(new Set());

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
   * キャッシュに既に存在する場合、または現在フェッチ中の場合は何もしません。
   *
   * **重要な動作:**
   * - `inFlightFetches` により、同じIDに対する並行実行を防止します
   * - これにより、`subscribeDocs` などで同じIDが複数回要求されても、
   *   Firestoreへのアクセスは1回のみとなり、キャッシュの重複も防ぎます
   *
   * **キャッシュチェックの優先順位:**
   * 1. 既にキャッシュに存在するか？ → スキップ
   * 2. 現在フェッチ中か？ → スキップ
   * 3. どちらでもない → Firestoreから取得
   *
   * @param {string | Object | Array<string | Object>} source - 取得するドキュメントのID、IDを含むオブジェクト、またはそれらの配列
   * @returns {Promise<void>}
   *
   * @example
   * // 単一IDで取得
   * await fetchSites("site123");
   *
   * @example
   * // 複数IDで取得
   * await fetchSites(["site123", "site456"]);
   *
   * @example
   * // オブジェクトの配列から取得（siteId プロパティを自動抽出）
   * await fetchSites([{ siteId: "site123" }, { siteId: "site456" }]);
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

      // 有効かつ未キャッシュ、かつフェッチ中でないIDのみを抽出
      const idsToActuallyFetch = [
        ...new Set(
          potentialDocIds.filter((id) => {
            return (
              id &&
              !cache.value.some((cachedItem) => cachedItem.docId === id) &&
              !inFlightFetches.value.has(id) // ← フェッチ中でないことを確認
            );
          })
        ),
      ];

      if (idsToActuallyFetch.length === 0) {
        return;
      }

      // フェッチ中のIDを記録
      idsToActuallyFetch.forEach((id) => inFlightFetches.value.add(id));

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
      // フェッチ完了後、記録を削除
      const potentialDocIds = Array.isArray(source)
        ? source.map(getDocIdFromItem).filter((id) => id !== null)
        : [getDocIdFromItem(source)].filter((id) => id !== null);

      potentialDocIds.forEach((id) => inFlightFetches.value.delete(id));

      isLoading.value = false;
    }
  }

  /**
   * 単一のアイテムを取得してインスタンスを返します
   * @param {string | Object} source - 取得するドキュメントのID、またはIDを含むオブジェクト
   * @returns {Promise<T | null>} 取得されたインスタンス、または null
   */
  async function getItem(source) {
    if (!source) return;
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
   *
   * **重要な動作:**
   * - 同じ検索キーワード・オプションの組み合わせで検索した場合、Firestoreに再アクセスせず
   *   検索キャッシュから結果を返します（有効期限: デフォルト5分）
   * - `returnAllCached: true` の場合、全アイテムキャッシュを返すため、
   *   他のコンポーネント/コンポーザブルで取得したデータも含まれます
   * - `returnAllCached: false` の場合、今回の検索に関連する結果のみを返します
   *
   * **キャッシュの種類:**
   * 1. アイテムキャッシュ (`cache.value`): 全ての取得済みアイテムを保持
   * 2. 検索キャッシュ (`searchCache.value`): 検索クエリと結果のペアを時限付きで保持
   *
   * **並行実行の制御:**
   * - `inFlightFetches` により、同じIDに対する重複フェッチを防止します
   * - これにより、複数のコンポーネントが同時に同じデータを要求しても、
   *   Firestoreへのアクセスは1回のみとなり、キャッシュの重複も防ぎます
   *
   * @param {string} searchText - 検索文字列
   * @param {Object} [options={}] - 追加のオプション
   * @param {Array} [options.additionalConstraints=[]] - 追加の検索制約
   * @param {number} [options.limit] - 取得件数の上限
   * @param {boolean} [options.forceRefresh=false] - trueの場合、検索キャッシュを無視して強制的に再取得
   * @param {boolean} [options.returnAllCached=true] - trueの場合は全アイテムキャッシュを返す、falseの場合は検索結果のみを返す
   * @returns {Promise<T[]>} 検索結果のインスタンス配列
   *
   * @example
   * // Autocompleteで使用（検索結果のみを表示）
   * const results = await searchSites("大手町", { returnAllCached: false, limit: 50 });
   *
   * @example
   * // Autocompleteで検索文字列をクリア（過去の全検索結果を表示）
   * const allCached = await searchSites("", { returnAllCached: true });
   *
   * @example
   * // 同じ検索を5分以内に再実行（キャッシュから返される）
   * await searchSites("大手町", { limit: 50 }); // Firestoreにアクセス
   * await searchSites("大手町", { limit: 50 }); // キャッシュから返す（Firestoreにアクセスしない）
   */
  async function searchItems(searchText, options = {}) {
    const {
      additionalConstraints = [],
      limit,
      forceRefresh = false,
      returnAllCached = true, // 新しいオプション
    } = options;

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
      // logger.info({
      //   message: `Using cached search query for ${entityName}. Query: "${searchText}"`,
      // });

      if (returnAllCached) {
        // 全キャッシュデータを返す
        return [...cache.value];
      } else {
        // キャッシュされた検索結果のみを返す
        return [...searchCache.value[searchKey].results];
      }
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
        // 検索結果をアイテムキャッシュに追加
        pushItems(searchResults);

        // 検索クエリを検索結果とともにキャッシュに追加
        searchCache.value[searchKey] = {
          timestamp: Date.now(),
          options: { additionalConstraints, limit },
          results: searchResults, // 検索結果も保存
        };

        // logger.info({
        //   message: `Search completed for ${entityName}. Found ${searchResults.length} items. Query and results cached.`,
        // });

        if (returnAllCached) {
          // 全キャッシュデータを返す
          return [...cache.value];
        } else {
          // 検索結果のみを返す
          return searchResults;
        }
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

  function clearCache() {
    cache.value = [];
    logger.info({
      message: `Cache cleared for ${entityName}.`,
    });
  }

  return {
    fetchItems,
    getItem,
    searchItems,
    cachedItems,
    pushItems,
    isLoading,
    clearCache,
    clearSearchCache,
  };
}
