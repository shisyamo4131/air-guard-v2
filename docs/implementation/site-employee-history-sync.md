# OperationResultからSiteEmployeeHistoriesへの同期契約の実装調査

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-016 — OperationResultからSiteEmployeeHistoriesへの同期契約
- 最終確認日: 2026-08-11
- 根拠ファイル: `functions/triggers/operationResult.js`、`functions/modules/siteEmployeeHistories/rebuildHistories.js`・`rebuildHistory.js`、schemas `src/SiteEmployeeHistory.js`、schemas `src/OperationResult.js` のemployeeIds、server adapterのcreate直接契約、`firestore.rules` のCompanies配下fallback

## データ契約

- 保存先は `Companies/{companyId}/SiteEmployeeHistories/{siteId}_{employeeId}`。companyIdはpathにのみ存在し、SiteEmployeeHistory fieldではない。
- model fieldはemployeeId、siteId、firstDateAt、firstOperationResultId、lastDateAt、lastOperationResultIdで、全て必須である。
- firstDate/lastDateはfirstDateAt/lastDateAtをJSTのYYYY-MM-DDへformatする列挙可能な読み取り専用プロパティである。
- useAutonumber=false、logicalDelete=false。create overrideはdoc IDを `${siteId}_${employeeId}` に固定する。
- server adapterのcreateはtransaction.setを使うため、固定doc IDが既存でもupsertとなる。
- OperationResult.employeeIdsはemployees配列から導出される読み取り専用プロパティである。外注明細はoutsourcerIdsへ分かれるため履歴対象外である。

## イベント別同期表

| OperationResult event | 再構築対象 | 処理 |
|---|---|---|
| create | after.siteId × after.employeeIds | 各従業員について現場・従業員に一致する全実績を再検索しupsert。0件なら削除 |
| delete | before.siteId × before.employeeIds | 削除後に残る全実績を再検索しupsert。0件なら削除 |
| update（site/date不変） | after.siteId × before/after employeeIdsの和集合 | 追加・除去された従業員を含め同じ現場を再構築 |
| update（siteまたはdate変更） | before.siteIdとafter.siteId × before/after employeeIdsの和集合 | 旧現場を再構築後、新現場を再構築。site同一でdateだけ変更した場合は同じ対象を2回再構築 |

- employeeIdsの和集合はarray結合後にrebuildHistories内のSetで重複排除する。
- site移動では旧siteの履歴から対象実績が除かれ、新siteへ反映される。従業員削除も和集合に含まれるため旧履歴を再構築できる。
- 外注先はemployeeIdsに含まれず、作成・更新・削除のいずれでも履歴を作らない。

## 検索・集約アルゴリズム

1. 対象companyのOperationResultsへ `siteId == siteId` と `employeeIds array-contains employeeId` を指定する。
2. 同じbase queryから、date昇順limit(1)とdate降順limit(1)をPromise.allで取得する。
3. 0件なら固定history documentを物理deleteする。
4. 最初・最後のdocumentのdateをdayjs.tzで日始まりへ丸め、Firestore Timestampへ変換する。
5. first/lastのdateAtとOperationResult document IDをSiteEmployeeHistoryへ設定し、固定doc IDへcreate=setする。

- 差分値を加減算せず、その時点のOperationResultsをqueryして両端を再計算する。
- dateだけでsortしdocument IDのtie-breakを指定しない。同日に複数実績がある場合、firstDate/lastDateは同じ日として正しいが、firstOperationResultId/lastOperationResultIdの選択は決定的ではない。
- 同日・同site・同employeeの別OperationResultは運用上発生しない想定だが、防御は必要である。2026-08-11に、単一first/last OperationResult IDを境界日ごとの全ID配列へ置換し、startAt/endAt/docIdで決定的に並べる方針を確認した。同一境界日は両配列が同一でもよく、UIは複数対応、2件以上はwarning/audit対象とする。migration中はlegacy scalar read互換を維持し、完了後に廃止する。

## transaction・再実行・並行性

