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

export function useFetchSite() {
  const { fetchItems, cachedItems, pushItems, isLoading } = useFetchBase({
    SchemaClass: Site,
    entityName: "Site",
    idProperties: ["siteId", "docId"], // 優先順位順
  });

  return {
    fetchSite: fetchItems,
    cachedSites: cachedItems,
    pushSites: pushItems,
    isLoading,
  };
}
