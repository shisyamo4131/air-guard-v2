# `generateCollectingReport.js` 帳票utility（実装調査）

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-062
- 最終確認日: 2026-08-11
- 根拠ファイル: `utils/generateCollectingReport.js`、`utils/fonts/vfs_fonts.js`、repository-wide import/export/symbol検索、`package.json`、`nuxt.config.js`
- 制約: PDF生成、browser/runtime、実data、外部環境は確認していない。

## 責務と到達性

file名は`generateCollectingReport.js`だが、実装する唯一のexportは`generateDrivingLogPdf(stops)`であり、コメントと帳票title相当の内容も「運転日報」である。「集金報告」を生成する処理、金額集計、請求回収処理は存在しない。

repository-wideの静的検索では、このfileまたは`generateDrivingLogPdf`をimport・re-export・呼出しする箇所は0件だった。文字列組立によるdynamic importも確認できず、現時点では未使用候補である。Nuxtのauto-import/build時解決と実bundle tree shakingはruntime/build未確認だが、呼出しsymbolがsource中にないため画面到達経路は確認できない。

## input / output contract

| 項目 | 実装contract |
| --- | --- |
| input | `stops`。非空Arrayだけを処理する。JSDocは各要素を`{ no, time, name, address, remarks }`とする。 |
| 空・型違い | Arrayでない、または空Arrayなら何もせず`undefined`を返す。error/messageはない。 |
| 行番号 | `no`は参照せず、配列index + 1を印字する。 |
| 時刻 | `s.time || ""`。parse、timezone、format、日跨ぎ検証はない。 |
| 現場名・所在地・備考 | `name`、`address`、`remarks`をそのままtextへ渡し、falsy値は空文字にする。 |
| return | 常に`undefined`。PDF object、Blob、filename、成功状態を返さない。 |
| external action | `pdfMake.createPdf(docDefinition).open()`によりbrowser viewerを開く。download、save、Storage upload、DB write、外部送信は実装しない。 |

`stops`のnull element、getter例外、非string object、循環object等を検証しない。特にnull/undefined elementは`s.time`参照で同期例外になる。配列件数上限、文字数上限、sort、重複排除、aggregateはない。入力順を保ち、全行を1 tableへ追加するためdocument definition構築は概ねO(n)である。

## 帳票・format contract

- pdfmake `^0.2.20`をstatic importし、約15.3 MBのlocal VFS font dataをmodule import時に読み込む。
- module評価時にglobal `pdfMake.vfs`と`pdfMake.fonts`をNotoSansJPへ上書きする。italic/bolditalicもRegular/Boldへmapする。
- A4 portrait、margin `[40, 60, 40, 60]`。page orientationは指定しない。
- 上部は日付、コース名、運転者、登録番号、車種、出帰庫時刻・距離の手書き用空欄で、inputから値を埋めない。
- 明細は番号、時刻、現場名、所在地、備考の5列。header rowは改page時に繰り返される。
- footerは`currentPage / pageCount ページ`。filename、document metadata、生成日時、生成者、会社名、confidential markingはない。
- locale、date/timezone、数値format、改行制御、長文truncate、row split制御はない。pdfmake既定のwrap/page splitへ委ねる。

## data / privacy boundary

入力契約は氏名ではなく現場名・所在地・時刻・備考で、直接の請求金額、単価、税、従業員IDは扱わない。ただし所在地、巡回順、時刻、備考は業務上の機微情報を含み得る。utility自身に認証、tenant確認、field allowlist、mask、audit、確認dialog、watermarkはなく、callerも存在しないため現在のUI権限境界はない。

schema class/getterは直接参照せずplain objectだけを受ける。このためSite等のtenant整合、live/snapshot、住所format、閲覧権限はcaller責務になるが、現行callerは確認できない。

## failure / exception

- `createPdf`または`open`の例外をcatchせず、user feedback、loading、retry、popup block対処を持たない。
- font dataをmodule scopeで設定するため、他のPDF utilityと同一pdfmake instanceを共有した場合の設定順依存が候補となる。他のBilling/配置表PDFはfontをdynamic importして個別初期化するが、本fileとの同時利用はcaller不在のため到達しない。
- empty inputをsilent no-opとし、callerが成功・失敗・対象0件を識別できない。
- `|| ""`により数値0やboolean falseも空へ変換する一方、truthyな非string値はそのままpdfmakeへ渡す。
- 大量件数・長文・不正Unicode・popup block・font load失敗の結果はruntime未確認である。

## 矛盾・未使用候補

- file名のcollecting reportとexport/帳票内容のdriving logが一致しない。
- JSDocの`no`を無視してindexで番号を再採番する。
- font生成手順の長い備忘録がproduction utilityへ残る一方、既存2 PDF経路は別のlazy initializationを持つ。
- static caller/import/exportは0件で、保持理由、正式用途、route/permissionが確認できない。
- header commentは「横8列」とするが、実table widthsは12列である。

## 将来要対応

[FUT-0168](future-actions.md#fut-0168-未使用の運転日報pdf-utilityを用途確定後に削除または正式化する)へ統合した。現時点で利用者判断を求める独立仕様ではなく、まずGit履歴・product owner・build artifactで保持理由を確認する実装保守事項として扱う。

## 要確認事項

新規CONFは追加しない。正式な運転日報機能として採用する指示が将来出た場合にのみ、actor/permission、input source、保存/download、監査・保持、privacyをまとめて仕様化する。

## 未確認範囲

- Nuxt production bundle/tree shaking、auto-import registry、browser popup、PDF rendering、日本語font・改page・長文表示。
- Git history、過去route、利用者運用、正式な運転日報または集金報告要件。
- 実data、外部環境、Storage、印刷・download後の保持。
