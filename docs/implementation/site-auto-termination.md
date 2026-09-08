# Site自動終了scheduled task 実装調査

## メタデータ

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-054
- 最終確認日: 2026-08-11
- 根拠ファイル: `functions/index.js`、`functions/modules/maintenance.js`、`functions/modules/sites/index.js`、`functions/modules/sites/autoTermination.js`、schemas `Site.js`、`constants/site-status.js`、直接のSites Rules/UI、`site-master.md`、`cloud-functions-catalog.md`、`system-maintenance.md`

## 確認済み方針

- 自動終了を維持し、永続statusはACTIVE/TERMINATEDの2値のままとする。工期終了後のACTIVEは「工期終了済み」「自動終了予定」「工期終了済み・予定あり」の派生Chipで示す。
- JSTで工期終了日の90日後00:00以降、当日以降予定と未実績化予定がないACTIVE Siteだけを、transactionまたは同等preconditionで競合安全にTERMINATEDへ変更する。工期未設定、予定あり、競合時は終了しない。
- TERMINATEDは通常master編集を制限するが、終了済み表示・識別情報・確認付きで新規業務へ選択できる。単発残工事はTERMINATEDのまま、継続再開はstrict `sites:write`、reason、新工期で扱う。
- 自動終了は下流dataを変更せず、現在遷移metadataだけを保存する。専用append-only履歴と現場ごとのemail/FCMは設けず、初期通知はdashboard・一覧表示とする。[ADR 0054](../decisions/0054-site-auto-termination-and-terminated-selection.md)を正とする。

以上は採用済みで未実装の方針であり、以下の現行実装事実とは区別する。

## 入口・schedule・timezone

`functions/index.js`は`maintenance.js`をexportし、deployed candidate `runDailyTask`はCloud Schedulerで毎日00:00、`Asia/Tokyo`指定で起動する。Functions entryはdayjsへutc/timezone pluginを登録し、default timezoneも`Asia/Tokyo`へ設定する。

handlerは次の順で直列実行する。

1. 60日超のSiteOperationScheduleと関係するArrangementNotificationをcleanupする。
2. cleanupが成功した場合だけ`sitesAutoTermination()`を呼ぶ。
3. いずれかがthrowすると外側catchがlogするがrethrowしない。

したがってschedule cleanup失敗時はSite自動終了を開始せず、handler自体は成功扱いになり得る。maintenance modeのSystem/Company flagは参照せず、名称上のmaintenance moduleに同居するだけである。

## 対象条件・状態遷移

実行時JST当日の00:00を基準に3か月subtractしたDateをdeadlineとし、collection group `Sites`へ次の2条件を一括queryする。

- `status == ACTIVE`
- `constructionPeriodEndAt < deadline`

一致Siteを`TERMINATED`へ変更し、全対象で共通の`Timestamp.now()`を`updatedAt`へ保存する。比較はstrict `<`なので、ちょうど3か月前の00:00と同値の終了日は対象外で、次回日次実行時に対象となる。工期終了日がnull/欠損、ACTIVE以外のSiteは対象外である。工期開始日、Customer、Agreement、会社状態、将来予定、実績、通知は条件に含めない。

status enumはACTIVE/TERMINATEDの2値で、自動終了専用状態・終了理由・終了日時・actor・sourceは保存しない。

## query・batch・規模

- collectionGroup queryは全tenantを1回で読み、`limit`、cursor、pagination、company filterを持たない。
- 最大500 updateずつWriteBatchへ詰め、全batchを`Promise.all`で並列commitする。
- query snapshotを全件memoryへ保持する。件数制限、実行時間/メモリ/同時commit数制限、checkpointはない。
- 複数batchは全体transactionではない。あるbatchだけ成功し別batchが失敗する部分成功があり得る。
- 成功batchのSiteはTERMINATEDとなるため次回queryから外れ、未成功batchはACTIVEのまま次回候補となる。この意味ではdocument単位の再実行は概ねidempotentだが、同一run全件atomicではない。
- scheduled handlerがerrorを吸収するため、Cloud Scheduler/Functions platformの失敗retryを誘発しない。明示retry option、失敗ID保存、reconciliation commandは確認できない。

## 手動終了との差

