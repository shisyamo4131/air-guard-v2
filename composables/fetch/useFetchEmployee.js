/**
 * @file ./composables/fetch/useFetchEmployee.js
 * @description
 * Employees コレクションのドキュメントを効率的に取得し、キャッシュするためのコンポーザブルです。
 *
 * - `fetchEmployee(source)`:
 *   指定されたソース（ドキュメントID文字列、IDを含むオブジェクト、またはそれらの配列）から
 *   ドキュメントIDを抽出し、該当するEmployeeデータをFirestoreから取得して内部キャッシュに格納します。
 *   既にキャッシュに存在するデータは再取得しません。
 *
 * - `cachedEmployees`:
 *   キャッシュされたEmployeeインスタンスを、docIdをキーとしたリアクティブなオブジェクトとして提供します。
 *
 * Firestoreからのデータ取得は `Employee.fetchDoc({ docId })` を使用し、
 * エラー発生時には `useLogger` を介してログが出力されます。
 */
import { Employee } from "~/schemas";
import { useFetchBase } from "./useFetchBase";

export function useFetchEmployee() {
  const { fetchItems, cachedItems, pushItems, isLoading } = useFetchBase({
    SchemaClass: Employee,
    entityName: "Employee",
    idProperties: ["employeeId", "docId", "workerId"], // 優先順位順
  });

  return {
    fetchEmployee: fetchItems,
    cachedEmployees: cachedItems,
    pushEmployees: pushItems,
    isLoading,
  };
}
