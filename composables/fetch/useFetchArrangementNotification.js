/**
 * @file ./composables/fetch/useFetchArrangementNotification.js
 * @description
 * ArrangementNotifications コレクションのドキュメントを効率的に取得し、キャッシュするためのコンポーザブルです。
 *
 * - `fetchArrangementNotification(source)`:
 *   指定されたソース（ドキュメントID文字列、IDを含むオブジェクト、またはそれらの配列）から
 *   ドキュメントIDを抽出し、該当するArrangementNotificationデータをFirestoreから取得して内部キャッシュに格納します。
 *   既にキャッシュに存在するデータは再取得しません。
 *
 * - `cachedArrangementNotifications`:
 *   キャッシュされたArrangementNotificationインスタンスを、docIdをキーとしたリアクティブなオブジェクトとして提供します。
 *
 * Firestoreからのデータ取得は `ArrangementNotification.fetchDoc({ docId })` を使用し、
 * エラー発生時には `useLogger` を介してログが出力されます。
 */
import { ArrangementNotification } from "~/schemas";
import { useFetchBase } from "./useFetchBase";

export function useFetchArrangementNotification({
  warnIfNotFound = true,
} = {}) {
  const { fetchItems, cachedItems, pushItems, isLoading } = useFetchBase({
    SchemaClass: ArrangementNotification,
    entityName: "ArrangementNotification",
    idProperties: ["docId"], // 優先順位順
    warnIfNotFound,
  });

  return {
    fetchArrangementNotification: fetchItems,
    cachedArrangementNotifications: cachedItems,
    pushArrangementNotifications: pushItems,
    isLoading,
  };
}
