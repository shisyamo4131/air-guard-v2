# SITE-08 Codex専用local統合確認記録

## 対象と現在判定

- 対象: SITE-01からSITE-07までのSite改修と、直接・間接に影響した既存機能のlocal統合確認
- 環境: 先行確認は`demo-air-guard-v2-codex`とCodexインアプリブラウザ。追加確認は利用者が許可した起動済みLocal Emulatorとサインイン済みChrome（詳細は下記）
- 影響分類: UI、application logic、data contract、Firestore Rules
- 製品受入れ判定: 依頼範囲のLocal試験成功。利用者の2026-09-06の指示により、アカウント権限に依存する追加UI試験を除き、起動済みLocal環境で作成・更新・削除と背景trigger transportを実測した。Dev受入れは別工程である
- 完了判定: SITE-08完了。追加修正、Chrome再試験、domain/Emulator、独立review、最終build、source commitと、利用者の明示承認後の生成物cleanup・不存在確認が成功した。Site進捗は95%とし、Dev受入れは未実施である
- 最終実装・build基準commit: `4c0ef8604e663cdc3773199f2b3adf62dd55cf50`。先行専用UI証拠の基準は`edb991ccaac4b15a5a8977260d80dbefc17d388b`

## 2026-09-06の追加Local確認

- 利用者が起動したChromeと会社管理者sessionを使用した。通常Localのproject namespaceは`air-guard-v2-dev`だが、Auth 9099、Firestore 8080、Functions 5001等がEmulator hubに登録され、Nuxtは`.env.local`のEmulator設定で起動していた。remote Devへ接続した証拠ではない。
- 利用者側Emulatorは`--import=./saved-data`で起動し、終了時export指定がないことをprocess command lineで確認した。Chrome、Nuxt、利用者Emulatorを停止せず、一時dataをexportしない。住所・郵便番号変更、外部通知等の経路は追加実行していない。
- 正規Chrome UIで請求対象OperationResultを1件作成し、Billingに同一実績が1回だけ追加された。Employeeを追加、休憩時間を変更、Employeeを削除し、それぞれBillingの従業員snapshotとSiteEmployeeHistory再構築をloopback backend assertionで確認した。最後に作成した実績をUIから削除し、Billingから当該実績だけが除去され、元の実績と履歴が残ることを確認した。
- SiteのCustomerを別の既存Customerへ変更し、元へ復元した。取極めの休憩を変更し、重複日付の保存拒否とdraft保持、新日付での複製保存と削除を確認した。これらの前後で既存OperationResultとBillingのdocument fieldsのSHA-256が同一であり、既存snapshotは不変だった。請求一覧・詳細でも元の休憩時間と請求内容を確認した。
- Site基本情報で必須名の空欄を拒否し、draftを保持した。旧documentの省略可能field欠損で備考更新までRulesに拒否される不具合を再現したため、missing-onlyの既定値とfield削除禁止へ修正した。対象fieldの型・相関検査、create必須field・actor/tenant条件は維持する。修正後に同じChromeから備考保存が成功し、reloadとbackendで保存を照合した。欠損sourceの一括補完は行っていない。
- 初回修正の`List.hasAll(Set)`はEmulator実評価で失敗し、成功扱いから除外した。最終修正は`removedKeys().size()==0`を用い、対象Site Rules 12件と全Emulator 171件が終了コード0で成功した。一部陰性caseの1000式警告は残り、当該caseは拒否/write 0の証拠であって個々のvalidation発火証明ではない。正常なSite更新経路は対象suiteとChromeで成功した。
- Site詳細から予定作成すると、preset現場名を表示しても取極め処理が「現場を指定してください」と拒否する問題を再現した。明示company/Site IDの取得へ修正し、Chromeで再選択なしの警備種別と定時取得、保存、reloadを確認した。予定日変更、別ACTIVE Siteへの変更と復元、過去日への変更、正規UIの上下番確定による実績化が成功した。生成実績は予定と同じID・Site・日付であり、予定の実績参照が設定された。共有helperを使う実績フォームでも定時取得が成功し、確認後は未保存で閉じた。
- 非請求実績削除時にBilling key生成が失敗し後続同期が止まり得る問題は、既存の[FUT-0046](../implementation/future-actions.md)である。今回変更していないtransaction全CRUDの受入れへ範囲を広げず、非請求削除を確認済みとはしない。完全なSite/Billing snapshot実装もADR 0052の別transaction工程に残る。

