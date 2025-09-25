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
}) {
  const logger = useLogger(`useFetch${entityName}`, useErrorsStore());
  /** @type {import('vue').Ref<T[]>} */
  const cache = ref([]);
  /** @type {import('vue').Ref<boolean>} */
  const isLoading = ref(false);

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

  return {
    fetchItems,
    cachedItems,
    pushItems,
    isLoading,
  };
}
