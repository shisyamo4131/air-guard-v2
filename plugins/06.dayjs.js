// plugins/dayjs.ts
import dayjs from "dayjs";
import "dayjs/locale/ja";

export default defineNuxtPlugin(() => {
  dayjs.locale("ja");
});