### 追加修正の検証とreview

| Gate | Command | Result | Exit |
|---|---|---|---:|
| Site Rules targeted | `powershell -ExecutionPolicy Bypass -File scripts/run-codex-local-test.ps1 -Mode Test -TestNamePattern 'Site Rules'` | 12 passed | 0 |
| reader targeted | `node --test test/domain/site-operation-read.test.mjs test/domain/site-read-authorization.test.mjs` | 36 passed | 0 |
| domain-full | `node --test test/domain/*.test.mjs` | 1155 passed、0 failed | 0 |
| local-emulator-suite | `npm run test:local` | 171 passed、0 failed、保存data不変 | 0 |
| project-docs-negative | `powershell -ExecutionPolicy Bypass -File scripts/test-project-docs-check.ps1` | 陰性fixtureを含め成功 | 0 |
| capacity-regression | `powershell -ExecutionPolicy Bypass -File scripts/test-codex-session-size.ps1` | 7 checks成功 | 0 |
| managed-governance | `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2` | managed hash・renderer・policy整合成功 | 0 |
| local-ui-build | `npm run test:local:ui:build` | 上記最終sourceのclean commitでNuxt 3.17.2 / Nitro 2.11.11 build成功 | 0 |
| project-docs | `powershell -ExecutionPolicy Bypass -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` | 最終closeout文書を含む244 Markdown・54 ADR・10 roadmap・8 TOML成功 | 0 |
| diff-check | `git diff --check` / `git diff --cached --check` | 既存・新規fileとcloseout文書の差分確認成功 | 0 |

Rulesの独立security reviewは欠損のみfallback、削除禁止、actor/tenant、派生値、wide Customer不変互換を確認し、最終差分に必須findingなし。UIの独立reviewとsecurity reviewは明示会社path、アクセス取消、応答失効、手入力保持を確認した。途中findingだったUserアクセス確認待ち中の警備種別上書きは`securityTypeBasis`と追加testで解消し、最終reviewは必須findingなしである。review baselineは先行commitから最終source commitへ入った差分、対象は今回のRules/test 3fileとUI/helper/test 5fileで、reviewer自身は実行検証をしていない。文書reviewでは検査対象外の未変更fieldまで不正値拒否を保証するような表現を限定した。

### 最終環境・保存状態

- 最終build identityは`demo-air-guard-v2-codex`、`externalEffects=deny`、上記source HEADを記録した。既知のBrowserslist、chunk size、sourcemap、Node package警告があり、buildエラーはない。利用者ChromeのUI証拠は同じ最終application sourceを通常Local Nuxtで操作したもので、今回generated serverの起動は行わない。
- 追加確認の前後で、利用者`saved-data`は7 files / 6,012,330 bytes / SHA-256 `7ED7F52F38117BF5CD600EDA7BB4BBF5925686DEF38246492F3B23B99808CF2E`、UI用`.codex-test/saved-data`は7 files / 3,492 bytes / `8882FA720E1637C8AA979A2446B8452DAE87AF549200F47FC5D60EBDF1C1C9CB`でそれぞれ一致した。指紋はFullName順のrelative path・length・file SHA-256をコロンで結び、LF結合したUTF-8のSHA-256である。先行記録とは集約方法が異なるため、その値との直接比較はしない。
- 専用全体testのruntime `test-harness-1204`と初回失敗の`test-harness-29132`は不存在を確認した。developerの対象試験runtimeもprocess不在確認後に限定cleanup済み。他taskのruntimeは変更していない。専用ports 14400/14500/14600/15001/18080/19000/19099/19199はLISTENなし。利用者の3000/8080/9099/5001は引き続きLISTENし、Chrome・Nuxt・Emulatorは停止していない。
- 作成した予定とその実績、備考・取極めの一時変更はrunning Emulatorにだけ残る。最初に作成した単独の試験実績とそのworkerはUIで削除した。保存fixtureへのexportはない。
- 最終build生成物.outputは230 files / 26,348,062 bytesだった。自動承認審査で一度保留した後、利用者の明示承認を受け、絶対pathと配下のreparse point不存在を再確認してRemove-Item -LiteralPathで限定削除した。command終了コード0、削除後Test-Path=falseを確認した。保存dataや利用者processは削除・停止していない。

