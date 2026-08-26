# Super-user運用画面 実装調査

## メタデータ

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-056
- 最終確認日: 2026-08-11
- 根拠ファイル: `pages/super-user/index.vue`、`utils/pageSettings.js`、`stores/useAuthStore.js`、`useAuthActions.js`、Functions `apis/index.js`、`siteEmployeeHistories/rebuildAllHistories.js`、`rebuildHistory.js`、SecurityReport index rebuild/sync、関連実装文書

> 後続改修: 2026-08-15に両再構築Callableは、verified email、token/current Auth双方の同社会社claim・`isSuperUser`・有効状態、同社の有効な本登録User、要求会社一致を共有認可で強制するよう変更した。以下のserver guard記述は2026-08-11時点の基準線であり、現在の境界は`callable-authorization.md`を正とする。

## route一覧・入口

`pages/super-user`配下の実在routeは`/super-user` 1件だけで、子routeはない。pageSettingsは`SUPER_USER` access policy、`navigation: true`とする。clientのsuper-user roleはFirebase ID token custom claim `isSuperUser=true`からstoreへ設定され、会社adminとは別である。

page middleware/navigationの判定はclient表示・遷移guardであり、Callableのserver認可を代替しない。会社adminは`super-user`専用先行guardによりrouteへ入れない。super-userはpermission catalog上`*`を持ち、通常業務pageにもclient上到達できる。

## 操作catalog

| UI表示 | Callable | 入力tenant | 作用 | server guard |
| --- | --- | --- | --- | --- |
| 現場入場履歴再構築 | `rebuildAllHistories` | login tokenの`companyId`をclientから送信 | 指定会社の全OperationResultからsite/employee組を列挙し、SiteEmployeeHistoryを作成/上書き。該当実績なしpairは個別rebuild時に削除 | verified email、token/current Auth双方の同社会社claim・`isSuperUser`・有効状態、同社の有効な本登録User、要求会社一致 |
| 警備日報インデックス再構築 | `rebuildSecurityReportIndexes` | 同上 | 指定会社Storageと既存SecurityReportIndexesを走査し、indexを作成/更新/削除 | 履歴再構築と同じ共有認可 |

画面の1枚目subtitleは「全会社の現場入場履歴を再構築」と表示するが、handlerは現在の`auth.companyId` 1社だけを送る。全会社loopはない。super-user tokenにcompanyIdがない/空の場合はCallableのstring検証で拒否される。

## 現場入場履歴再構築

serverは指定CompanyのOperationResultsを全件取得し、各documentのsiteIdとemployeeIdsからunique pairを作り、pairを直列で`rebuildHistory`する。各pairは最古/最新OperationResultをqueryし、`${siteId}_${employeeId}`へSiteEmployeeHistoryをcreateする。

- Callableは同社の有効なスーパーユーザーをserverで強制し、会社admin・一般User・他社指定を拒否する。
- App Check、rate limit、件数上限、pagination、timeout/memory option、run ID、actor/reason、dry-run/previewがない。
- pairを直列処理し、途中failureで後続を止める。既に更新済みpairはrollbackしない。
- 現在OperationResultsに存在するpairだけを列挙するため、過去には存在したが現在0件となったstale SiteEmployeeHistoryを全体scanして削除しない。`rebuildHistory`の0件delete branchは、このall-rebuild経路では通常pair自体が作られず到達しない。
- `instance.create`の既存document時挙動はadapter契約に依存し、上書き/失敗のruntimeは未確認である。

## 警備日報インデックス再構築

serverは指定CompanyのStorage prefixを全件listし、本体画像からoperationIdを集め、既存index IDもunionする。20 IDずつ`Promise.all`で同期し、画像0件または親Operation欠損なら既存indexを削除、その他はdateAt/reportCountをcreate/updateする。

