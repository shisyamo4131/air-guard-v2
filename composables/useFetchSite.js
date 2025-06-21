/**
 * @file ./composables/useFetchSite.js
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
import { useLogger } from "./useLogger";
import { ref, computed } from "vue";

export function useFetchSite() {
  const logger = useLogger();
  /** @type {import('vue').Ref<Site[]>} */
  const sitesCache = ref([]);

  /**
   * 指定されたソースからドキュメントIDを抽出し、該当するSiteデータをFirestoreから取得し、
   * 内部キャッシュに格納します。
   * キャッシュに既に存在する場合は何もしません。
   *
   * @param {string | {docId?: string, siteId?: string} | Array<string | {docId?: string, siteId?: string}>} source -
   *   取得するSiteドキュメントのID、IDを含むオブジェクト（docIdまたはsiteIdプロパティ）、またはそれらの配列。
   * @returns {Promise<void>}
   */
  async function fetchSite(source) {
    const getDocIdFromItem = (item) => {
      if (typeof item === "string" && item) return item;
      if (item && typeof item.docId === "string" && item.docId)
        return item.docId;
      // pages/collection-routes/[id].vue の displayedStops の形式 (stop.siteId) を考慮
      if (item && typeof item.siteId === "string" && item.siteId)
        return item.siteId;
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
            !sitesCache.value.some((cachedSite) => cachedSite.docId === id)
          );
        })
      ),
    ];

    if (idsToActuallyFetch.length === 0) {
      return;
    }

    const fetchPromises = idsToActuallyFetch.map(async (docId) => {
      try {
        const siteInstance = await new Site().fetchDoc({ docId });
        if (siteInstance) {
          sitesCache.value.push(siteInstance);
        } else {
          logger.warn({
            sender: "useFetchSite",
            message: `Site (ID: ${docId}) not found in Firestore.`,
          });
        }
      } catch (error) {
        logger.error({
          sender: "useFetchSite",
          message: `Failed to fetch Site (ID: ${docId}) from Firestore. Error: ${error.message}`,
          error,
        });
      }
    });

    await Promise.all(fetchPromises);
  }

  /**
   * キャッシュされた Site インスタンスを docId をキーとしたオブジェクトとして提供します。
   * @type {import('vue').ComputedRef<Readonly<Record<string, Site>>>}
   */
  const cachedSites = computed(() => {
    return sitesCache.value.reduce((acc, site) => {
      acc[site.docId] = site;
      return acc;
    }, {});
  });

  return {
    fetchSite,
    cachedSites,
  };
}
