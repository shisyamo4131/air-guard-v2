/**
 * @file ./composables/useFetchEmployee.js
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
import { useLogger } from "./useLogger";
import { ref, computed } from "vue";

export function useFetchEmployee() {
  const logger = useLogger();
  /** @type {import('vue').Ref<Employee[]>} */
  const employeesCache = ref([]);
  /** @type {import('vue').Ref<boolean>} */
  const isLoading = ref(false);

  /**
   * 指定されたソースからドキュメントIDを抽出し、該当するEmployeeデータをFirestoreから取得し、
   * 内部キャッシュに格納します。
   * キャッシュに既に存在する場合は何もしません。
   *
   * @param {string | {docId?: string, employeeId?: string} | Array<string | {docId?: string, employeeId?: string}>} source -
   *   取得するEmployeeドキュメントのID、IDを含むオブジェクト（docIdまたはemployeeIdプロパティ）、またはそれらの配列。
   * @returns {Promise<void>}
   */
  async function fetchEmployee(source) {
    isLoading.value = true; // フェッチ開始時にローディング状態をtrueに設定
    const getDocIdFromItem = (item) => {
      if (typeof item === "string" && item) return item;
      // オブジェクトに employeeId があればこれを優先
      if (item && typeof item.employeeId === "string" && item.employeeId)
        return item.employeeId;
      // オブジェクトに employeeId がなければ docId の使用を試みる
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
            !employeesCache.value.some(
              (cachedEmployee) => cachedEmployee.docId === id
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
        const employeeInstance = await new Employee().fetchDoc({ docId });
        if (employeeInstance) {
          employeesCache.value.push(employeeInstance);
        } else {
          logger.warn({
            sender: "useFetchEmployee",
            message: `Employee (ID: ${docId}) not found in Firestore.`,
          });
        }
      } catch (error) {
        logger.error({
          sender: "useFetchEmployee",
          message: `Failed to fetch Employee (ID: ${docId}) from Firestore. Error: ${error.message}`,
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
   * キャッシュされた Employee インスタンスを docId をキーとしたオブジェクトとして提供します。
   * @type {import('vue').ComputedRef<Readonly<Record<string, Employee>>>}
   */
  const cachedEmployees = computed(() => {
    return employeesCache.value.reduce((acc, employee) => {
      acc[employee.docId] = employee;
      return acc;
    }, {});
  });

  return {
    fetchEmployee,
    cachedEmployees,
    isLoading, // ローディング状態を公開
  };
}
