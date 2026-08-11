# 配置表・稼働予定表PDF（実装調査）

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-048
- 最終確認日: 2026-08-11
- 根拠ファイル: `pages/arrangements-manager.vue`、`components/Arrangements/Manager/WeekdayActions.vue`と直接facade、`useArrangementsActions`、`useOpenArrangementSheetPdf`、`useArrangementSheetPdf`、直接参照するSchedule/Site/Employee/Outsourcer field
- 関連文書: `site-operation-schedule.md`、`arrangement-notification-ui.md`、`layout-navigation-components.md`
- 制約: PDFを実生成せず、Schedule/Notification業務内部、請求PDF、外部送信は再調査していない。

## 入口・権限

入口は`/arrangements-manager`の各曜日columnにあるicon buttonで、tooltipは「配置表をダウンロード」である。click時にcolumn.dateを`useArrangementsActions.openPdf`へ渡す。

routeは`site-operation-schedules:read`を要求する。PDF専用permission、employee/outsourcer名のexport permission、download auditはない。Firestore/各masterの読取境界は既存route/data accessへ依存する。

配置管理pageはPC 14日、mobile 4日の範囲（前日開始）を表示するが、PDFは押した1日だけを対象とする。buttonのrole別追加表示差はない。

## 入力 / query

通常経路は配置管理が既に購読する期間内`schedules.value`と、補完済み`siteShiftTypeOrder.value`を渡す。PDF composableは渡された配列から`schedule.date === requested date`だけを抽出するため、再度Schedule queryしない。

composable単独利用で`schedules`を省略した場合は、`SiteOperationSchedule.fetchDocs`へ`date == requested date string`を渡す。対象予定が0件なら空配列となる。

並び順はsiteShiftTypeOrder内の`siteId + shiftType`のindex順。order未登録予定は後ろへ送り、双方未登録なら入力順を維持する比較結果0を返す。orderは対象増減filterに使わない。

対象schedule全件からSite、employeeIds、outsourcerIdsをbatch-style fetch helperへ渡し、cacheを参照する。各workerは`amount ?? 1`回に展開し、employeeならEmployee.displayName、外注ならOutsourcer.displayNameを帳票名とする。master欠損時は`N/A`。

## 帳票mapping

| 帳票項目 | 値源 / 変換 |
| --- | --- |
| title | 固定「配置表」 |
| date | 指定日をJST、日本語localeの`YYYY年MM月DD日(dddd)` |
| page | `currentPage / pageCount` |
| 取引先 | `site.customer.name`、11文字超を切詰め`…`。Site埋込みcustomer参照 |
| 住所 | `site.address`、12文字超を切詰め。都道府県/city/building/fullAddressではない |
| 現場 | `site.name`、11文字超を切詰め |
| 日勤/夜勤 | shiftTypeが`DAY`なら○、`NIGHT`なら●。他値は両方空 |
| 人数 | `schedule.requiredPersonnel` |
| 基本定時時間 | `schedule.startTime ～ schedule.endTime`。片方欠損は「未設定」 |
| 隊員名1〜10 | workersをamount展開し、Employee/Outsourcer.displayNameを8文字超で切詰め |
| 隊員別記入枠 | 各人に「早出」「昼残」「残業」と空欄/`～`枠 |

資格ID/資格者印、OJT、従業員/外注区分、会社名、worker ID、連絡先、電話、site code、customer code、警備種別、勤務内容、remarks、休憩、必要資格、実勤務、ArrangementNotification statusは出力しない。個人名は出すが、従業員と外注を帳票上で区別しない。

日跨ぎは`startTime/endTime`だけを印字し、`isStartNextDay`、日付、実datetimeを出さない。例として22:00〜05:00は文字列だけとなり、翌日終了か同日逆転かをPDF単独では判別できない。

## layout / file contract

- pdfmakeをdynamic importし、NotoSansJP Regular/BoldをVFSから登録する。italic/bolditalicも同2fontへmapする。
- page orientationはlandscape、marginは`[16,40,16,16]`。page sizeは明示せずpdfmake既定へ委ねる。
- body font size 6。header title 12、date 16、page count 12。
- tableは主要4列とworker 10人×3 subcolumns。罫線は6行単位のblock境界を太線にする。
- workerが10人を超えると10人単位に分割し、2block目以降は取引先・住所・勤務区分・人数・現場・定時を空欄にする。
- worker分割後のblockを7件ずつpage chunkにし、2page目以降へpage breakを置く。従って1pageは最大7現場ではなく最大7blockで、大人数現場は複数blockを消費する。
- 長文はcharacter countで切詰める。wrap、font glyph幅、全角/半角差を考慮したfit計算はない。

