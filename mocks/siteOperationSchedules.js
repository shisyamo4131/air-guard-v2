/**
 * @file mocks/siteOperationSchedules.js
 * @description 現場稼働予定モックデータ
 * - SiteOperationScheduleクラスのインスタンスを作成
 * - employees 2件、outsourcers 1件を含む
 */
import { SiteOperationSchedule, SiteOperationScheduleDetail } from "@/schemas";
import { mockEmployees } from "@/mocks/employees.js";
import { mockOutsourcers } from "@/mocks/outsourcers.js";

/**
 * 現場稼働予定モックデータ
 */
export const schedules = [
  new SiteOperationSchedule({
    docId: "schedule001abc123def456",
    siteId: "site001xyz789",
    dateAt: new Date("2026-02-05"),
    dayType: "WEEKDAY",
    shiftType: "DAY",
    startTime: "09:00",
    endTime: "18:00",
    breakMinutes: 60,
    isStartNextDay: false,
    requiredPersonnel: 3,
    qualificationRequired: true,
    workDescription: "施設警備",
    remarks: "【モック】通常の日勤シフト",
    regulationWorkMinutes: 480,
    displayOrder: 0,
    operationResultId: null,
    employees: [
      new SiteOperationScheduleDetail({
        id: mockEmployees[0].docId, // 山田太郎
        index: 0,
        isEmployee: true,
        amount: 1,
        siteId: "site001xyz789",
        siteOperationScheduleId: "schedule001abc123def456",
        hasNotification: false,
        dateAt: new Date("2026-02-05"),
        dayType: "WEEKDAY",
        shiftType: "DAY",
        startTime: "09:00",
        endTime: "18:00",
        breakMinutes: 60,
        isStartNextDay: false,
        regulationWorkMinutes: 480,
        isQualified: true,
        isOjt: false,
      }),
      new SiteOperationScheduleDetail({
        id: mockEmployees[1].docId, // 佐藤花子
        index: 0,
        isEmployee: true,
        amount: 1,
        siteId: "site001xyz789",
        siteOperationScheduleId: "schedule001abc123def456",
        hasNotification: false,
        dateAt: new Date("2026-02-05"),
        dayType: "WEEKDAY",
        shiftType: "DAY",
        startTime: "09:00",
        endTime: "18:00",
        breakMinutes: 60,
        isStartNextDay: false,
        regulationWorkMinutes: 480,
        isQualified: true,
        isOjt: false,
      }),
    ],
    outsourcers: [
      new SiteOperationScheduleDetail({
        id: mockOutsourcers[0].docId, // セキュリティSV
        index: 0,
        isEmployee: false,
        amount: 1,
        siteId: "site001xyz789",
        siteOperationScheduleId: "schedule001abc123def456",
        hasNotification: false,
        dateAt: new Date("2026-02-05"),
        dayType: "WEEKDAY",
        shiftType: "DAY",
        startTime: "09:00",
        endTime: "18:00",
        breakMinutes: 60,
        isStartNextDay: false,
        regulationWorkMinutes: 480,
        isQualified: true,
        isOjt: false,
      }),
    ],
  }),
];