- queryとhistory write/deleteを包む共通transactionはない。各employeeをfor-ofで逐次awaitし、複数履歴を一括batchしない。
- 同じ入力で再実行すると現在のOperationResultsから同じ日付範囲を再構築するため、日付集約は冪等を意図する。tie-breakのない同日IDは再実行で変わり得る。
- 途中employeeで失敗すると、それ以前のemployee履歴だけ更新済みで、後続は未処理となる。triggerはerrorを再throwするためplatform retry対象になり得るがretry設定は未確認である。
- 0件時deleteは全errorをcatchして破棄する。削除失敗でもrebuildHistoryは成功扱いとなり、stale履歴が残ってもtrigger retryを要求しない（FUT-0042）。
- 同じsite/employeeを複数eventが並行再構築すると、query snapshot取得後のset間に競合検出がない。古いsnapshotの結果が後から書かれるrace可能性がある（FUT-0043）。
- OperationResult triggerではBilling、DailyAttendance、DailyOperationsByEmployeeの後に実行される。履歴失敗時も元OperationResultと先行作用は残る（FUT-0030）。

## Rules境界

- SiteEmployeeHistories専用matchは存在しない。
- Companies配下fallbackにより通常の同社認証Userはclient read/writeできず、super-userだけがread/writeできる。
- Functions Admin SDKはRulesを迂回する。Rulesはdoc ID、siteId、employeeId、first/last ID・dateの整合を検査しない。
- 通常Userに対してFunctions専用に近い一方、super-user clientは履歴を任意作成・更新・削除できる。閲覧・修復・保持境界は未確定である（FUT-0044、CONF-0029）。
- 2026-08-11に、本人は自己が入場した現場名・初回/最終入場日だけを閲覧でき、他従業員履歴、顧客取極め・請求、他配置者は閲覧できない方針が確認された。現場/配置管理者は同一会社履歴をreadする。whole documentは広く公開せず本人確認済みCallable/projectionを使い、writeはFunctions-only、OperationResultからのrebuildは監査付きprocessとする。本履歴はderived dataで、OperationResult retentionは別契約である。

## 仕様との一致

- document ID、site/employee key、従業員のみを対象とする点、OperationResult create/update/deleteから再構築する点は実装で確認した。
- site・date・employee変更時に旧新対象を再構築し、該当実績0件なら物理削除する。
- 履歴は勤務detailの日付ではなくOperationResult.dateを現場入場日として使う。

## 矛盾・未使用候補

- 0件deleteだけerrorを無条件に握りつぶし、create/upsert errorは伝播するため、失敗契約が非対称である。
- date変更でsiteが同一でも条件分岐により同一site/employee集合を2回連続再構築する。
- date同値時のfirst/last OperationResult ID tie-breakがない。
- 専用Rulesがなく、通常同社Userはread不能、super-userは整合検査なしでwrite可能である。

## 仮説

- delete catchは「不存在を無視する」意図と推測されるが、not-found以外のpermission・network等も区別せず吸収する。
- first/last OperationResult IDが単なる代表IDなら同日tie-breakの影響は小さいが、navigationや監査の根拠なら不安定な参照となる。
- 高頻度で同じsite/employeeへOperationResultが確定される運用では、並行再構築raceとquery回数が増える可能性がある。

## 将来要対応

- delete errorを分類し、stale履歴を成功扱いにしない（FUT-0042）。
- transactionまたはevent version/再調整で並行再構築を安全にし、境界日ID配列の決定的順序、UI複数対応、warning/audit、legacy migrationとdate-only二重再構築を整理する（FUT-0043）。
- 本人最小Callable/projection、同社現場/配置管理者read、Functions-only write、監査付きrebuildを実装し、derived historyとOperationResultの保持を分けて定める（FUT-0044、CONF-0029）。
- trigger全体の部分成功監視・再処理はFUT-0030で継続する。

## 要確認事項参照

- CONF-0018: OperationResult後続trigger失敗の監視・再処理主体。
- CONF-0029: 回答済み。本人最小field、同社管理者read、Functions-only write、監査付きrebuild、retention分離方針。

## 未確認範囲

- Firestore Emulatorでのcreate/update/delete、delete error、同時event、platform retry。
- 必要composite indexの配備状態、実データのstale履歴、同日複数実績のID利用先。
- UI、請求、勤怠、DailyOperations、SiteEmployeeHistory以外のmodel。
