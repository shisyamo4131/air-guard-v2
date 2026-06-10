import { logger } from "firebase-functions";
import { DailyAttendance } from "@shisyamo4131/air-guard-v2-schemas";

/*****************************************************************************
 * attendance 配列内の DailyAttendance インスタンスを保存します。
 * - `exists` フラグに応じて、インスタンスの `create` または `update` メソッドを呼び出します。
 * - トランザクションが提供されている場合は、各 `create` / `update` 呼び出しにトランザクションを渡します。
 * @param {Object} options
 * @param {string} options.companyId
 * @param {Array<{ instance: DailyAttendance, exists: boolean }>} options.attendances
 * @param {Object} options.transaction
 * @returns {Promise<void>}
 *****************************************************************************/
export async function saveDailyAttendances({
  companyId,
  attendances = [],
  transaction = null,
} = {}) {
  logger.info("'saveDailyAttendances' is called", {
    attendances,
    transaction: transaction ? "provided" : "not provided",
  });

  // prefix を生成（companyId がない場合はエラー）
  if (!companyId) throw new Error("companyId is required");
  const prefix = `Companies/${companyId}/`;

  // attendances が配列でない場合はエラー
  if (!Array.isArray(attendances)) {
    throw new Error("attendances must be an array");
  }

  // attendances 配列内の各要素が { instance: DailyAttendance, exists: boolean } でない場合はエラー
  if (
    !attendances.every(
      ({ instance, exists }) =>
        instance instanceof DailyAttendance && typeof exists === "boolean",
    )
  ) {
    throw new Error(
      "Each attendance must be an object with instance as DailyAttendance and exists as boolean",
    );
  }

  for (const { instance, exists } of attendances) {
    // DailyAttendance ドキュメントが存在している場合
    // - `isAttended` が true の場合はドキュメントを更新。
    // - `isAttended` が false の場合はドキュメントを削除。
    if (exists) {
      instance.isAttended
        ? await instance.update({ prefix, transaction })
        : await instance.delete({ prefix, transaction });
      continue;
    }

    // DailyAttendance ドキュメントが存在しない場合
    // - `isAttended` が true の場合のみドキュメントを作成。
    if (instance.isAttended) {
      await instance.create({ prefix, transaction });
    }
  }
}