PDFは`pdfMake.createPdf(...).open()`でbrowser viewerを開く。app内preview、明示download、filename、保存先、Storage upload、DB record、version、外部送信、印刷処理はない。tooltipの「ダウンロード」と実動作のopenは一致しない。browser viewerから利用者が保存する場合のfilenameはcodeで指定しない。

## 生成flow

1. weekday buttonがdateをemitする。
2. arrangement facadeが現在のschedules/order refsをsnapshotとしてapplication composableへ渡す。
3. global loadingへ`Generating PDF for {date}`を追加する。
4. pdfmake/fontを初回だけlazy initializeし、以後module-scope instanceを再利用する。
5. 指定日filter、order sort、Site/Employee/Outsourcer fetch、worker amount展開を行う。
6. worker 10人/page block 7件へ分割しdocument definitionを作る。
7. `pdf.open()`を呼ぶ。
8. errorはloggerへ渡して吸収し、finallyでloadingを解除する。

PDF button自身にloading/disabled/debounceはなく、global overlayがclickを遮断するかは共通component契約で未確認である。複数日や同日を連続clickすると複数生成を開始できる候補がある。

## failure / security

- dateのrequired/format validationを明示せず、無効値はfilter/fetch/header format/pdfmakeまで進み得る。
- master欠損はSite自体がundefinedでもN/A表示、worker master欠損もN/Aとして生成を続ける。欠損警告や対象件数確認はない。
- 予定0件でも空contentでPDF openを試みる。blank/errorになるruntime結果は未確認。
- async fetch/font load後に`window.open`相当を呼ぶため、browser popup policyでblockされる可能性があるが未確認。
- errorはlog/store連携を明示指定しない`useLogger`へ渡し、callerへrethrowしない。利用者向け成功/失敗message、retry buttonはない。
- PDFは同社の現場住所、取引先名、勤務予定、従業員/外注警備員名を含む。download専用権限、mask、watermark、生成者/日時、保持、監査、誤送付防止はない。
- Site/Employee/Outsourcerは帳票生成時のlive master cacheを使うため、予定作成時snapshotではない。master変更・欠損により過去/再生成帳票が変化し得る。
- worker amountを同名で複製するため、匿名人数枠と同一人物複数配置を帳票上で区別できない。

## 矛盾・未使用候補

- UIはdownloadと説明するが実装はfilenameなしのbrowser open。
- `useCompanyStore`から`company`を取得するがPDFで未使用。発行会社名等は出ない。
- commentは「1ページに7件の現場」とするが、実際はworker分割後block 7件である。
- DAY/NIGHT以外のshiftTypeは印なし。日跨ぎflagも出ない。
- 住所は`site.address`だけで、full address/建物/都道府県等の保存契約との一致は未確認。
- 資格/OJT/外注区分を扱わず、配置表から要員属性を確認できない。
- worker向け3枠「早出/昼残/残業」の値源・記入運用はcodeにない印刷用空欄である。
- 予定0件、欠損master、長文、大人数をwarningなくPDF化する。
- preview/download/storage/send APIは存在しない。

## 将来要対応

- FUT-0157: 配置表PDFのfield、日跨ぎ、資格/OJT/外注、live master、empty/large layoutを正式化する。
- FUT-0158: PDF生成の権限、filename、download/open、監査、失敗・多重生成・情報保護を整備する。

## 要確認事項

- CONF-0133: 配置表の正式利用者・配布方法、必須field、日跨ぎ/要員属性、帳票identity・保存/監査契約。

## 未確認範囲

実PDF、browser、popup/download filename、印刷、font rendering、page overflow、0/8/10/11/70人・大量現場、長い全角文字、欠損master、mobile click、外部配布は未確認である。pdfmake version既定page size、Air loading/error UI、Schedule/Notification内部、Rules runtime、実個人情報は未調査・未使用である。
