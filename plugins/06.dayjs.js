// plugins/dayjs.ts
import dayjs from "dayjs";
import "dayjs/locale/ja";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

export default defineNuxtPlugin(() => {
  dayjs.locale("ja");
  dayjs.extend(isSameOrAfter);
  dayjs.extend(utc);
  dayjs.extend(timezone);
});
