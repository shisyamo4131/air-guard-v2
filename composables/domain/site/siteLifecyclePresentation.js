const DAY_MS = 24 * 60 * 60 * 1000;

function jstDate(value) {
  const date = value?.toDate?.() ?? value;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addJstDays(dateText, days) {
  const start = new Date(`${dateText}T00:00:00+09:00`);
  return jstDate(new Date(start.getTime() + days * DAY_MS));
}

function scheduleDate(schedule) {
  if (typeof schedule?.date === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(schedule.date)) {
    return schedule.date;
  }
  return jstDate(schedule?.dateAt);
}

export function getSiteLifecyclePresentation(
  site,
  { schedules = null, now = new Date() } = {},
) {
  if (site?.status === "TERMINATED") {
    return Object.freeze({
      persistentStatus: "TERMINATED",
      label: "終了済み",
      color: "grey",
      automaticTerminationDate: null,
      hasScheduleBlocker: false,
    });
  }

  const endDate = jstDate(site?.constructionPeriodEndAt);
  if (!endDate) {
    return Object.freeze({
      persistentStatus: "ACTIVE",
      label: "工期未設定",
      color: "warning",
      automaticTerminationDate: null,
      hasScheduleBlocker: false,
    });
  }

  const today = jstDate(now);
  const automaticTerminationDate = addJstDays(endDate, 90);
  const hasScheduleBlocker = Array.isArray(schedules)
    ? schedules.some((schedule) =>
      schedule?.operationResultId == null ||
      (scheduleDate(schedule) !== null && scheduleDate(schedule) >= today),
    )
    : null;

  if (endDate < today && hasScheduleBlocker === true) {
    return Object.freeze({
      persistentStatus: "ACTIVE",
      label: "工期終了済み・予定あり",
      color: "error",
      automaticTerminationDate,
      hasScheduleBlocker: true,
    });
  }

  return Object.freeze({
    persistentStatus: "ACTIVE",
    label: endDate < today ? "工期終了済み" : "稼働中",
    color: endDate < today ? "warning" : "success",
    automaticTerminationDate,
      hasScheduleBlocker,
  });
}
