import { getDateAt, formatJstDate } from "@shisyamo4131/air-guard-v2-schemas/utils";
import { getDayType } from "@shisyamo4131/air-guard-v2-schemas/constants";

const adapted = new WeakSet();
const DAY = 86400000;
const getter = (get) => ({ configurable: true, enumerable: true, get, set() {} });

// Only the supplied calculation/draft instances are adapted. Package prototypes,
// native Date, process timezone and persisted raw snapshots remain untouched.
export function operationDateTime(model) {
  if (!model || adapted.has(model) || typeof model.setDateAtCallback !== "function" || !Object.hasOwn(model, "dateAt")) return model;
  adapted.add(model);
  let dateAt = model.dateAt;
  for (const field of ["employees", "outsourcers"]) {
    const descriptor = Object.getOwnPropertyDescriptor(model, field);
    if (!descriptor) continue;
    let rows = descriptor.value;
    const Row = model.constructor.classProps[field]?.customClass;
    const children = (value) => Array.isArray(value) ? value.map((row) => operationDateTime(Row && !(row instanceof Row) ? new Row(row) : row)) : value;
    Object.defineProperty(model, field, {
      configurable: true, enumerable: descriptor.enumerable,
      get() {
        const value = descriptor.get ? descriptor.get.call(this) : rows;
        if (Array.isArray(value)) value.forEach(operationDateTime);
        return value;
      },
      set(value) {
        const next = children(value);
        if (descriptor.set) descriptor.set.call(this, next); else rows = next;
        this[field]; // Adapt children recreated by the schema's array setter.
      },
    });
    model[field];
  }
  Object.defineProperties(model, {
    dateAt: {
      configurable: true, enumerable: true,
      get: () => dateAt,
      set(value) {
        if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new TypeError("Invalid operation date");
        if (dateAt?.getTime() === value.getTime()) return;
        dateAt = getDateAt(value, "00:00");
        this.setDateAtCallback(dateAt);
        // The existing holiday/day-type helper reads local calendar components.
        // Give that helper the same calendar day without changing the instant
        // stored on the operation or changing its holiday rules.
        if (Object.hasOwn(this, "dayType")) {
          const [year, month, day] = formatJstDate(dateAt).split("-").map(Number);
          this.dayType = getDayType(new Date(year, month - 1, day, 12));
        }
      },
    },
    startAt: getter(function () { return this.startTime ? getDateAt(this.dateAt, this.startTime, this.isStartNextDay ? 1 : 0) : null; }),
    endAt: getter(function () {
      const start = this.startAt;
      if (!start || !this.endTime) return null;
      const end = getDateAt(start, this.endTime);
      return end.getTime() <= start.getTime() ? new Date(end.getTime() + DAY) : end;
    }),
    isSpansNextDay: getter(function () { return !!this.startAt && !!this.endAt && formatJstDate(this.endAt) > formatJstDate(this.startAt); }),
    attendanceDateAt: getter(function () { return this.dateAt ? new Date(this.dateAt.getTime() + (this.isStartNextDay ? DAY : 0)) : null; }),
  });
  return model;
}
