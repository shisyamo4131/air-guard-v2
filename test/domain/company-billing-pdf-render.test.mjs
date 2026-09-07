import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pdfMake from "pdfmake/build/pdfmake.js";
import applicationVfs from "../../utils/fonts/vfs_fonts.js";
import { createCompanyBankTransferPdfBlock } from "../../utils/billings/createCompanyBankTransferPdfBlock.js";

pdfMake.vfs = applicationVfs;
pdfMake.fonts = {
  NotoSansJP: {
    normal: "NotoSansJP-Regular.ttf",
    bold: "NotoSansJP-Bold.ttf",
    italics: "NotoSansJP-Regular.ttf",
    bolditalics: "NotoSansJP-Bold.ttf",
  },
};

const BANK_FIELDS = [
  "bankName",
  "branchName",
  "accountType",
  "accountNumber",
  "accountHolder",
];

const completeCompany = Object.freeze({
  bankName: "Codex Bank",
  branchName: "Central Branch",
  accountType: "普通",
  accountNumber: "0012345",
  accountHolder: "CODEX SECURITY SERVICES",
});

function renderPdf(content) {
  return new Promise((resolve) => {
    pdfMake
      .createPdf({
        pageSize: "A4",
        pageMargins: [40, 60, 40, 60],
        defaultStyle: { font: "NotoSansJP", fontSize: 10 },
        styles: {
          header: {
            fontSize: 18,
            bold: true,
            alignment: "center",
            margin: [0, 0, 0, 20],
          },
        },
        content,
      })
      .getBuffer(resolve);
  });
}

function extractNamedFunction(source, functionName) {
  const start = source.indexOf(`function ${functionName}(`);
  assert.notEqual(start, -1, `${functionName} must exist`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`${functionName} body was not balanced`);
}

function collectText(value, result = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectText(item, result);
  } else if (value && typeof value === "object") {
    if (typeof value.text === "string") result.push(value.text);
    for (const nested of Object.values(value)) collectText(nested, result);
  }
  return result;
}

function visitDefinition(value, visitor) {
  if (Array.isArray(value)) {
    for (const item of value) visitDefinition(item, visitor);
  } else if (value && typeof value === "object") {
    visitor(value);
    for (const nested of Object.values(value)) {
      visitDefinition(nested, visitor);
    }
  }
}

async function loadActualHeaderFactory() {
  const source = await readFile(
    new URL("../../composables/pdf/useBillingPdf.js", import.meta.url),
    "utf8",
  );
  const functionSource = extractNamedFunction(source, "createHeader");
  return new Function(
    "createCompanyBankTransferPdfBlock",
    `${functionSource}; return createHeader;`,
  )(createCompanyBankTransferPdfBlock);
}

test("complete valid billing prints account holder and preserves leading zero", () => {
  const block = createCompanyBankTransferPdfBlock(completeCompany);
  assert.deepEqual(block.stack.map(({ text }) => text), [
    "振込先: Codex Bank Central Branch",
    "普通 0012345",
    "口座名義: CODEX SECURITY SERVICES",
  ]);
  assert.equal(block.width, 205);
  assert.equal(block.stack.every(({ noWrap }) => noWrap === false), true);
});

test("invalid, partial, empty, and legacy default-only billing are omitted", () => {
  for (const company of [
    {},
    { accountType: "普通" },
    { ...completeCompany, branchName: null },
    { ...completeCompany, accountType: "貯蓄" },
    { ...completeCompany, accountNumber: "12345678" },
    { ...completeCompany, accountHolder: "bad\nname" },
  ]) {
    assert.equal(createCompanyBankTransferPdfBlock(company), null);
  }

  for (let mask = 1; mask < 2 ** BANK_FIELDS.length - 1; mask += 1) {
    const partial = Object.fromEntries(
      BANK_FIELDS.flatMap((field, index) =>
        mask & (1 << index) ? [[field, completeCompany[field]]] : [],
      ),
    );
    assert.equal(
      createCompanyBankTransferPdfBlock(partial),
      null,
      `partial mask ${mask.toString(2).padStart(5, "0")} must be omitted`,
    );
  }

  for (const company of [
    { ...completeCompany, bankName: 1 },
    { ...completeCompany, branchName: {} },
    { ...completeCompany, accountType: false },
    { ...completeCompany, accountNumber: "１２３４５６７" },
    { ...completeCompany, accountHolder: "H".repeat(201) },
  ]) {
    assert.equal(createCompanyBankTransferPdfBlock(company), null);
  }
});

