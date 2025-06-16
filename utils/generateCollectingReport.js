import pdfMake from "pdfmake/build/pdfmake";
import vfsFontsData from "./fonts/vfs_fonts.js";

// pdfmakeで日本語フォントを利用可能にする設定 (NotoSansJP)
// 事前にフォントファイル (例: NotoSansJP-Regular.ttf, NotoSansJP-Bold.ttfなど) を
// プロジェクトに配置し、vfs_fonts.js を生成・インポートする必要があります。
//
// --- カスタムフォント (NotoSansJP) のための vfs_fonts.js 生成と利用手順 (備忘録) ---
// 1. フォントファイルの準備:
//    プロジェクト内の任意の場所 (例: ./fonts/NotoSansJP/) に NotoSansJP-Regular.ttf と NotoSansJP-Bold.ttf を配置する。
// 2. vfs_fonts.js の生成:
//    pdfmakeのインストールディレクトリ (例: node_modules/pdfmake/) に移動し、以下のコマンドを実行する。
//    $ node build-vfs.js "<フォントファイルが格納されているディレクトリへのパス>"
//    例: $ node build-vfs.js "./fonts/NotoSansJP"
//    これにより、node_modules/pdfmake/build/ ディレクトリ内に vfs_fonts.js が生成される。
// 3. vfs_fonts.js の配置と修正:
//    生成された vfs_fonts.js をプロジェクトの適切な場所 (例: ./utils/fonts/vfs_fonts.js) にコピーする。
//    ESモジュールとして import できるように、コピーした vfs_fonts.js の末尾に `export default vfs;` を追記する。
//    (vfs_fonts.js内でフォントデータを格納している変数が `vfs` の場合)
// 詳細はpdfmakeのドキュメントを参照してください。
pdfMake.vfs = vfsFontsData; // インポートしたVFSデータをpdfMake.vfsに設定
pdfMake.fonts = {
  NotoSansJP: {
    normal: "NotoSansJP-Regular.ttf",
    bold: "NotoSansJP-Bold.ttf",
    italics: "NotoSansJP-Regular.ttf",
    bolditalics: "NotoSansJP-Bold.ttf",
  },
};

/**
 * 運転日報PDFを生成します。
 * @param {Array<Object>} stops - 明細データの配列 ({ no, time, name, address, remarks })
 */
export function generateDrivingLogPdf(stops) {
  if (!Array.isArray(stops) || stops.length === 0) return;

  // ヘッダー: 横8列テーブル、手書き用の空セルとラベルのみ
  // 日付セルは4列結合、コース名セルも4列結合
  const headerTable = {
    table: {
      widths: Array(12).fill("*"),
      body: [
        // 1行目: 日付 | コース名
        [
          { text: "日付", style: "hdrKey", margin: [0, 4, 0, 4] },
          { text: "", colSpan: 6 },
          {},
          {},
          {},
          {},
          {},
          {
            text: "コース名",
            style: "hdrKey",
            colSpan: 2,
            margin: [0, 4, 0, 4],
          },
          {},
          { text: "", colSpan: 3 },
          {},
          {},
        ],
        // 2行目: 運転者 | 自動車登録番号 | 車種
        [
          { text: "運転者", style: "hdrKey", margin: [0, 4, 0, 4] },
          { text: "", colSpan: 2 },
          {},
          {
            text: "登録番号",
            style: "hdrKey",
            colSpan: 2,
            margin: [0, 4, 0, 4],
          },
          {},
          { text: "", colSpan: 2 },
          {},
          { text: "車種", style: "hdrKey", colSpan: 2, margin: [0, 4, 0, 4] },
          {},
          { text: "", colSpan: 3 },
          {},
          {},
        ],
        // 3行目: 出庫時刻 | 出庫距離 | 帰庫時刻 | 帰庫距離
        [
          { text: "出庫時刻", style: "hdrKey", margin: [0, 4, 0, 4] },
          { text: "", colSpan: 2 },
          {},
          { text: "出庫距離", style: "hdrKey", margin: [0, 4, 0, 4] },
          { text: "", colSpan: 2 },
          {},
          { text: "帰庫時刻", style: "hdrKey", margin: [0, 4, 0, 4] },
          { text: "", colSpan: 2 },
          {},
          { text: "帰庫距離", style: "hdrKey", margin: [0, 4, 0, 4] },
          { text: "", colSpan: 2 },
          {},
        ],
      ],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => "black",
      vLineColor: () => "black",
      paddingLeft: () => 4,
      paddingRight: () => 4,
      paddingTop: () => 2,
      paddingBottom: () => 2,
    },
    margin: [0, 0, 0, 10],
  };

  // 明細テーブル
  const detailHeader = [
    { text: "番号", style: "cellHeader" },
    { text: "時刻", style: "cellHeader" },
    { text: "排出場所名", style: "cellHeader" },
    { text: "所在地", style: "cellHeader" },
    { text: "備考", style: "cellHeader" },
  ];
  const detailBody = stops.map((s, index) => [
    { text: String(index + 1), style: "cellDataCenter" },
    { text: s.time || "", style: "cellDataCenter" },
    { text: s.name || "", style: "cellData" },
    { text: s.address || "", style: "cellData" },
    { text: s.remarks || "", style: "cellData" },
  ]);

  const detailTable = {
    table: {
      headerRows: 1,
      widths: [20, 40, "*", "*", 80],
      body: [detailHeader, ...detailBody],
    },
    layout: {
      hLineWidth: () => 1,
      vLineWidth: () => 1,
      paddingLeft: () => 4,
      paddingRight: () => 4,
      paddingTop: () => 2,
      paddingBottom: () => 2,
    },
  };

  const docDefinition = {
    pageSize: "A4",
    pageMargins: [40, 60, 40, 60],
    content: [headerTable, detailTable],
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: `${currentPage} / ${pageCount} ページ`, style: "footer" },
        { text: "", style: "footer", alignment: "right" },
      ],
      margin: [40, 0, 40, 20],
    }),
    styles: {
      hdrKey: { fontSize: 8, bold: true },
      cellHeader: { fontSize: 9, bold: true, alignment: "center" },
      cellData: { fontSize: 9 },
      cellDataCenter: { fontSize: 9, alignment: "center" },
      footer: { fontSize: 8 },
    },
    defaultStyle: {
      font: "NotoSansJP",
    },
  };

  pdfMake.createPdf(docDefinition).open();
}
