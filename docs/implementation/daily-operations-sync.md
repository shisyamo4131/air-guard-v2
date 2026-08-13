# OperationResultからDailyOperationsByEmployeeへの同期契約の実装調査

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-015 — OperationResultからDailyOperationsへの同期契約
- 最終確認日: 2026-08-11
- 根拠ファイル: `functions/triggers/operationResult.js`、`functions/modules/dailyOperationsByEmployee/` のfetch/add/remove/save/sync、`firestore.rules` のCompanies配下fallback、root/functions `package-lock.json` のschema導入version

## データ契約

- 実装上のmodel名は `DailyOperationByEmployee`、同期対象collectionの論理名は `DailyOperationsByEmployee` である。実pathは `Companies/{companyId}/{DailyOperationByEmployee.collectionPath}/{docId}` とmodel定数から組み立てる。
- document IDは `${employee.id}_${employee.date}`。companyIdはpath prefixにのみ使い、同期moduleはdocument fieldとして設定しない。
- 新規documentはdocId、employeeId、employee.dateAt、空のoperationResultsで初期化する。
- operationResultsには対象OperationResult instance全体を埋め込む。operationResultIdsはこの配列から保存される前提で、既存配置先を `array-contains operationResult.docId` で逆引きする。
- 2026-08-11のユーザー回答では、full embeddedは`FireModel.classProps.customClass`で各要素をOperationResult instanceへ復元し、既存component/composableのinstance契約を守るため意図した設計である。当面維持し、DEV容量計測後に明示的whitelistのpartial plain objectを同じOperationResultへhydrateするprototypeを検証する。`instanceof`、全使用field/getter、欠落field、再serializationを含む完全互換性確認後だけmigrationし、非互換ならfull snapshotと将来のdate partition/subcollectionを選ぶ。derived subclassは使わずschema循環依存を避ける。
- 対象は `operationResult.employees` のみで、outsourcersは走査しない。
- SPEC-DEEP-003で隣接schema repositoryの`DailyOperationByEmployee.js`を直接確認した。modelは日勤/夜勤件数、勤務・所定内・残業・休憩分、取極め基準売上の読み取り専用プロパティを持つ。取極め基準売上はOJTを0円、取極めまたはrate欠損を未算出、時間単価を分/60で数量化し、明細ごとの通常＋残業額を`Math.round`する。

## イベント別同期表

| OperationResult event | 旧配置先 | 新配置先 | 保存結果 |
|---|---|---|---|
| create | afterのdocIdを含む既存documentをarray-containsで逆引き | after.employeesのemployee.id＋employee.dateをpoint fetch | 同じresult IDを全対象から除去後、employee/date一致先へafterを追加。残件create/update、0件既存はdelete |
| update | beforeのdocIdを含む全documentを逆引き | after.employeesから新対象を追加fetch | 旧新unionからbefore IDを除去し、afterを新対象へ追加。employee/date移動時は旧を残件updateまたはdelete、新をcreate/update |
| delete | beforeのdocIdを含む全documentを逆引き | なし | before IDを除去し、残件update、0件delete |

- update時のlookupはbefore instanceを使う。通常before/afterでdocIdは同じため、現在保存されている全配置先を取得できる。
- 逆引き結果と新対象はdocIdをkeyにしたMapへ統合され、同一employee/dateの重複fetch・writeを抑える。

## 検索・集計アルゴリズム

1. beforeがあればbefore、なければafterをOperationResultへ復元する。
2. transaction内で `operationResultIds array-contains docId` queryを実行し、旧配置先を全取得する。
3. afterがあれば各employeeの `${id}_${date}` をpoint fetchする。旧配置先Mapに同じdocIdがあれば再取得しない。
4. union全体からlookup OperationResultと同じdocIdをfilterで除去する。
5. afterがあれば、employee.idとDailyOperation.employeeId、employee.dateとDailyOperation.dateが一致する各documentへafter instanceを1件追加する。追加前にも同じresult IDを除去する。
6. 既存documentはoperationResultsが残ればupdate、0件ならdeleteする。未作成documentは1件以上ならcreateする。

- date、employeeの変更は旧配置先逆引きとafter新keyのunionで移動する。
- site、shiftType、customer、請求可否等はdocument keyに使わない。同じemployee/dateなら埋込みOperationResultの置換となり、employee/dateも変われば旧新documentへ移動する。
- site/customer/請求可否はdocument keyではない。schemaのdetailsはemployeeId＋date一致のemployee明細を抽出し、shift別件数、勤務分、休憩、取極め基準売上をembedded OperationResultから再計算する。