影響分類は`ui-css-layout`・`application-logic`・`data-contract-schema-migration`・`project-guidance-metadata`の和集合とし、最終buildには`build-release-deploy`のcomprehensive gateも適用する。後続のreader/UI変更はFunctions、Rules、schema、Emulator設定・harness・検証対象writerを変更しないため、171件のEmulator結果を維持する。domainはreader最終修正後に再実行した。Dev/Prod generate・deploy・remote受入れは別工程で未実行。要件、保存shape、永続設計、一般運用は変更しないためspecification・data contract・ADR・manual・runbook・indexの追加更新は不要である。

## 先行確認の自動検証（基準commit時点）

| Gate | Command | Result | Exit |
|---|---|---|---:|
| targeted | `node --test test/domain/site-ui-read-state.test.mjs test/domain/site-ui-source-contract.test.mjs` | 31 passed、0 failed | 0 |
| domain-full | `node --test test/domain/*.test.mjs` | 1127 passed、0 failed | 0 |
| local-emulator-suite | `npm run test:local` | 166 passed、0 failed。loopback-only、saved data unchanged | 0 |
| local-ui-build | `npm run test:local:ui:build` | Nuxt 3.17.2 / Nitro 2.11.11、client・server build成功。既知のBrowserslist、chunk size、sourcemap、Node package警告のみ | 0 |

独立reviewで終了検索clear、ACTIVE一覧状態、郵便番号message、詳細action labelを補正した。後続reviewでは、権限取消後の既読詳細消去とAutocompleteの共有cache回帰を補正し、最新差分に指摘はなかった。Rules、Functions、schema、writer、非Site document writeへの追加拡大は検出されなかった。

## 先行専用環境のブラウザ受入れ（履歴）

操作証拠は可視controlへのpointer・keyboard操作だけを数えた。初回診断で使用した直接value設定は受入れ件数から除外し、その後のSite作成、archive、終了、再有効化、終了済み選択、権限切替を通常操作で再実施した。非UIのactor・環境準備とbackend assertionは別証拠である。

### Siteの正常系と失敗境界

- 会社管理者でCustomer未設定の仮Siteを作成し、`稼働中`、`仮登録`、`工期未設定`、取引先未設定fallbackを一覧・詳細で確認した。
- 誤登録archiveは警告とreason必須を経て成功し、live `Sites`は不存在、同ID `Sites_archive`は存在、詳細はnot-foundになった。
- 別の仮Siteを終了し、通常編集が消え、`終了済み`と再有効化入口が表示された。新工期とreasonで再有効化すると`稼働中`、工期、JST基準の自動終了予定が表示された。その後再度終了した。
- 終了検索は入力時だけ結果を表示し、終了・仮登録Chipと識別情報から詳細へ遷移できた。
- 予定作成のSite候補へTERMINATEDが残り、選択時に「終了済みのまま使用」確認を表示した。取消時は元の未選択値へ戻り、承認時はTERMINATEDのまま選択された。予定自体は保存せずdialogを閉じた。
- 郵便番号通信失敗時に手入力住所を保持する表示は診断中に観測したが、直接value設定を含むため厳密なUI証拠には数えない。専用buildの通信隔離と`site-postal-code-input`対象testで最新応答だけを反映し手入力を保持する契約を確認した。

### 権限別境界

| actor | ブラウザで確認した結果 |
|---|---|
| 会社管理者 | 作成、基本・Customer・取極め編集、終了・再有効化、archiveが利用可能 |
| `manager` / `controller` | strict preset由来の`sites:write`としてSite writeが利用可能。controllerでは予定・稼働実績・配置の既存入口も表示 |
| `accountant` | Site readは可能、作成・基本・Customer・取極め・archiveは非表示、終了はdisabled。請求一覧・Customer/Site filterは利用可能 |
| 直接`sites:write` | readは現行client互換として維持するが、Site master writeは非表示またはdisabled |
| 未知role | Site menuとwrite操作を表示しない。読込み済み同一tenant詳細はRulesの既存read契約に従い閲覧のみ |
| temporary / disabled | actor切替直後にSite menuとwrite操作が消え、切替前に読込済みのSite詳細も即時消去してnot-found表示へ移ることを確認。actor復元後は詳細を再取得した |
| 非管理者SuperUser + `manager` | Site一覧・詳細のreadを維持しつつ、作成・基本・Customer・取極め・archiveは非表示、終了はdisabled |
| 別tenant `manager` | 自tenantの合成Siteだけを一覧表示。Tenant Aの既知Site IDを開いてもnot-foundで、Tenant Aの内容は表示されない |

