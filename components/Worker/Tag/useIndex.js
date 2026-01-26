/*****************************************************************************
 * WorkerTag 専用コンポーザブル
 *****************************************************************************/
import * as Vue from "vue";
import dayjs from "dayjs";

export function useIndex(props, emit) {
  /**
   * 引数で受け取った値を時刻文字列に変換して返します。
   * - 引数が空の場合は "--:--" を返します。
   * - 引数が文字列の場合はそのまま返します。
   * - 引数が Date オブジェクトの場合は "HH:mm" 形式の文字列に変換して返します。（Asia/Tokyo タイムゾーン）
   * @param {String|Date} time
   * @returns {String} 変換後の時刻文字列
   */
  const resolveTime = (time) => {
    if (!time) return "--:--";
    if (typeof time === "string") return time;
    return dayjs(time).tz("Asia/Tokyo").format("HH:mm");
  };

  /**
   * 開始時刻の算出
   */
  const startTime = Vue.computed(() => {
    return resolveTime(props.startTime);
  });

  /**
   * 終了時刻の算出
   */
  const endTime = Vue.computed(() => {
    return resolveTime(props.endTime);
  });

  /**
   * Tag コンポーネントに渡す属性の算出
   */
  const attrs = Vue.computed(() => {
    // props から startTime, endTime を除外して返す -> Tag コンポーネントに不要な属性を渡さないようにするため
    const { startTime, endTime, ...rest } = props;
    return { ...rest, "onClick:remove": () => emit("click:remove") };
  });

  return { attrs, startTime, endTime };
}