## transaction・再実行・並行性

- DailyOperationsByEmployee同期単体は1回のFirestore transactionで、query/point readsを先に完了してから対象documentのcreate/update/deleteを行う。複数employee/dateも同じtransactionに含む。
- 同じresult IDを全対象から除去してからafterを1件追加するため、同一event retryでoperationResultsのID重複を抑える。
- 同じ日次documentを別OperationResult eventが同時更新する場合、Firestore transactionの競合retryに依存する。Emulatorでの並行検証はしていない。
- 元OperationResult writeとは別trigger・別transactionである。triggerはBilling、DailyAttendance、DailyOperationsByEmployee、SiteEmployeeHistoriesの順にawaitするため、本同期失敗時も元writeと先行Billing/DailyAttendance作用は残り得る。既存FUT-0030の部分成功課題に該当する。
- transaction callbackが再実行されても、callback内instanceは毎回query結果から再構成される。

## Rules境界

- `DailyOperationsByEmployee` 専用matchはない。
- Companies配下の未定義collection fallbackにより、通常の同社認証Userはclient read/writeできず、super-userだけがread/writeできる。
- Cloud Functions Admin SDKはRulesを迂回して同期する。Rulesはdocument ID、employeeId/date、operationResultIds、埋込みOperationResultの会社整合をfield単位で検査しない。
- 通常UserからはFunctions専用に近いが、super-user client writeは集約契約を迂回できる。正式な閲覧・修復権限は未決である（FUT-0041）。
- 2026-08-11に、本人は自己の勤務日・開始終了・休憩・勤務分・現場・勤務区分を閲覧でき、他従業員、売上・単価・請求・顧客取極めは閲覧できない方針が確認された。勤怠/配置管理者は同一会社勤怠をreadし、billing dataは請求権限者だけへ提供する。whole documentは公開せず本人確認済みprojection/Callableで最小fieldを返し、writeはFunctions-only、repairは監査付きprocessとする。

## 仕様との一致

- operationResultIds逆引き、全旧配置先からの除去、after employee/dateへの再配置、残件update・0件deleteは実装されている。
- 外注先を対象にせず、OperationResult.employeesだけを日次集約する。
- OperationResultの作成・更新・削除すべてが同じsync入口を通る。
- 埋込み集計値の直接schema計算式はSPEC-DEEP-003で確認した。ただし丸め・取極め欠損時の現行実装を正式会計仕様とは扱わず、CONF-0134の判断対象として維持する。

## 矛盾・未使用候補

- collection専用Rulesがないため、通常の同社Userはclientから閲覧できない一方、super-userは全fieldを直接変更できる。
- OperationResult全体を各employee/date documentへ複製する。日次件数・workers・articles等が増えるほどdocument sizeとtransaction payloadが増える（FUT-0038へ証拠追記）。
- customer、site、shiftType、請求可否は配置keyでなく埋込み値である。これらをkeyとする別documentへの移動はない。

## 仮説

- 同一日・同一従業員のOperationResult数や埋込み配列が多い場合、Firestore document size上限またはtransaction contentionへ達する可能性がある。
- super-userによる直接修復が必要な運用を意図してfallback writeを残している可能性があるが、承認済み設計意図は確認できない。
- schemaの集計getterがOperationResultのcustomer・agreement・isBillable等を参照する場合、埋込み置換時に再計算されると推測されるが、式と保存動作は未確認である。

## 将来要対応

- freee勤怠管理Plusの取込formatと互換性をfixture・実取込で確認する（FUT-0040）。
- DailyOperationsByEmployeeをwhole-document公開せず、本人最小projection/Callable、同社勤怠/配置管理者read、billing権限分離、Functions-only write、監査付きrepairとして実装する（FUT-0041）。
- full OperationResult埋込みの日次容量・同時更新をDailyAttendanceと合わせて検証する（FUT-0038 updated）。
- trigger全体の部分成功・retry運用はFUT-0030で継続する。

## 質問

- 具体的なpermission名、projection/Callable API、audit保持は未確認である。本人向け最小field、管理者/billing分離、Functions-only write、監査付きrepair方針は確認済みである。
- 具体的permission名、projection/Callable API、audit保持、正式な丸め・売上計算仕様は未確定である。

## 未確認範囲

- DailyOperationByEmployeeのruntime serialization結果と、導入package版が隣接repository HEADと完全一致するか。
- Emulatorでのcreate/update/delete、transaction retry、並行event、1MiB境界。
- 実データの重複・stale配置先、trigger retry設定、監視・repair手順。
- 請求、勤怠、SiteEmployeeHistory、画面本文、他model。
