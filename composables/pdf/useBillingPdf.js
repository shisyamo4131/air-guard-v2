import { formatCurrency } from "@/utils/formats/util";
import { useAuthStore } from "@/stores/useAuthStore";
import { useFetchCustomer } from "@/composables/fetch/useFetchCustomer";
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import dayjs from "dayjs";
import "dayjs/locale/ja";

/*****************************************************************************
 * VFSフォントデータの読み込み（遅延読み込み用）
 *****************************************************************************/
let pdfInitialized = false;

async function initializePdf() {
  if (pdfInitialized) {
    // 既に初期化済みの場合、pdfMakeを返す
    const pdfMake = await import("pdfmake/build/pdfmake");
    return pdfMake.default;
  }

  // 動的インポートで遅延読み込み
  const [pdfMake, vfs] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("@/utils/fonts/vfs_fonts"),
  ]);

  pdfMake.default.vfs = vfs.default;
  pdfMake.default.fonts = {
    NotoSansJP: {
      normal: "NotoSansJP-Regular.ttf",
      bold: "NotoSansJP-Bold.ttf",
      italics: "NotoSansJP-Regular.ttf",
      bolditalics: "NotoSansJP-Bold.ttf",
    },
  };

  pdfInitialized = true;
  return pdfMake.default;
}

/**
 * 請求書PDF生成用コンポーザブル
 */
