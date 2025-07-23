/**
 * @file ./composables/useFetchOutsourcer.js
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
import { useLogger } from "./useLogger";
import { ref, computed } from "vue";

export function useFetchOutsourcer() {
  const logger = useLogger();
  /** @type {import('vue').Ref<Outsourcer[]>} */
  const outsourcersCache = ref([]);
  /** @type {import('vue').Ref<boolean>} */
  const isLoading = ref(false);

  /**
   * 指定されたソースからドキュメントIDを抽出し、該当するOutsourcerデータをFirestoreから取得し、
   * 内部キャッシュに格納します。
   * キャッシュに既に存在する場合は何もしません。
   *
   * @param {string | {docId?: string, outsourcerId?: string} | Array<string | {docId?: string, outsourcerId?: string}>} source -
   *   取得するOutsourcerドキュメントのID、IDを含むオブジェクト（docIdまたはoutsourcerIdプロパティ）、またはそれらの配列。
   * @returns {Promise<void>}
   */
  async function fetchOutsourcer(source) {
    isLoading.value = true; // フェッチ開始時にローディング状態をtrueに設定
    const getDocIdFromItem = (item) => {
      if (typeof item === "string" && item) return item;
      // オブジェクトに outsourcerId があればこれを優先
      if (item && typeof item.outsourcerId === "string" && item.outsourcerId)
        return item.outsourcerId;
      // オブジェクトに outsourcerId がなければ docId の使用を試みる
      if (item && typeof item.docId === "string" && item.docId)
        return item.docId;
      // さらに workerId の使用を試みる
      if (item && typeof item.workerId === "string" && item.workerId)
        return item.workerId;
      return null;
    };

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
            id &&
            !outsourcersCache.value.some(
              (cachedOutsourcer) => cachedOutsourcer.docId === id
            )
          );
        })
      ),
    ];

    if (idsToActuallyFetch.length === 0) {
      return;
    }

    const fetchPromises = idsToActuallyFetch.map(async (docId) => {
      try {
        const outsourcerInstance = await new Outsourcer().fetchDoc({ docId });
        if (outsourcerInstance) {
          outsourcersCache.value.push(outsourcerInstance);
        } else {
          logger.warn({
            sender: "useFetchOutsourcer",
            message: `Outsourcer (ID: ${docId}) not found in Firestore.`,
          });
        }
      } catch (error) {
        logger.error({
          sender: "useFetchOutsourcer",
          message: `Failed to fetch Outsourcer (ID: ${docId}) from Firestore. Error: ${error.message}`,
          error,
        });
      }
    });

    try {
      await Promise.all(fetchPromises);
    } finally {
      isLoading.value = false; // フェッチ完了時にローディング状態をfalseに設定
    }
  }

  /**
   * キャッシュされた Outsourcer インスタンスを docId をキーとしたオブジェクトとして提供します。
   * @type {import('vue').ComputedRef<Readonly<Record<string, Outsourcer>>>}
   */
  const cachedOutsourcers = computed(() => {
    return outsourcersCache.value.reduce((acc, outsourcer) => {
      acc[outsourcer.docId] = outsourcer;
      return acc;
    }, {});
  });

  return {
    fetchOutsourcer,
    cachedOutsourcers,
    isLoading, // ローディング状態を公開
  };
}
