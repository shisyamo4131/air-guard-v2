/**
 * @file mocks/arrangementNotifications.js
 * @description 配置通知モックデータ
 * - ArrangementNotificationクラスのインスタンスを作成
 * - @/mocks/siteOperationSchedules.jsのSiteOperationScheduleをもとに作成
 * - 各ステータスに対応したテストケースを提供
 */
import { ArrangementNotification } from "@/schemas";
import { schedules } from "@/mocks/siteOperationSchedules.js";

/**
 * schedules[0]のSiteOperationScheduleをもとに作成した配置通知
 * - schedule001abc123def456
 * - 2026-02-05 (水曜日) 09:00-18:00 日勤シフト
 * - employees: 2件 (山田太郎、佐藤花子)
 * - outsourcers: 1件 (セキュリティSV)
 */
const schedule = schedules[0];

/**
 * 配置通知モックデータ（8パターン）
 * @type {ArrangementNotification[]}
 */
export const mockArrangementNotifications = [
  // 1. ARRANGED - 従業員1（山田太郎）配置のみ
  new ArrangementNotification({
    ...schedule.employees[0].toObject(),
    docId: `${schedule.docId}-${schedule.employees[0].id}`,
    status: "ARRANGED",
    confirmedAt: null,
    arrivedAt: null,
    leavedAt: null,
    actualStartTime: schedule.employees[0].startTime,
    actualIsStartNextDay: schedule.employees[0].isStartNextDay,
    actualEndTime: schedule.employees[0].endTime,
    actualBreakMinutes: schedule.employees[0].breakMinutes,
  }),

  // 2. CONFIRMED - 従業員1（山田太郎）承認済み
  new ArrangementNotification({
    ...schedule.employees[0].toObject(),
    docId: `${schedule.docId}-${schedule.employees[0].id}`,
    status: "CONFIRMED",
    confirmedAt: new Date("2026-02-04T20:30:00"),
    arrivedAt: null,
    leavedAt: null,
    actualStartTime: schedule.employees[0].startTime,
    actualIsStartNextDay: schedule.employees[0].isStartNextDay,
    actualEndTime: schedule.employees[0].endTime,
    actualBreakMinutes: schedule.employees[0].breakMinutes,
  }),

  // 3. ARRIVED - 従業員1（山田太郎）現場到着済み
  new ArrangementNotification({
    ...schedule.employees[0].toObject(),
    docId: `${schedule.docId}-${schedule.employees[0].id}`,
    status: "ARRIVED",
    confirmedAt: new Date("2026-02-04T21:00:00"),
    arrivedAt: "07:55", // 早めに到着
    leavedAt: null,
    actualStartTime: schedule.employees[0].startTime,
    actualIsStartNextDay: schedule.employees[0].isStartNextDay,
    actualEndTime: schedule.employees[0].endTime,
    actualBreakMinutes: schedule.employees[0].breakMinutes,
  }),

  // 4. LEAVED - 従業員1（山田太郎）退勤済み（予定通り）
  new ArrangementNotification({
    ...schedule.employees[0].toObject(),
    docId: `${schedule.docId}-${schedule.employees[0].id}`,
    status: "LEAVED",
    confirmedAt: new Date("2026-02-04T19:00:00"),
    arrivedAt: "07:50",
    leavedAt: "17:05",
    actualStartTime: schedule.employees[0].startTime,
    actualIsStartNextDay: schedule.employees[0].isStartNextDay,
    actualEndTime: schedule.employees[0].endTime,
    actualBreakMinutes: schedule.employees[0].breakMinutes,
  }),

  // 5. ARRANGED - 従業員2（佐藤花子）配置のみ
  new ArrangementNotification({
    ...schedule.employees[1].toObject(),
    docId: `${schedule.docId}-${schedule.employees[1].id}`,
    status: "ARRANGED",
    confirmedAt: null,
    arrivedAt: null,
    leavedAt: null,
    actualStartTime: schedule.employees[1].startTime,
    actualIsStartNextDay: schedule.employees[1].isStartNextDay,
    actualEndTime: schedule.employees[1].endTime,
    actualBreakMinutes: schedule.employees[1].breakMinutes,
  }),

  // 6. CONFIRMED - 従業員2（佐藤花子）承認済み
  new ArrangementNotification({
    ...schedule.employees[1].toObject(),
    docId: `${schedule.docId}-${schedule.employees[1].id}`,
    status: "CONFIRMED",
    confirmedAt: new Date("2026-02-04T18:00:00"),
    arrivedAt: null,
    leavedAt: null,
    actualStartTime: schedule.employees[1].startTime,
    actualIsStartNextDay: schedule.employees[1].isStartNextDay,
    actualEndTime: schedule.employees[1].endTime,
    actualBreakMinutes: schedule.employees[1].breakMinutes,
  }),

  // 7. LEAVED - 従業員2（佐藤花子）実際の勤務時間が異なる（08:30-19:00、予定は09:00-18:00）
  new ArrangementNotification({
    ...schedule.employees[1].toObject(),
    docId: `${schedule.docId}-${schedule.employees[1].id}`,
    status: "LEAVED",
    confirmedAt: new Date("2026-02-04T22:00:00"),
    arrivedAt: "08:25",
    leavedAt: "19:10",
    actualStartTime: "08:30",
    actualIsStartNextDay: false,
    actualEndTime: "19:00",
    actualBreakMinutes: 60,
  }),

  // 8. ARRIVED - 外注先（セキュリティSV）現場到着済み
  new ArrangementNotification({
    ...schedule.outsourcers[0].toObject(),
    docId: `${schedule.docId}-${schedule.outsourcers[0].id}`,
    status: "ARRIVED",
    confirmedAt: new Date("2026-02-04T15:00:00"),
    arrivedAt: "08:55",
    leavedAt: null,
    actualStartTime: schedule.outsourcers[0].startTime,
    actualIsStartNextDay: schedule.outsourcers[0].isStartNextDay,
    actualEndTime: schedule.outsourcers[0].endTime,
    actualBreakMinutes: schedule.outsourcers[0].breakMinutes,
  }),
];
