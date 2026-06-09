import {
  DailyAttendance,
  OperationResult,
} from "@shisyamo4131/air-guard-v2-schemas";

/*****************************************************************************
 * 引数で指定された OperationResult に紐づく、DailyAttendance ドキュメントを取得し、
 * DailyAttendance インスタンスを instance プロパティ、ドキュメントの存在有無を
 * exists プロパティに格納したオブジェクトの配列を返します。
 * @param {Object} options
 * @param {string} options.companyId
 * @param {OperationResult} options.operationResult
 * @param {Object|null} options.transaction
 * @returns {Promise<Array<{
 *  instance: DailyAttendance,
 *  exists: boolean,
 * }>>}
 *****************************************************************************/
export async function fetchDailyAttendances({
  companyId,
  operationResult,
  transaction = null,
} = {}) {
  // prefix を生成（companyId がない場合はエラー）
  if (!companyId) {
    throw new Error("companyId is required");
  }
  const prefix = `Companies/${companyId}/`;

  // operationResult が OperationResult インスタンスでない場合はエラー
  if (!operationResult || !(operationResult instanceof OperationResult)) {
    throw new Error("Invalid operationResult provided");
  }

  // OperationResult.employees を取得
  const { employees = [] } = operationResult;

  // OperationResult.employees の分、DailyAttendance ドキュメントを取得してインスタンス化し、配列に格納して返す
  const attendances = [];
  for (const employee of employees) {
    const attendanceInstance = new DailyAttendance();
    const attendanceDocId = `${employee.id}_${employee.attendanceDate}`; // 勤怠なので `attendanceDate` を使用

    // transaction を与えて `fetch` を呼び出す。
    // transaction === null の場合、`fetch` はトランザクション処理を行わないので
    // 当該メソッドで transaction の有無による処理分岐は不要。
    const attendanceExists = await attendanceInstance.fetch({
      docId: attendanceDocId,
      prefix,
      transaction,
    });
    if (!attendanceExists) {
      attendanceInstance.initialize({
        employeeId: employee.id,
        dateAt: employee.attendanceDateAt, // 勤怠なので `attendanceDateAt` を使用
        operationResults: [],
      });
    }
    attendances.push({
      instance: attendanceInstance,
      exists: attendanceExists,
    });
  }
  return attendances;
}
