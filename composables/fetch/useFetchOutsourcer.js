/**
 * @file ./composables/fetch/useFetchOutsourcer.js
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
import { useFetchBase } from "./useFetchBase";

export function useFetchOutsourcer() {
  const { fetchItems, cachedItems, pushItems, isLoading, mappedItems } =
    useFetchBase({
      SchemaClass: Outsourcer,
      entityName: "Outsourcer",
      idProperties: ["outsourcerId", "docId", "workerId"], // 優先順位順
    });

  return {
    fetchOutsourcer: fetchItems,
    cachedOutsourcers: cachedItems,
    pushOutsourcers: pushItems,
    isLoading,
    outsourcersMap: mappedItems,
  };
}