- Callableはsuper-userをserverで強制し、会社admin・一般Userを拒否する。
- caller claim companyIdと入力companyIdの一致を要求する。入力companyIdが本当に意図したtenantかの確認UIはない。
- Storage全件listとindex全件fetchを行い、page/cursor/件数previewはない。timeoutは540秒だがmemory/concurrency/rate limit/App Checkは未指定である。
- 20件chunk内は部分成功し得て、chunk failureで後続を止める。再実行は絶対件数同期のため概ね収束するが、run result・failed IDs・resume checkpointはない。

## confirmation・loading・error・audit

両buttonは確認dialog、対象会社名/ID、対象件数、dry-run、reason入力を表示せず、1 clickでCallableを開始する。button自身にloading/disabled/single-flight guardはない。global loading queueへ追加するためlayout overlayは表示されるが、handler単位で二重clickをserver側拒否するidempotency keyはない。

成功時はserver messageをsnackbarへ追加し、失敗時は共通logger/errors storeへ渡す。履歴再構築は固定成功文だけで処理件数なし、index再構築はprocessed/indexed countを返す。失敗対象・部分成功・再試行案内は表示しない。

server側にsecurity audit document、actor UID、reason、before/after、run ID、開始/終了/部分結果は保存しない。SecurityReport同期はoperation単位loggerを出すが、運用監査recordではない。履歴再構築coreはloggerを持たない。

## UI-onlyとserver enforcement

- `/super-user`表示はclient token roleで守られる。
- 両再構築Callableは同じ共有認可をserverで検証する。
- Firestore Rulesの恒久的なsuper-user全会社fallbackは廃止済みである。これらCallableはAdmin SDKでRulesをbypassするため、Callable自身の共有認可が境界となる。
- disabled Userの既存token、claim失効/変更の即時反映、App Check/IAM overrideは未確認である。

## 他の保守領域との境界

このpageにはCompany作成/削除・切替、System/Company maintenance設定、Subscription/Stripe操作、archive inspection/restore、backup/export/import、通知test、User repairは存在しない。Admin SDK backup/restoreは別repository CLIで、画面から呼ばない。`/settings/checkout`は別routeのsuper-user限定画面であり、このdirectory配下ではない。

## 誤操作・cross-tenant

- UIはlogin storeのcompanyIdを自動送信し、対象tenantを選択・確認できない。運営super-userがどのCompany contextでloginしているかを画面内に表示しない。
- 両Callableはcurrent companyだけを許可し、他社指定を拒否する。UIもcurrent companyだけを送信する。
- 同時実行、OperationResult/Storage更新中の実行、通常triggerとの競合をlockせず、途中状態が閲覧され得る。

## 未使用・stub候補

- page subtitleの「全会社」は実装と不一致で、全会社操作UI/loopは存在しない。
- super-user向けと想定されるmaintenance解除、archive緊急restore、backup/recovery等はこのpageにstubすらない。
- 両再構築Callableのserver guardはUIのsuper-user限定意図と整合した。

## 将来要対応

- FUT-0151: 両再構築Callableのactor/tenantは実装済み。残るApp Check、rate limit、idempotency、監査をserverで強制する。
- FUT-0163: super-user保守操作へ対象確認、single-flight、preview、監査、部分結果・resumeを実装する。
- CONF-0111: super-user/developer/adminを含む正式authorization model。
- CONF-0129: 管理Callableのactor/tenant/App Check/rate limit。
- CONF-0130: function runtime/retry/SLO/replay。

## codeで解消・統合した確認事項

- 実在super-user routeは1件で、提供操作は2種のrebuildだけである。
- 「全会社履歴再構築」は表示文言だけで、実装はcurrent companyId 1件である。
- SecurityReport rebuildはserver super-user guardあり、History rebuildは認証すらない。この差はCONF-0129/FUT-0151へ統合し、新規CONFは追加しない。

## 未確認範囲

- Emulator/runtime、Cloud側App Check/IAM、実deploy surface、実data件数、timeout/料金、同時実行。
- global loading overlayのclick遮断実測、snackbar/error視認性、disabled token失効。
- 正式な運営者手順、対象tenant切替、承認二者制、監査保持、break-glass運用。