export function useBillingPdf() {
  const auth = useAuthStore();
  const { fetchCustomer, cachedCustomers } = useFetchCustomer();
  const { fetchSite, cachedSites } = useFetchSite();

  /**
   * 請求書PDFを生成
   * @param {Object} billing - Billing インスタンス
   */
  async function generateBillingPdf(billing) {
    // 実際に使用する時点で初期化
    const pdfMake = await initializePdf();

    // 取引先情報を取得
    await fetchCustomer(billing.customerId);
    const customer = cachedCustomers.value[billing.customerId];

    // 現場情報を取得（複数の現場がある場合があるため、すべて取得）
    const siteIds = [
      ...new Set(billing.operationResults.map((or) => or.siteId)),
    ];
    await Promise.all(siteIds.map((siteId) => fetchSite(siteId)));

    // 会社情報
    const company = auth.company;

    // PDF定義
    const docDefinition = {
      pageSize: "A4",
      pageMargins: [40, 60, 40, 60],
      defaultStyle: {
        font: "NotoSansJP",
        fontSize: 10,
      },
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          alignment: "center",
          margin: [0, 0, 0, 20],
        },
        sectionTitle: {
          fontSize: 14,
          bold: true,
          alignment: "center",
          margin: [0, 20, 0, 10],
        },
        tableHeader: {
          bold: true,
          fillColor: "#eeeeee",
        },
      },
      content: [
        // ヘッダー部分
        ...createHeader(billing, customer, company),

        // 総請求額
        ...createSummary(billing),

        // 現場別請求明細
        createSiteBillingsTable(billing, cachedSites.value),

        // 稼働明細
        ...createOperationDetails(billing, cachedSites.value),
      ],
    };

    // PDFを生成してダウンロード
    const fileName = `請求書_${customer.name}_${dayjs(
      billing.billingDateAt
    ).format("YYYYMMDD")}.pdf`;
    pdfMake.createPdf(docDefinition).download(fileName);
  }

  /**
   * 複数のBillingドキュメントをまとめて1つのPDFを生成
   * @param {Array<Object>} billings - Billing インスタンスの配列
   */
  async function generateConsolidatedBillingPdf(billings) {
    if (!billings || billings.length === 0) {
      throw new Error("Billing documents are required");
    }

    // 実際に使用する時点で初期化
    const pdfMake = await initializePdf();

    // 最初のBillingから取引先情報を取得（全て同じ取引先のはず）
    const firstBilling = billings[0];
    await fetchCustomer(firstBilling.customerId);
    const customer = cachedCustomers.value[firstBilling.customerId];

    // 全てのBillingから現場情報を取得
    const allSiteIds = [
      ...new Set(
        billings.flatMap((billing) =>
          billing.operationResults.map((or) => or.siteId)
        )
      ),
    ];
    await Promise.all(allSiteIds.map((siteId) => fetchSite(siteId)));

    // 会社情報
    const company = auth.company;

    // 全Billingの合計を計算
    const totalSubtotal = billings.reduce((sum, b) => sum + b.subtotal, 0);
    const totalTaxAmount = billings.reduce((sum, b) => sum + b.taxAmount, 0);
    const totalAmount = billings.reduce((sum, b) => sum + b.totalAmount, 0);

    // 全現場の合計を集計
    const allSiteSummary = billings.reduce((acc, billing) => {
      billing.operationResults.forEach((or) => {
        if (!acc[or.siteId]) {
          acc[or.siteId] = 0;
        }
        acc[or.siteId] += or.salesAmount || 0;
      });
      return acc;
    }, {});

    // PDF定義
    const docDefinition = {
      pageSize: "A4",
      pageMargins: [40, 60, 40, 60],
      defaultStyle: {
        font: "NotoSansJP",
        fontSize: 10,
      },
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          alignment: "center",
          margin: [0, 0, 0, 20],
        },
        sectionTitle: {
          fontSize: 14,
          bold: true,
          alignment: "center",
          margin: [0, 20, 0, 10],
        },
        tableHeader: {
          bold: true,
          fillColor: "#eeeeee",
        },
      },
      content: [
        // ヘッダー部分（取引先と会社情報）
        ...createHeader(firstBilling, customer, company),

        // 総請求額（全Billingの合計）
        ...createConsolidatedSummary({
          subtotal: totalSubtotal,
          taxAmount: totalTaxAmount,
          totalAmount: totalAmount,
        }),

        // 全現場の請求明細
        createConsolidatedSiteBillingsTable(allSiteSummary, cachedSites.value),

        // 請求書ごとの稼働明細
        ...billings.flatMap((billing, index) => [
          // 請求書の区切り
          ...(index > 0 ? [{ text: "", pageBreak: "before" }] : []),

          // 請求日と入金予定日
          {
            text: `請求日: ${dayjs(billing.billingDateAt).format(
              "YYYY年MM月DD日"
            )} / 入金予定日: ${dayjs(billing.paymentDueDateAt).format(
              "YYYY年MM月DD日"
            )}`,
            fontSize: 10,
            margin: [0, 10, 0, 10],
            bold: true,
          },

          // 稼働明細
          ...createOperationDetails(billing, cachedSites.value),
        ]),
      ],
    };

    // PDFを生成してダウンロード
    const fileName = `請求書_${customer.name}_${dayjs(
      firstBilling.billingDateAt
    ).format("YYYYMMDD")}_統合.pdf`;
    pdfMake.createPdf(docDefinition).download(fileName);
  }

  /**
   * ヘッダー部分を生成
   */
  function createHeader(billing, customer, company) {
    // 振込先情報の生成
    const bankInfo = company.hasBankInfo
      ? `${company.bankName} ${company.branchName} ${company.accountType} ${company.accountNumber}`
      : "";

    return [
      // タイトル
      { text: "ご請求書", style: "header" },

      // 宛先（左側）
      {
        stack: [
          { text: `〒${customer.zipcode || ""}` },
          {
            text: `${customer.prefName || ""}${customer.city || ""}${
              customer.address || ""
            }`,
          },
          { text: customer.building || " ", margin: [0, 0, 0, 10] },
          { text: `${customer.name || ""} 御中`, fontSize: 12, bold: true },
        ],
        absolutePosition: { x: 40, y: 100 },
      },

      // 自社情報（右側）
      {
        stack: [
          {
            text: `〒${company.zipcode || ""} ${company.prefName || ""}${
              company.city || ""
            }${company.address || ""}`,
            fontSize: 9,
          },
          { text: company.companyName || "", fontSize: 11, bold: true },
          { text: `TEL: ${company.tel || ""}`, fontSize: 9 },
          // 振込先情報（登録されている場合のみ表示）
          ...(company.hasBankInfo
            ? [{ text: `振込先: ${bankInfo}`, fontSize: 8 }]
            : []),
          {
            text: "※お振込み手数料はご負担ください。",
            fontSize: 7,
            margin: [0, 5, 0, 0],
          },
        ],
        absolutePosition: { x: 350, y: 100 },
        alignment: "right",
      },

      // スペース
      { text: "", margin: [0, 0, 0, 80] },

      // 請求内容
      {
        text: "以下のとおりご請求申し上げます。",
        fontSize: 9,
        margin: [0, 0, 0, 10],
      },
    ];
  }

  /**
   * 総請求額部分を生成
   */
  function createSummary(billing) {
    return [
      {
        table: {
          widths: ["*", "*", "*"],
          body: [
            [
              { text: "税抜請求額", style: "tableHeader", alignment: "center" },
              { text: "消費税額", style: "tableHeader", alignment: "center" },
              { text: "税込請求額", style: "tableHeader", alignment: "center" },
            ],
            [
              {
                text: formatCurrency(billing.subtotal),
                alignment: "right",
              },
              {
                text: formatCurrency(billing.taxAmount),
                alignment: "right",
              },
              {
                text: formatCurrency(billing.totalAmount),
                alignment: "right",
                bold: true,
              },
            ],
          ],
        },
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 20],
      },
    ];
  }

  /**
   * 総請求額部分を生成（複数Billing対応）
   */
  function createConsolidatedSummary({ subtotal, taxAmount, totalAmount }) {
    return [
      {
        table: {
          widths: ["*", "*", "*"],
          body: [
            [
              { text: "税抜請求額", style: "tableHeader", alignment: "center" },
              { text: "消費税額", style: "tableHeader", alignment: "center" },
              { text: "税込請求額", style: "tableHeader", alignment: "center" },
            ],
            [
              {
                text: formatCurrency(subtotal),
                alignment: "right",
              },
              {
                text: formatCurrency(taxAmount),
                alignment: "right",
              },
              {
                text: formatCurrency(totalAmount),
                alignment: "right",
                bold: true,
              },
            ],
          ],
        },
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 20],
      },
    ];
  }

  /**
   * 統合された現場別請求明細テーブルを生成（全現場）
   */
  function createConsolidatedSiteBillingsTable(siteSummary, sites) {
    // テーブルのボディを生成
    const body = [
      [
        { text: "現場名", style: "tableHeader" },
        { text: "ご請求額", style: "tableHeader", alignment: "right" },
      ],
      ...Object.entries(siteSummary).map(([siteId, amount]) => [
        { text: sites[siteId]?.name || "不明な現場" },
        { text: formatCurrency(amount), alignment: "right" },
      ]),
    ];

    return {
      table: {
        widths: ["*", 100],
        body,
      },
      layout: "lightHorizontalLines",
      pageBreak: "after",
    };
  }

  /**
   * 現場別請求明細テーブルを生成
   */
  function createSiteBillingsTable(billing, sites) {
    // 現場ごとに売上を集計
    const siteSummary = billing.operationResults.reduce((acc, or) => {
      if (!acc[or.siteId]) {
        acc[or.siteId] = 0;
      }
      acc[or.siteId] += or.salesAmount || 0;
      return acc;
    }, {});

    // テーブルのボディを生成
    const body = [
      [
        { text: "現場名", style: "tableHeader" },
        { text: "ご請求額", style: "tableHeader", alignment: "right" },
      ],
      ...Object.entries(siteSummary).map(([siteId, amount]) => [
        { text: sites[siteId]?.name || "不明な現場" },
        { text: formatCurrency(amount), alignment: "right" },
      ]),
    ];

    return {
      table: {
        widths: ["*", 100],
        body,
      },
      layout: "lightHorizontalLines",
      pageBreak: "after",
    };
  }

  /**
   * 稼働明細部分を生成
   */
  function createOperationDetails(billing, sites) {
    return [
      { text: "稼働明細", style: "sectionTitle" },
      createOperationDetailsTable(billing, sites),
    ];
  }

  /**
   * 稼働明細テーブルを生成
   */
  function createOperationDetailsTable(billing, sites) {
    // ヘッダー
    const header = [
      { text: "日付", style: "tableHeader", alignment: "center" },
      { text: "勤務", style: "tableHeader", alignment: "center" },
      { text: "区分", style: "tableHeader", alignment: "center" },
      { text: "数量", style: "tableHeader", alignment: "center" },
      { text: "単価", style: "tableHeader", alignment: "center" },
      { text: "残業(h)", style: "tableHeader", alignment: "center" },
      { text: "残業単価", style: "tableHeader", alignment: "center" },
      { text: "金額", style: "tableHeader", alignment: "right" },
    ];

    // 現場ごとにグループ化
    const bySite = billing.operationResults.reduce((acc, or) => {
      if (!acc[or.siteId]) {
        acc[or.siteId] = [];
      }
      acc[or.siteId].push(or);
      return acc;
    }, {});

    // ボディを生成
    const body = [header];

    Object.entries(bySite).forEach(([siteId, operationResults]) => {
      // 現場名
      body.push([
        {
          text: sites[siteId]?.name || "不明な現場",
          colSpan: 8,
          bold: true,
          margin: [0, 5, 0, 5],
        },
        {},
        {},
        {},
        {},
        {},
        {},
        {},
      ]);

      // 日付・勤務区分でソート
      const sorted = operationResults.sort((a, b) => {
        if (a.dateAt !== b.dateAt) return a.dateAt < b.dateAt ? -1 : 1;
        return a.shiftType < b.shiftType ? -1 : 1;
      });

      // 各稼働実績の明細を出力
      sorted.forEach((or) => {
        // 日付と曜日を結合
        const date = dayjs(or.dateAt);
        const dateWithDay = `${date.format("MM/DD")} ${date
          .locale("ja")
          .format("(ddd)")}`;

        // 勤務区分
        const shiftType = or.shiftType === "DAY" ? "日勤" : "夜勤";

        // 基本の行を出力
        if (or.statistics?.base?.quantity > 0) {
          const overtimeHours = (
            (or.statistics.base.overtimeMinutes || 0) / 60
          ).toFixed(2);
          body.push([
            { text: dateWithDay, alignment: "center" },
            { text: shiftType, alignment: "center" },
            { text: "基本", alignment: "center" },
            { text: or.statistics.base.quantity, alignment: "center" },
            {
              text: formatCurrency(or.agreement?.unitPriceBase || 0),
              alignment: "right",
            },
            { text: overtimeHours, alignment: "center" },
            {
              text: formatCurrency(or.agreement?.overtimeUnitPriceBase || 0),
              alignment: "right",
            },
            {
              text: formatCurrency(
                (or.sales?.base?.regularAmount || 0) +
                  (or.sales?.base?.overtimeAmount || 0)
              ),
              alignment: "right",
            },
          ]);
        }

        // 資格の行を出力
        if (or.statistics?.qualified?.quantity > 0) {
          const overtimeHours = (
            (or.statistics.qualified.overtimeMinutes || 0) / 60
          ).toFixed(2);
          body.push([
            { text: dateWithDay, alignment: "center" },
            { text: shiftType, alignment: "center" },
            { text: "資格", alignment: "center" },
            { text: or.statistics.qualified.quantity, alignment: "center" },
            {
              text: formatCurrency(or.agreement?.unitPriceQualified || 0),
              alignment: "right",
            },
            { text: overtimeHours, alignment: "center" },
            {
              text: formatCurrency(
                or.agreement?.overtimeUnitPriceQualified || 0
              ),
              alignment: "right",
            },
            {
              text: formatCurrency(
                (or.sales?.qualified?.regularAmount || 0) +
                  (or.sales?.qualified?.overtimeAmount || 0)
              ),
              alignment: "right",
            },
          ]);
        }
      });
    });

    return {
      table: {
        widths: [50, 30, 30, 30, 50, 40, 50, "*"],
        body,
      },
      layout: "lightHorizontalLines",
      fontSize: 9,
    };
  }

  return {
    generateBillingPdf,
    generateConsolidatedBillingPdf,
  };
}
