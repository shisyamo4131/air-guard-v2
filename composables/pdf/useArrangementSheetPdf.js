/**
 * 配置表PDF出力用 composable
 *  - 現場稼働予定ドキュメントを元にPDFを生成し、ブラウザで開きます。
 *  - 1ページに7件の現場データを表示します。
 *  - 隊員数が10人を超える場合、10人ごとに現場データを分割し、分割された行は主要項目が空欄になります。
 *  - 主要項目：取引先、住所、勤務区分、必要人数、現場名、基本定時時間
 */
import dayjs from "dayjs";
import ja from "dayjs/locale/ja";
import pdfMake from "pdfmake/build/pdfmake";
import vfs from "@/utils/fonts/vfs_fonts";
import { useAuthStore } from "@/stores/useAuthStore";
import { SiteOperationSchedule } from "@/schemas";
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";
import { useFetchSite } from "@/composables/fetch/useFetchSite";

/*****************************************************************************
 * コンポーザブル内ユーティリティ
 *****************************************************************************/
/**
 * 指定した長さの連番配列を返します。
 * @param {number} n - 要素数
 * @returns {Array<number>}
 */
function range(n) {
  return Array.from({ length: n }, (_, i) => i);
}

/**
 * 文字列を最大長で切り詰め、省略記号を付与します。
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
function truncateText(text, maxLength) {
  return text.length > maxLength ? text.slice(0, maxLength) + "…" : text;
}

/**
 * workers配列を WORKER_COLUMN_COUNT 数に合わせて埋め、作業員名を返します。
 * @param {Array<Object>} workers - 作業員オブジェクト配列
 * @returns {Array<string>} 作業員名配列
 */
function fillWorkers(workers) {
  return [
    ...workers,
    ...Array(Math.max(0, WORKER_COLUMN_COUNT - workers.length)).fill(""),
  ].map((worker) => (!worker ? "" : worker.name ? worker.name : "N/A"));
}

/**
 * 指定した数だけ空セル（{}）を返します。
 * @param {number} length
 * @param {Object} [value={}] - 各セルに設定する値（省略時は空オブジェクト）
 * @returns {Array<Object>}
 */
function emptyCells(length, value) {
  return Array(length).fill(value || {});
}

/**
 * 配置表に出力するデータを取得して返します。
 * - 現場稼働予定ドキュメントを取得し、関連する現場、従業員、外注先ドキュメントを取得します。
 * - 取得したデータを元に、配置表出力用のデータ配列を生成して返します。
 * - options で事前に取得済みのドキュメントマップオブジェクトを渡すこともできます。
 * @param {Date} date - 出力対象日
 * @param {Object} [options] - オプション
 * @param {Array<Object>} [options.fetchEmployeeComposable] - 事前に取得済みの従業員ドキュメントマップオブジェクト
 * @param {Array<Object>} [options.fetchOutsourcerComposable] - 事前に取得済みの外注先ドキュメントマップオブジェクト
 * @param {Array<Object>} [options.fetchSiteComposable] - 事前に取得済みの現場ドキュメントマップオブジェクト
 * @returns {Promise<Array<Object>>} - 出力データの配列
 */