非管理者SuperUserと別tenantは、保存fixtureへaccountを追加せず、同じ合成Auth UIDのclaims・Userを稼働中Emulatorだけで切り替え、可視sign-out/sign-inによりtokenを更新した。Rulesの同一tenant read、cross-tenant get/list/write拒否、非管理者SuperUserのSite write・Callable拒否とwrite 0は`local-emulator-suite`の実測に含まれる。UIはclaims先tenantのpathだけを組み立てるため、別tenantからTenant Aへwriteする製品controlは存在せず、強制操作は行っていない。

### 既存機能の確認済み範囲

- `/operation-schedules`: controllerで当月一覧と作成入口を表示し、Site・警備種別を選択して取極めから09:00〜18:00を設定した予定を保存した。再import後も同じ1件とSite参照を確認した。
- `/operation-results`: controllerで当月一覧、Customer/Site filter、作成入口を表示し、同じSite・警備種別・09:00〜18:00の実績を保存した。再import後も同じ1件、Site参照、時刻を確認した。ADR 0052が将来契約とする完全なSite snapshotの実装・確認を示す証拠ではない。
- `/arrangements-manager`: 合成Employeeを正規UIで作成し、可視drag操作で予定へ仮配置した。可視通知操作で`ARRANGED`、status編集で`CONFIRMED`へ更新し、日別集計、Schedule worker、ArrangementNotificationのSite・Schedule参照をbackendで照合した。
- `/billings/operations`: accountantで当月一覧、Customer/Site filter、請求menuを表示し、Site writeがないことを確認した。請求は作成・変更していない。

通常Functions入口は`onOperationResultChange`を公開し、OperationResultの作成・更新・削除からBilling、DailyAttendances、DailyOperationsByEmployee、SiteEmployeeHistoriesを同期する。一方、今回の`firebase.codex-test.json`はCallableだけを公開する`functions/codex-test`をsourceにするため背景triggerを登録せず、UIで保存したOperationResultから4つの後続処理は発火していない。これは製品triggerの障害を示すものではなく、外部作用を隔離した検証構成の制約である。

Site改修で追加した境界は、新規作成またはSite変更時のlive Site確認と、予定のsite/date・実績化競合である。無関係なfieldの通常更新、read、deleteの実装は変更していないため、Site統合確認を各下流機能の全CRUD受入れへ拡大しない。変更境界の許可・拒否と既存更新・read・delete互換は同じHEADのdomain/Emulator testで確認した。UI削除は利用者離席中に実行時確認を得られないため実施していない。一方、4つの後続処理のうち、Billing・SiteEmployeeHistory writerはlive Site確認を追加した直接影響箇所であり、専用Local entrypointにtrigger transportがないため、限定Local確認または自動test代替の利用者承認までは未完として残す。

## 先行確認時の現場ドキュメント以外の読み書き比較（履歴）