| 観点 | 自動終了 | `Site.terminate()`手動経路 |
| --- | --- | --- |
| actor | Admin SDK scheduled task | client User |
| 条件 | ACTIVEかつ工期終了がJST基準3か月より前 | doc読込済み、未終了、JST当日以降scheduleが0件 |
| 将来schedule guard | なし | 1件でもあれば拒否 |
| 更新 | statusとupdatedAtだけ | instance status変更後`update()` |
| 権限 | Admin SDKでRules bypass | 現行Rulesは同一会社User全write |
| audit/reason | なし | なし |

自動終了は将来scheduleが存在してもTERMINATEDへできる。先行cleanupは過去scheduleだけを削除し、将来schedule guardの代替ではない。手動終了と異なる条件が意図された仕様かはcodeから確定できない。

## 下流・UI影響

- ACTIVE一覧から自動的に消え、TERMINATED一覧では検索結果または空検索時のupdatedAt降順・最大20件に表示される。詳細route自体は残る。
- 現行Autocompleteはstatus限定がなく、TERMINATED Siteも新規参照候補へ出得る。詳細でも編集、取極め変更、archive、再終了UIが残る。
- Site内`agreementsV2`は変更・終了されず、Customer、User、Schedule、ArrangementNotification、OperationResult、Billingにもcascade更新しない。
- 既存および将来ScheduleはSite IDを保持したままで、予定・通知・実績作成をserver/Rulesで停止する直接処理はない。
- 確認済み方針ではTERMINATEDの通常master編集を制限するが、新規業務では終了済み表示・確認付きで選択できる。単発残工事はTERMINATEDのまま、継続再開はstrict `sites:write`・reason・新工期で扱い、Agreementは自動再有効化しない。しかしこれらは現行実装へ未反映である。

## 並行性・再有効化race

query後batch commitまでstatusのpreconditionやtransaction再読込がない。別処理がSiteを再有効化、工期変更、手動終了、予定作成しても、scheduled batchはstatusをTERMINATED、updatedAtをscheduled値で後勝ち更新できる。逆にscheduled commit直後の直接writeはACTIVEへ戻せる。正式な再有効化UIは未実装だが、Rules上は同一会社Userの直接writeで到達可能である。

batchはstatus/updatedAtだけをupdateするため他fieldの同時編集自体は上書きしないが、状態判断と関連予定の整合は競合安全でない。

## logging・監視・監査

開始、0件、対象件数、完了件数をloggerへ出す。対象company/site ID、batch別結果、duration、failure count、correlation ID、metric/alert、監査documentはない。途中失敗時は完了logがなく上位でerror logされるが、handlerは失敗として終了しない。自動終了のreason/source/threshold dateもSiteへ残らない。

## Rules・security

Admin SDK処理はFirestore Rulesをbypassする。通常client RulesはCompany配下Sitesを同一会社の全認証Userまたはsuper-userへread/write許可し、status transition、工期、将来schedule、再有効化を強制しない。自動処理と手動/直接writeが同じstatus fieldを異なるguardで更新する。

## 矛盾・未使用候補

- 自動終了は手動終了の将来schedule guardを迂回する。
- cleanup失敗が後続自動終了を止め、外側catchがerrorを吸収する。
- 全tenant無制限queryと全batch同時commitに規模制御がない。
- `context`引数はhandler内で未使用である。
- system/company maintenance状態はこのscheduled処理を停止しない。

## 将来要対応

- FUT-0161: ADR 0054に従い、自動終了を90日・予定guard・競合・再試行・maintenance・現在遷移metadataの契約へ揃える。
- CONF-0135: 2026-09-05回答済み。自動終了、派生Chip、予定guard、TERMINATED選択、再有効化、通知・履歴境界はADR 0054を正とする。
- FUT-0060/FUT-0062: 確認済みSite権限・TERMINATED lifecycleをUI/Rules/serverへ実装する。

## 要確認事項参照

- CONF-0046/0048の回答済み権限・再有効化方針は前提として維持する。
- 自動処理固有の終了条件と競合はCONF-0135で回答済みであり、新規の細分質問は作らない。
- codeで解消した事項: 自動終了はfuture scheduleを確認せず、Agreement/User/関連documentを更新せず、maintenance modeにも依存しない。

## 未確認範囲

- Cloud Scheduler/Functionsの実deploy option、実行時間、quota、index、実件数、log/alert運用。
- Emulator/runtimeでの月末subtract、DST非該当JST、Timestampとdate field converterの比較。
- 自動終了後の全下流query、直接writeによる再有効化実績、既存data品質。
- 既存dataにおける工期未設定・予定矛盾の件数、正確な遷移metadata shape、必要index・quota、候補表示caller全体。
