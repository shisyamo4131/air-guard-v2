/*****************************************************************************
 * @file utils/attendance/createAttendancePunchRows.js
 * @description DailyAttendanceから外部勤怠サービス向けの打刻データを生成する。
 *****************************************************************************/

export const ATTENDANCE_PUNCH_TYPE = Object.freeze({
  CLOCK_IN: 1,
  CLOCK_OUT: 2,
  BREAK_START: 3,
  BREAK_END: 4,
});

export const ATTENDANCE_EXPORT_REJECTION = Object.freeze({
  NOT_EXPORTABLE: "NOT_EXPORTABLE",
  EMPLOYEE_NOT_FOUND: "EMPLOYEE_NOT_FOUND",
  WORK_INTERVAL_NOT_FOUND: "WORK_INTERVAL_NOT_FOUND",
});

/**
 * DateをYYYYMMDDHHmm形式へ変換する。
 * @param {Date} date
 * @returns {string}
 */
export function formatAttendancePunchDateTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";

  const pad = (value) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
  ].join("");
}

/**
 * 勤務区間の中央へ見做し休憩を配置する。
 * 休憩開始日時は分未満を切り捨てる。
 * @param {{ startAt: Date, endAt: Date, breakMinutes: number }} detail
 * @returns {{ startAt: Date, endAt: Date } | null}
 */
export function createAssumedBreakInterval(detail) {
  const { startAt, endAt } = detail ?? {};
  const breakMinutes = Number(detail?.breakMinutes ?? 0);

  if (
    !(startAt instanceof Date) ||
    !(endAt instanceof Date) ||
    Number.isNaN(startAt.getTime()) ||
    Number.isNaN(endAt.getTime()) ||
    breakMinutes <= 0
  ) {
    return null;
  }

  const breakMilliseconds = breakMinutes * 60 * 1000;
  const centerMilliseconds =
    startAt.getTime() + (endAt.getTime() - startAt.getTime()) / 2;
  const rawStartMilliseconds = centerMilliseconds - breakMilliseconds / 2;
  const startMilliseconds =
    Math.floor(rawStartMilliseconds / (60 * 1000)) * 60 * 1000;

  return {
    startAt: new Date(startMilliseconds),
    endAt: new Date(startMilliseconds + breakMilliseconds),
  };
}

/**
 * 重複または連続する休憩区間を結合する。
 * @param {Array<{ startAt: Date, endAt: Date }>} intervals
 * @returns {Array<{ startAt: Date, endAt: Date }>}
 */
export function mergeBreakIntervals(intervals = []) {
  const sorted = intervals
    .filter(
      ({ startAt, endAt }) =>
        startAt instanceof Date &&
        endAt instanceof Date &&
        startAt.getTime() < endAt.getTime(),
    )
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  return sorted.reduce((result, interval) => {
    const previous = result.at(-1);

    if (!previous || interval.startAt.getTime() > previous.endAt.getTime()) {
      result.push({
        startAt: new Date(interval.startAt),
        endAt: new Date(interval.endAt),
      });
      return result;
    }

    if (interval.endAt.getTime() > previous.endAt.getTime()) {
      previous.endAt = new Date(interval.endAt);
    }

    return result;
  }, []);
}

/**
 * DailyAttendanceの稼働明細から勤務区間と休憩区間を生成する。
 * @param {Object} attendance
 * @returns {{
 *   workStartAt: Date|null,
 *   workEndAt: Date|null,
 *   breakIntervals: Array<{ startAt: Date, endAt: Date }>
 * }}
 */
export function createAttendanceIntervals(attendance) {
  const details = [...(attendance?.details ?? [])]
    .filter(
      ({ startAt, endAt }) =>
        startAt instanceof Date &&
        endAt instanceof Date &&
        !Number.isNaN(startAt.getTime()) &&
        !Number.isNaN(endAt.getTime()) &&
        startAt.getTime() < endAt.getTime(),
    )
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  if (details.length === 0) {
    return {
      workStartAt: null,
      workEndAt: null,
      breakIntervals: [],
    };
  }

  const breakIntervals = [];

  details.forEach((detail, index) => {
    const assumedBreak = createAssumedBreakInterval(detail);
    if (assumedBreak) breakIntervals.push(assumedBreak);

    const nextDetail = details[index + 1];
    if (nextDetail && detail.endAt.getTime() < nextDetail.startAt.getTime()) {
      breakIntervals.push({
        startAt: new Date(detail.endAt),
        endAt: new Date(nextDetail.startAt),
      });
    }
  });

  return {
    workStartAt: new Date(details[0].startAt),
    workEndAt: new Date(details.at(-1).endAt),
    breakIntervals: mergeBreakIntervals(breakIntervals),
  };
}

