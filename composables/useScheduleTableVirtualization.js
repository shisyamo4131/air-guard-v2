/**
 * スケジュールテーブル用の仮想化コンポーザブル
 * - 大量の行データを効率的に表示
 * - スクロール位置に基づく動的レンダリング
 * - メモリ使用量の最適化
 */
import { ref, computed, nextTick } from "vue";
import {
  useVirtualization,
  useFrameThrottled,
} from "./usePerformanceOptimization";
import { useErrorHandler } from "./useErrorHandler";

/**
 * スケジュールテーブルの仮想化機能
 * @param {Object} options - 設定オプション
 * @returns {Object} 仮想化機能
 */
export function useScheduleTableVirtualization(options = {}) {
  const {
    rowHeight = 60,
    headerHeight = 48,
    containerHeight = 600,
    buffer = 10,
    itemKey = "key",
  } = options;

  const errorHandler = useErrorHandler("useScheduleTableVirtualization");

  /** スクロール状態 */
  const scrollContainer = ref(null);
  const scrollTop = ref(0);
  const isScrolling = ref(false);

  /** データと可視範囲 */
  const allRows = ref([]);
  const containerRef = ref(null);

  /**
   * 可視範囲の計算（メモ化）
   */
  const visibleRange = computed(() => {
    try {
      const effectiveHeight = containerHeight - headerHeight;
      const start = Math.floor(scrollTop.value / rowHeight);
      const visibleCount = Math.ceil(effectiveHeight / rowHeight);
      const end = start + visibleCount;

      return {
        start: Math.max(0, start - buffer),
        end: Math.min(allRows.value?.length || 0, end + buffer),
        visibleCount,
      };
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "可視範囲の計算",
        silent: true,
      });
      return { start: 0, end: 0, visibleCount: 0 };
    }
  });

  /**
   * 可視行の生成
   */
  const visibleRows = computed(() => {
    try {
      if (!allRows.value || allRows.value.length === 0) return [];

      const { start, end } = visibleRange.value;
      return allRows.value.slice(start, end).map((row, index) => ({
        ...row,
        virtualIndex: start + index,
        style: {
          position: "absolute",
          top: `${(start + index) * rowHeight + headerHeight}px`,
          left: "0",
          right: "0",
          height: `${rowHeight}px`,
          zIndex: 1,
        },
      }));
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "可視行の生成",
        silent: true,
      });
      return [];
    }
  });

  /**
   * 仮想スクロール領域の高さ
   */
  const virtualHeight = computed(() => {
    return (allRows.value?.length || 0) * rowHeight + headerHeight;
  });

  /**
   * スクロールハンドラー（フレーム制御）
   */
  const handleScroll = useFrameThrottled((event) => {
    try {
      const newScrollTop = event.target.scrollTop;
      if (newScrollTop !== scrollTop.value) {
        scrollTop.value = newScrollTop;

        // スクロール状態の管理
        isScrolling.value = true;
        clearTimeout(scrollingTimeout);
        scrollingTimeout = setTimeout(() => {
          isScrolling.value = false;
        }, 150);
      }
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "スクロール処理",
        silent: true,
      });
    }
  });

  let scrollingTimeout = null;

  /**
   * 特定の行にスクロール
   */
  const scrollToRow = async (rowIndex) => {
    try {
      if (
        !containerRef.value ||
        rowIndex < 0 ||
        rowIndex >= allRows.value.length
      ) {
        return;
      }

      const targetScrollTop = rowIndex * rowHeight;
      containerRef.value.scrollTop = targetScrollTop;

      await nextTick();
      scrollTop.value = targetScrollTop;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "行へのスクロール",
        details: `rowIndex: ${rowIndex}`,
      });
    }
  };

  /**
   * データの更新
   */
  const updateRows = (newRows) => {
    try {
      if (!Array.isArray(newRows)) {
        throw new Error("Rows must be an array");
      }

      allRows.value = newRows.map((row, index) => ({
        ...row,
        [itemKey]: row[itemKey] || `row-${index}`,
        originalIndex: index,
      }));
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "データの更新",
        details: `rows: ${newRows?.length}`,
      });
    }
  };

  /**
   * 行の検索
   */
  const findRowIndex = (predicate) => {
    try {
      if (typeof predicate !== "function") {
        throw new Error("Predicate must be a function");
      }

      return allRows.value.findIndex(predicate);
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "行の検索",
        silent: true,
      });
      return -1;
    }
  };

  /**
   * 可視性チェック
   */
  const isRowVisible = (rowIndex) => {
    const { start, end } = visibleRange.value;
    return rowIndex >= start && rowIndex < end;
  };

  /**
   * パフォーマンス統計
   */
  const performance = computed(() => {
    return {
      totalRows: allRows.value?.length || 0,
      visibleRows: visibleRows.value?.length || 0,
      renderRatio:
        allRows.value?.length > 0
          ? (
              ((visibleRows.value?.length || 0) / allRows.value.length) *
              100
            ).toFixed(2) + "%"
          : "0%",
      scrollTop: scrollTop.value,
      isScrolling: isScrolling.value,
    };
  });

  return {
    // refs
    containerRef,
    scrollContainer,

    // data
    allRows,
    visibleRows,
    visibleRange,

    // computed
    virtualHeight,
    performance,

    // methods
    handleScroll,
    scrollToRow,
    updateRows,
    findRowIndex,
    isRowVisible,

    // state
    scrollTop,
    isScrolling,

    // error handler
    errorHandler,
  };
}