test("actual full header flow retains long Japanese transfer text and renders with application fonts", async () => {
  const createHeader = await loadActualHeaderFactory();
  const bankGrapheme = "カ\u3099";
  const branchGrapheme = "は\u3099";
  const holderGrapheme = "名\u3099";
  const companyNameGrapheme = "社\u3099";
  const addressGrapheme = "住\u3099";
  const buildingGrapheme = "建\u3099";
  const company = {
    zipcode: "1000001",
    prefName: "東京都",
    city: "千代田区",
    address: addressGrapheme.repeat(200),
    building: buildingGrapheme.repeat(200),
    companyName: companyNameGrapheme.repeat(100),
    tel: "03-0000-0000",
    invoiceNumber: "1234567890123",
    bankName: bankGrapheme.repeat(100),
    branchName: branchGrapheme.repeat(100),
    accountType: "当座",
    accountNumber: "0000001",
    accountHolder: holderGrapheme.repeat(200),
  };
  const header = createHeader(
    { fixture: "billing-unused-by-header" },
    {
      zipcode: "1500001",
      prefName: "東京都",
      city: "渋谷区",
      address: "架空二丁目",
      building: "架空ビル",
      name: "架空取引先",
    },
    company,
  );
  const followingBody = {
    text: "後続本文も通常flowで生成されます。",
    margin: [0, 0, 0, 10],
  };
  const fullContent = [...header, followingBody];
  const texts = collectText(fullContent);
  assert.ok(texts.some((text) => text.includes(company.address)));
  assert.ok(texts.includes(company.building));
  assert.ok(texts.includes(company.companyName));
  assert.ok(texts.includes(`振込先: ${company.bankName} ${company.branchName}`));
  assert.ok(texts.includes(`口座名義: ${company.accountHolder}`));
  assert.ok(texts.includes("以下のとおりご請求申し上げます。"));
  assert.ok(texts.includes(followingBody.text));
  assert.equal(
    [...new Intl.Segmenter("ja", { granularity: "grapheme" }).segment(company.companyName)].length,
    100,
  );
  assert.equal(
    [...new Intl.Segmenter("ja", { granularity: "grapheme" }).segment(company.address)].length,
    200,
  );
  assert.equal(
    [...new Intl.Segmenter("ja", { granularity: "grapheme" }).segment(company.building)].length,
    200,
  );
  assert.equal(
    [...new Intl.Segmenter("ja", { granularity: "grapheme" }).segment(company.bankName)].length,
    100,
  );
  assert.equal(
    [...new Intl.Segmenter("ja", { granularity: "grapheme" }).segment(company.branchName)].length,
    100,
  );
  assert.equal(
    [...new Intl.Segmenter("ja", { granularity: "grapheme" }).segment(company.accountHolder)].length,
    200,
  );

  visitDefinition(fullContent, (node) => {
    assert.equal("absolutePosition" in node, false);
    assert.equal(
      node.text === "" &&
        ("height" in node ||
          (Array.isArray(node.margin) && node.margin.some((value) => value >= 100))),
      false,
    );
  });

  const rendered = await renderPdf(fullContent);
  const buffer = Buffer.from(rendered);
  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 500);
  assert.equal(buffer.subarray(0, 4).toString("ascii"), "%PDF");
});
