// plugins/dayjs.ts
import dayjs from "dayjs";
import "dayjs/locale/ja";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";

export default defineNuxtPlugin(() => {
  dayjs.locale("ja");
  dayjs.extend(isSameOrAfter);
});