const fetchData = async (date, options) => {
  // オプションで渡されたコンポーザブル、または内部コンポーザブルを使用
  const { fetchEmployee, cachedEmployees } = options.fetchEmployeeComposable;
  const { fetchOutsourcer, cachedOutsourcers } =
    options.fetchOutsourcerComposable;
  const { fetchSite, cachedSites } = options.fetchSiteComposable;
  const siteOrder = options.siteOrder || [];

  const scheduleInstance = new SiteOperationSchedule();
  const scheduleDocs = await scheduleInstance.fetchDocs({
    constraints: [["where", "date", "==", date]],
  });

  // 現場稼働予定ドキュメントが存在しない場合は空の配列を返す
  if (scheduleDocs.length === 0) return [];

  // siteOrder順に並べ替え
  if (siteOrder.length > 0) {
    scheduleDocs.sort((a, b) => {
      const aIdx = siteOrder.findIndex(
        (order) => order.siteId === a.siteId && order.shiftType === a.shiftType
      );
      const bIdx = siteOrder.findIndex(
        (order) => order.siteId === b.siteId && order.shiftType === b.shiftType
      );
      // siteOrderに含まれていない場合は後ろに
      if (aIdx === -1 && bIdx === -1) return 0;
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
  }

  // 現場、従業員、外注先ドキュメントを取得
  await fetchSite(scheduleDocs);
  await fetchEmployee(scheduleDocs.flatMap((doc) => doc.employeeIds));
  await fetchOutsourcer(scheduleDocs.flatMap((doc) => doc.outsourcerIds));

  const result = scheduleDocs.map((schedule) => {
    const site = cachedSites.value[schedule.siteId];
    const workers = schedule.workers.reduce((acc, worker) => {
      const count = worker.amount ?? 1;
      for (let i = 0; i < count; i++) {
        if (worker.isEmployee) {
          const employee = cachedEmployees.value[worker.workerId];
          acc.push({
            workerId: worker.workerId,
            isEmployee: true,
            name: employee?.displayName || "N/A",
          });
        } else {
          const outsourcer = cachedOutsourcers.value[worker.workerId];
          acc.push({
            workerId: worker.workerId,
            isEmployee: false,
            name: outsourcer?.displayName || "N/A",
          });
        }
      }
      return acc;
    }, []);

    return {
      site,
      shiftType: schedule.shiftType,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      requiredPersonnel: schedule.requiredPersonnel,
      workers,
    };
  });

  return result;
};

/*****************************************************************************
 * VFSとフォント定義の設定
 *****************************************************************************/
pdfMake.vfs = vfs;
pdfMake.fonts = {
  NotoSansJP: {
    normal: "NotoSansJP-Regular.ttf",
    bold: "NotoSansJP-Bold.ttf",
    italics: "NotoSansJP-Regular.ttf",
    bolditalics: "NotoSansJP-Bold.ttf",
  },
};

/*****************************************************************************
 * PDFファイルの用紙定義
 *****************************************************************************/
const PAGE_DEFINITION = {
  pageMargins: [16, 40, 16, 16],
  pageOrientation: "landscape",
};

/*****************************************************************************
 * テーブルレイアウト定義
 *****************************************************************************/
const FONT_SIZE = 6;
const WORKER_COLUMN_COUNT = 10; // 作業員表示列数
const WORKER_COLUMN_WIDTH = 13; // 各作業員列の幅

// 各列の幅
const WIDTHS = [
  "*",
  42,
  12,
  12,
  ...range(WORKER_COLUMN_COUNT * 3).map(() => WORKER_COLUMN_WIDTH),
];

/**
 * テーブルの罫線・余白レイアウト定義
 */
const LINE_LAYOUT = {
  hLineWidth: (i, node) => (i === 0 || i % 6 === 0 ? 1 : 0.1), // 単位行の太さ（6行ごとに太く）
  vLineWidth: (i, node) =>
    i === 0 || i === node.table.widths.length ? 1 : 0.1, // 垂直線の太さ（最左・最右を太く）
  paddingTop: () => 1.7, // セル内余白（上）
  paddingBottom: () => 1.7, // セル内余白（下）
};

/*****************************************************************************
 * コンテンツ定義
 *****************************************************************************/
/**
 * 各ページのヘッダーを返します。
 * @param {number} currentPage - 現在のページ番号
 * @param {number} pageCount - 総ページ数
 * @param {Date|string} date - 出力対象日(Dateオブジェクト or 日付文字列)
 * @returns {Object} ヘッダー定義オブジェクト
 */
const header = (currentPage, pageCount, date) => {
  const dateString = dayjs(date).locale(ja).format("YYYY年MM月DD日(dddd)");
  const pageString = `${currentPage} / ${pageCount}`;
  return {
    columns: [
      { text: "配置表", alignment: "left", fontSize: 12 },
      { text: dateString, alignment: "center", fontSize: 16 },
      { text: pageString, alignment: "right", fontSize: 12 },
    ],
    margin: [16, 8, 16, 0], // 左・上・右・下
  };
};

/**
 * テーブルの1行目（ヘッダー）を返します。
 * @returns {Array<Object>} ヘッダー行オブジェクト配列
 */
const firstRow = () => [
  { text: "取引先", alignment: "center" },
  { text: "住所", rowSpan: 2, alignment: "center" },
  { text: "日勤", alignment: "center" },
  { text: "人数", rowSpan: 2, alignment: "center" },
  ...range(WORKER_COLUMN_COUNT).flatMap((i) => [
    { text: `${i + 1}`, colSpan: 3, alignment: "center" },
    ...emptyCells(2),
  ]),
];

/**
 * テーブルの2行目（サブヘッダー）を返します。
 * @returns {Array<Object>} サブヘッダー行オブジェクト配列
 */
const secondRow = () => [
  { text: "現場", alignment: "center" },
  ...emptyCells(1),
  { text: "夜勤", alignment: "center" },
  ...emptyCells(1),
  ...range(WORKER_COLUMN_COUNT).flatMap(() => [
    { text: "隊員名", colSpan: 3, alignment: "center" },
    ...emptyCells(2),
  ]),
];

/**
 * テーブルの3行目（現場データ）を返します。
 * @param {Object} options
 * @param {Object} options.site - 現場情報
 * @param {string} options.shiftType - 勤務区分
 * @param {Array<Object>} options.workers - 隊員リスト
 * @param {number} options.requiredPersonnel - 必要人数
 * @param {boolean} options._blankMain - 主要項目を空欄にするフラグ
 * @returns {Array<Object>} 現場データ行オブジェクト配列
 */
const thirdRow = (options) => {
  const { site, shiftType, workers, requiredPersonnel, _blankMain } = options;
  const customerName = truncateText(site?.customer?.name || "N/A", 11);
  const siteAddress = truncateText(site?.address || "N/A", 12);
  const shiftTypeMark = shiftType === "DAY" ? "○" : "";
  return [
    { text: _blankMain ? "" : customerName },
    { text: _blankMain ? "" : siteAddress, rowSpan: 2 },
    { text: _blankMain ? "" : shiftTypeMark, alignment: "center" },
    {
      text: _blankMain ? "" : requiredPersonnel,
      rowSpan: 4,
      alignment: "center",
      margin: [0, 18, 0, 0],
    },
    ...fillWorkers(workers).flatMap((worker) => [
      { text: truncateText(worker, 8), colSpan: 3, alignment: "center" },
      ...emptyCells(2),
    ]),
  ];
};

/**
 * テーブルの4行目（現場名・勤務区分）を返します。
 * @param {Object} options
 * @param {Object} options.site - 現場情報
 * @param {string} options.shiftType - 勤務区分
 * @param {boolean} options._blankMain - 主要項目を空欄にするフラグ
 * @returns {Array<Object>}
 */
const fourthRow = ({ site, shiftType, _blankMain }) => {
  const siteName = truncateText(site?.name || "N/A", 11);
  const shiftTypeMark = shiftType === "NIGHT" ? "●" : "";
  return [
    { text: _blankMain ? "" : siteName },
    ...emptyCells(1),
    { text: _blankMain ? "" : shiftTypeMark, alignment: "center" },
    ...emptyCells(1),
    ...range(WORKER_COLUMN_COUNT).flatMap(() => ["早出", "昼残", "残業"]),
  ];
};

/**
 * テーブルの5行目（基本定時時間）を返します。
 * @param {Object} options
 * @param {string} options.startTime - 開始時刻
 * @param {string} options.endTime - 終了時刻
 * @param {boolean} options._blankMain - 主要項目を空欄にするフラグ
 * @returns {Array<Object>}
 */
const fifthRow = ({ startTime, endTime, _blankMain } = {}) => {
  const basicTime =
    startTime && endTime ? `${startTime} ～ ${endTime}` : "未設定";
  return [
    {
      text: _blankMain ? "" : "基本定時時間",
      rowSpan: 2,
      alignment: "center",
      margin: [0, 6, 0, 0],
      border: [true, true, false, true],
      fillColor: "#F5F5F5",
    },
    {
      text: _blankMain ? "" : basicTime,
      colSpan: 2,
      rowSpan: 2,
      alignment: "center",
      margin: [0, 6, 0, 0],
      border: [false, true, true, true],
      fillColor: "#F5F5F5",
    },
    ...emptyCells(2),
    ...emptyCells(WORKER_COLUMN_COUNT * 3, " "),
  ];
};

/**
 * テーブルの6行目（区切り行）を返します。
 * @returns {Array<Object>}
 */
const sixthRow = () => [
  ...emptyCells(4),
  ...range(WORKER_COLUMN_COUNT).flatMap(() => [
    { text: "～", colSpan: 3, alignment: "center" },
    ...emptyCells(2),
  ]),
];

/**
 * workersがmaxWorkersを超える場合、10人ごとに現場データを分割します。
 * 2ページ目以降は主要項目を空欄にします。
 * @param {Object} data - 現場データ
 * @param {number} maxWorkers - 1行に表示する隊員数
 * @returns {Array<Object>} 分割済み現場データ配列
 */
function splitWorkers(data, maxWorkers = WORKER_COLUMN_COUNT) {
  const { workers, ...rest } = data;
  if (!workers || workers.length <= maxWorkers) return [data];
  return range(Math.ceil(workers.length / maxWorkers)).map((chunkIdx) => ({
    ...rest,
    workers: workers.slice(chunkIdx * maxWorkers, (chunkIdx + 1) * maxWorkers),
    _blankMain: chunkIdx > 0,
  }));
}

/*****************************************************************************
 * コンポーザブル定義
 *****************************************************************************/
export function useArrangementSheetPdf({
  fetchEmployeeComposable: providedFetchEmpComp,
  fetchOutsourcerComposable: providedFetchOutComp,
  fetchSiteComposable: providedFetchSiteComp,
} = {}) {
  /** define composables */
  // オプションで渡されたコンポーザブル、または内部コンポーザブルを使用
  const fetchEmployeeComposable = providedFetchEmpComp || useFetchEmployee();
  const fetchOutsourcerComposable =
    providedFetchOutComp || useFetchOutsourcer();
  const fetchSiteComposable = providedFetchSiteComp || useFetchSite();
  const { company } = useAuthStore();

  const open = async (date) => {
    const fetchedData = await fetchData(date, {
      fetchEmployeeComposable,
      fetchOutsourcerComposable,
      fetchSiteComposable,
      siteOrder: company?.siteOrder || [],
    });

    // workers分割済みデータを生成
    const expandedData = fetchedData.flatMap((data) =>
      splitWorkers(data, WORKER_COLUMN_COUNT)
    );

    // 7件ごとに分割
    const chunkSize = 7;
    const chunks = Array.from(
      { length: Math.ceil(expandedData.length / chunkSize) },
      (_, i) => expandedData.slice(i * chunkSize, (i + 1) * chunkSize)
    );

    // 各ページごとにテーブルを作成
    const content = chunks.map((group, idx) => ({
      table: {
        headerRows: 1,
        widths: WIDTHS,
        body: group.flatMap((data) => [
          firstRow(),
          secondRow(),
          thirdRow(data),
          fourthRow(data),
          fifthRow(data),
          sixthRow(),
        ]),
      },
      fontSize: FONT_SIZE,
      layout: LINE_LAYOUT,
      ...(idx > 0 ? { pageBreak: "before" } : {}),
    }));

    // PDF生成
    const pdf = pdfMake.createPdf({
      content,
      defaultStyle: { font: "NotoSansJP" },
      header: (currentPage, pageCount) => header(currentPage, pageCount, date),
      ...PAGE_DEFINITION,
    });

    pdf.open();
  };

  return { open };
}