/**
 * DailyAttendance配列から打刻行と除外データを生成する。
 * @param {Object} options
 * @param {Array<Object>} options.dailyAttendances
 * @param {Object<string, Object>} options.employeesById
 * @returns {{
 *   rows: Array<{
 *     employeeCode: string,
 *     employeeName: string,
 *     punchTypeCode: number,
 *     punchDateTime: string,
 *     punchedAt: Date
 *   }>,
 *   rejected: Array<{
 *     attendance: Object,
 *     employee: Object|null,
 *     codes: string[],
 *     messages: string[]
 *   }>
 * }}
 */
export function createAttendancePunchRows({
  dailyAttendances = [],
  employeesById = {},
} = {}) {
  const rows = [];
  const rejected = [];

  for (const attendance of dailyAttendances) {
    const employee = employeesById[attendance.employeeId] ?? null;
    const rejectionCodes = [];
    const rejectionMessages = [];

    if (!attendance.isExportable) {
      rejectionCodes.push(
        ...(attendance.exportInvalidReasons ?? []).map(
          ({ code }) => code ?? ATTENDANCE_EXPORT_REJECTION.NOT_EXPORTABLE,
        ),
      );
      rejectionMessages.push(
        ...(attendance.exportInvalidReasons ?? []).map(
          ({ message, messages }) =>
            messages?.ja ??
            message ??
            "エクスポートできない勤怠データです。",
        ),
      );
    }

    if (!employee) {
      rejectionCodes.push(ATTENDANCE_EXPORT_REJECTION.EMPLOYEE_NOT_FOUND);
      rejectionMessages.push("従業員情報を取得できません。");
    }

    const { workStartAt, workEndAt, breakIntervals } =
      createAttendanceIntervals(attendance);

    if (!workStartAt || !workEndAt) {
      rejectionCodes.push(ATTENDANCE_EXPORT_REJECTION.WORK_INTERVAL_NOT_FOUND);
      rejectionMessages.push("有効な勤務区間を取得できません。");
    }

    if (rejectionCodes.length > 0) {
      rejected.push({
        attendance,
        employee,
        codes: [...new Set(rejectionCodes)],
        messages: [...new Set(rejectionMessages)],
      });
      continue;
    }

    const common = {
      employeeCode: employee.code ?? "",
      employeeName: employee.fullName ?? employee.displayName ?? "",
    };

    rows.push(
      createPunchRow(common, ATTENDANCE_PUNCH_TYPE.CLOCK_IN, workStartAt),
    );

    for (const interval of breakIntervals) {
      rows.push(
        createPunchRow(
          common,
          ATTENDANCE_PUNCH_TYPE.BREAK_START,
          interval.startAt,
        ),
        createPunchRow(
          common,
          ATTENDANCE_PUNCH_TYPE.BREAK_END,
          interval.endAt,
        ),
      );
    }

    rows.push(
      createPunchRow(common, ATTENDANCE_PUNCH_TYPE.CLOCK_OUT, workEndAt),
    );
  }

  rows.sort((a, b) => {
    const employeeComparison = a.employeeCode.localeCompare(
      b.employeeCode,
      "ja",
      { numeric: true },
    );
    if (employeeComparison !== 0) return employeeComparison;
    return a.punchedAt.getTime() - b.punchedAt.getTime();
  });

  return { rows, rejected };
}

/**
 * @param {{ employeeCode: string, employeeName: string }} common
 * @param {number} punchTypeCode
 * @param {Date} punchedAt
 * @returns {Object}
 */
function createPunchRow(common, punchTypeCode, punchedAt) {
  return {
    ...common,
    punchTypeCode,
    punchDateTime: formatAttendancePunchDateTime(punchedAt),
    punchedAt: new Date(punchedAt),
  };
}
