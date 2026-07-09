/*****************************************************************************
 * @file ./components/OperationSchedules/Table/Body/useOperationSchedulesTableBodyModel.js
 * @description `OperationSchedulesTableBody` 専用 ViewModel コンポーザブル
 *****************************************************************************/
import * as Vue from "vue";
import { useFetch } from "@/composables/fetch/useFetch";

export function useOperationSchedulesTableBodyModel(props, emit) {
  /*****************************************************************************
   * SETUP COMPOSABLES
   *****************************************************************************/
  /**
   * FETCH SITE COMPOSABLE
   * - デフォルトの行ヘッダーで現場名を表示するために使用します。
   */
  const { fetchSiteComposable } = useFetch("OperationSchedulesTableBody");
  const { cachedSites, fetchSite } = fetchSiteComposable;

  /*****************************************************************************
   * WATCHERS
   *****************************************************************************/
  /**
   * props.rowsの変更を監視し、現場IDが存在する場合はfetchSiteを呼び出して現場情報を取得します。
   * 配列の参照先はそのままで、内部要素の順序のみが書き換わるケースがあるため、 deep: true を指定しています。
   */
  Vue.watch(
    () => props.rows,
    (newRows) => {
      newRows.forEach(({ siteId }) => {
        if (siteId) fetchSite(siteId);
      });
    },
    { immediate: true, deep: true },
  );

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  /**
   * `props.selectedDate` と引数の `date` が一致するかどうかを判定します。
   * @param {string} date - 日付文字列（YYYY-MM-DD）
   * @returns {boolean} 一致する場合は true、一致しない場合は false
   */
  function isDateSelected(date) {
    return !!props.selectedDate && props.selectedDate === date;
  }

  /**
   * cell スロットが提供するプロパティオブジェクトを作成します。
   * @param {Object} row - 行データ
   * @param {Object} column - 列データ
   * @returns {Object} cell スロットに渡すプロパティオブジェクト
   */
  function createCellSlotProps(row, column) {
    const groupKey = `${row.key}_${column.date}`;

    return {
      siteId: row.siteId,
      shiftType: row.shiftType,
      date: column.date,
      dateAt: column.dateAt,
      groupKey,
      isSelected: isDateSelected(column.date),
      column,
      ...props.schedulesIndex.groupKey.get(groupKey),
      onClick: () => {
        emit("click:cell", {
          siteId: row.siteId,
          shiftType: row.shiftType,
          date: column.date,
          dateAt: column.dateAt,
          groupKey,
        });
      },
    };
  }

  /**
   * 現場IDから行ヘッダーに表示する現場名を返します。
   * @param {string} siteId - 現場ID
   * @returns {string} 現場の表示名。未取得の場合はローディング表示文字列
   */
  function getSiteDisplayName(siteId) {
    return cachedSites.value?.[siteId]?.displayName || "...loading";
  }

  /**
   * 指定された列に対するセルの属性オブジェクトを返します。
   * - `props.selectedDate` が指定されており、かつ列の日付が選択された日付と一致しない場合は、
   *   セルの内容をぼかすスタイルを適用します。
   * @param {Object} column - 列データ
   * @returns {Object} セルの属性オブジェクト
   */
  function genCellContentAttrs(column) {
    const classDefinition = [
      "d-flex",
      "flex-column",
      "justify-start",
      "fill-height",
    ];
    const styleDefinition = {
      filter:
        props.selectedDate && props.selectedDate !== column.date
          ? "blur(4px)"
          : "none",
    };
    return {
      class: classDefinition,
      style: styleDefinition,
    };
  }

  return {
    createCellSlotProps,
    getSiteDisplayName,
    genCellContentAttrs,
    isRemoveDisabled: (row) => props.schedulesIndex.orderKey.has(row.key),
  };
}
