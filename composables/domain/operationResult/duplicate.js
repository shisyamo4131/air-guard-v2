/*****************************************************************************
 * @file ./composables/domain/operationResult/duplicate.js
 * @description 稼働実績ドキュメントを複製します。
 * - 同一日付での複製も許可。
 *****************************************************************************/
import dayjs from "dayjs";
import { OperationResult } from "@/schemas";

/**
 * @param {{ source: OperationResult, dates: Date[]|string[] }} params
 * @param {OperationResult} params.source - 複製元の稼働実績ドキュメント
 * @param {Date[]|string[]} params.dates - 複製先の日付の配列
 * @returns {Promise<OperationResult[]>} - 複製された稼働実績ドキュメントの配列
 * @throws {Error} - `source` が `OperationResult` のインスタンスでない場合、または `dates` が空の配列である場合にスローされます。
 * @throws {Error} - `source` がロックされている場合にスローされます。
 * @throws {Error} - `dates` に無効な日付が含まれている場合にスローされます。
 */
export async function duplicate({ source, dates = [] } = {}) {
  /** `source` must be an instance of OperationResult */
  if (!source || !(source instanceof OperationResult)) {
    throw new Error(
      "source is required and must be an instance of OperationResult",
    );
  }

  /** `source` must not be locked */
  if (source.isLocked) {
    throw new Error("source is locked and cannot be duplicated");
  }

  /** `dates` must be a non-empty array */
  if (!Array.isArray(dates) || dates.length === 0) {
    throw new Error("dates is required and must be a non-empty array");
  }

  /** `dates` must be an array of valid dates */
  if (!dates.every((date) => dayjs(date).isValid())) {
    throw new Error("dates must be an array of valid dates");
  }

  /** Normalize dates to the start of the day in Asia/Tokyo timezone */
  const normalizedDates = dates.map((date) => {
    return dayjs.tz(date, "Asia/Tokyo").startOf("day").toDate();
  });

  /** Prepair new instances */
  /** 複製対象外とするプロパティがあればここで除外する */
  const instances = normalizedDates.map((dateAt) => {
    const instance = new OperationResult(source.toObject());
    // `setDateAtCallback` による `employees` と `outsourcers` への同期処理のため、インスタンス生成後に `dateAt` を設定する
    instance.dateAt = dateAt;
    instance.siteOperationScheduleId = null; // 複製元の現場稼働予定IDをクリア
    return instance;
  });

  /** Create a new OperationResult instance for each date */
  await source.constructor.runTransaction((transaction) =>
    Promise.all(instances.map((instance) => instance.create({ transaction }))),
  );

  return instances;
}