| 対象 | 改修前 | 改修後 | SITE-08確認 |
|---|---|---|---|
| `SiteOperationSchedules` | 予定CRUD・実績化で参照・更新 | create、site/date変更、実績化でlive Site/revisionを追加確認。通常deleteは維持 | 正規UIで予定を作成し、Site参照、取極め由来の時間、再import後の1件を確認。対象Rules/transaction test成功 |
| `OperationResults` | 実績CRUDで参照・更新し、作成時の取極め等を保持 | createまたはsiteId変更時だけlive Siteを追加確認。既存snapshotはSite・取極め変更で更新しない | 正規UIで実績を作成し、Site参照、時刻、再import後の1件を確認。既存取極め等のsnapshot不変testは成功したが、完全なSite snapshotは未実装・未検証 |
| `ArrangementNotifications` | 通知CRUDで参照・更新 | createまたはsiteId変更時だけlive Siteを追加確認。通常更新・deleteは維持 | 正規UIで仮配置、通知、確認済み更新を行い、`ARRANGED`→`CONFIRMED`、Site・Schedule参照、日別集計を確認。Rules test成功 |
| `Billings` | 請求CRUDで参照・更新 | createまたはsiteId変更時にlive Siteを追加確認し、新規初期化は同一transactionでSiteを読む。既存非Site field更新・delete・readは維持 | accountantの一覧・filterをブラウザ確認。Rules/server-writer unit・Emulator test成功。OperationResult背景trigger transportとBilling writeは実UI未検証 |
| `SiteEmployeeHistories` | 実績を読み履歴を再構築 | 再構築時に実績とlive Siteを確認。実績0件cleanupは維持 | server-writer unit・Emulator test成功。OperationResult背景trigger transportと履歴writeは実UI未検証 |
| `System` / `Users` | 各処理に応じて参照 | Site Callableのmaintenance・strict actor判定で追加read | product writeなし。UI受入れ用にrunning Emulatorの`System/system`と合成User/claimsだけを一時設定し、exportせず停止で破棄 |
| `Employees` | Employee作成・更新 | Site改修による変更なし | 配置確認用の合成Employee 1件を正規UIで作成。位置情報は専用Functionsにgeocodingがない既知Local制約によりnullだが、Employee保存は成功 |
| その他 | 各既存機能の契約 | SITE-07はCustomer未設定時の不要なCustomer readを停止し、非Site document writeを追加しない | Customer、Storage、勤怠等への追加browser business writeなし |

`DailyAttendances`と`DailyOperationsByEmployee`はOperationResult由来の下流snapshotで、archive対象・書込み対象に追加していない。Site取極め変更が既存OperationResultへ影響しないことは仕様どおりである。remote legacy shapeはSITE-09 preflightまで未確認である。

## 先行専用環境の保存差分・cleanup（履歴）

- 初回Site作成失敗は保存fixtureに`System/system`がなく、SITE-04で追加したmaintenance Rulesがfail closedになったことが原因だった。製品回帰ではない。受入れではrunning Emulatorだけに`isMaintenance=false`を設定した。保存fixtureの更新・昇格は別判断とする。
- UI product writeはSite 2件の作成、1件のarchive、もう1件の終了・再有効化・再終了に加え、Schedule 1件、OperationResult 1件、配置確認用Employee 1件、Schedule worker 1件、ArrangementNotification 1件の作成と通知status更新だった。すべて稼働中Emulator内だけで行い、canonical `.codex-test/saved-data`へはexportしなかった。Schedule・OperationResultを含むtask固有runtime checkpointへ一時保存・再importし、最終確認後にcheckpointを削除した。
- 非UI setup writeはrunning Emulatorの`System/system`、合成User/claims、actor確認用Company/Siteだけで、remoteへ送らずexportもしなかった。Emulator停止により破棄された。
- `.codex-test/saved-data`は最終実行前後とも7 files、3492 bytes、同一aggregate SHA-256 `BBE262EA450AE626E3E4D832ABADBC3B42511D575EC6F667C78463B1BE4316E0`だった。利用者側`saved-data`も7 files、同一aggregate SHA-256 `BBE681DA9A6C6495519A04788C2092754CD89EEEE4C428A15DF668B395FF1E04`で不変だった。
- 専用server/Emulatorを停止し、対象portsはLISTEN 0件である。task固有runtime `site08-live-restart-20260905`は対象path・非reparse・7 filesを確認して削除した。他のruntimeと保存dataは削除していない。
- 生成済み`.output`はworkspace内の通常directoryでlinkではないことを確認したが、再帰削除は安全審査で利用者の明示承認が必要とされたため残置している。
- browser consoleではEmployee住所保存時に`[ClientGeocoding] FirebaseError: internal`を1件観測した。Codex専用Functionsがgeocodingをexportしない既知Local制約で、Employee document保存と配置確認は成功しており、Site差分の回帰とは判定しない。

## SITE-09へ進む前の停止条件

- SITE-08の生成物cleanupは利用者の明示承認後に実行・不存在確認を完了した。背景trigger確認方法の判断待ちも、利用者指示と通常Localでの実測により解消した。
- Dev/remote接続前に、既存予定の`operationResultId`・日付field、既存archive、取極め、下流snapshot、必要indexのshapeをread-onlyで確認する。
- 競合、legacy欠損、active/archive同ID等があればdeploy・migrationを有効化せず、対象件数、backup、dry-run、post-check、rollbackを示して別承認へ止める。
- SITE-09のDev反映・remote/data確認は別承認であり、本記録では実施していない。
