# SITE-08 Codex専用local統合確認記録

## 対象と現在判定

- 対象: SITE-01からSITE-07までのSite改修と、直接・間接に影響した既存機能のlocal統合確認
- 環境: `demo-air-guard-v2-codex`、loopback、保存済み合成account・合成data、Codexインアプリブラウザ
- 影響分類: UI、application logic、data contract、Firestore Rules
- 製品受入れ判定: 未完。Site lifecycle、archive、終了済み選択、権限別表示と、予定・稼働実績・請求・配置画面の読取り入口までは確認した
- 完了判定: 影響した非Site業務documentの代表的な正規UI write・update・deleteとbackend差分、temporary/disabledへの切替時の既読詳細消去、一時runtime cleanupが残る。Dev、Prod、remote、実dataは未接続・未変更
- 実装・受入れ基準commit: `e5a0adc4b62c286f30a590e8a9944ba6be850fa3`

## 自動検証

| Gate | Command | Result | Exit |
|---|---|---|---:|
| targeted | `node --test test/domain/site-ui-read-state.test.mjs test/domain/site-ui-presentation.test.mjs test/domain/site-postal-code-input.test.mjs test/domain/site-ui-source-contract.test.mjs test/domain/site-lifecycle-ui-source-contract.test.mjs` | 43 passed、0 failed | 0 |
| domain-full | `node --test test/domain/*.test.mjs` | 1114 passed、0 failed | 0 |
| local-emulator-suite | `npm run test:local` | 166 passed、0 failed。loopback-only、saved data unchanged | 0 |
| local-ui-build | `npm run test:local:ui:build` | Nuxt 3.17.2 / Nitro 2.11.11、client 1311 modules、server build成功。既知のBrowserslist、chunk size、sourcemap、Node package警告のみ | 0 |

独立reviewで終了検索clear、ACTIVE一覧状態、郵便番号message、詳細action labelの問題を検出し、修正後に対象・全domain・Emulatorを再検証した。Rules、Functions、schema、writer、非Site document writeへの未承認の拡大は検出されなかった。

## ブラウザ受入れ

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
| temporary / disabled | Site menuとwrite操作は消えるが、切替前に読込済みの詳細が残った。切替後の新規readはRulesが拒否するものの、既読表示を即時消去しないため修正・再検証対象 |
| 非管理者SuperUser + `manager` | Site一覧・詳細のreadを維持しつつ、作成・基本・Customer・取極め・archiveは非表示、終了はdisabled |
| 別tenant `manager` | 自tenantの合成Siteだけを一覧表示。Tenant Aの既知Site IDを開いてもnot-foundで、Tenant Aの内容は表示されない |

非管理者SuperUserと別tenantは、保存fixtureへaccountを追加せず、同じ合成Auth UIDのclaims・Userを稼働中Emulatorだけで切り替え、可視sign-out/sign-inによりtokenを更新した。Rulesの同一tenant read、cross-tenant get/list/write拒否、非管理者SuperUserのSite write・Callable拒否とwrite 0は`local-emulator-suite`の実測に含まれる。UIはclaims先tenantのpathだけを組み立てるため、別tenantからTenant Aへwriteする製品controlは存在せず、強制操作は行っていない。

### 既存機能の確認済み範囲

- `/operation-schedules`: controllerで当月一覧と作成入口を表示し、終了Siteが確認付き候補として利用できることを確認した。予定は保存していない。
- `/operation-results`: controllerで当月一覧、Customer/Site filter、作成入口を表示した。実績は作成・変更していない。
- `/arrangements-manager`: controllerで14日grid、日別集計・状態行を表示した。配置通知は作成・変更していない。
- `/billings/operations`: accountantで当月一覧、Customer/Site filter、請求menuを表示し、Site writeがないことを確認した。請求は作成・変更していない。

この結果は、既存の一覧・filter・dialog入口と参照表示が提供されることだけを示す。非Site業務documentのwrite・update・deleteはブラウザ未実施であり、同じまたは同等の機能が提供されるという最終判定には使わない。Site参照barrierの詳細な許可・拒否は同じHEADのEmulator testで確認済みだが、ブラウザ操作の代替にはしない。

## 現場ドキュメント以外の読み書き比較

| 対象 | 改修前 | 改修後 | SITE-08確認 |
|---|---|---|---|
| `SiteOperationSchedules` | 予定CRUD・実績化で参照・更新 | create、site/date変更、実績化でlive Site/revisionを追加確認。通常deleteは維持 | 一覧・作成dialog・終了Siteの確認付き選択をブラウザ確認。予定writeなし。対象Rules/transaction test成功 |
| `OperationResults` | 実績CRUDで参照・更新し、作成時の取極め等を保持 | createまたはsiteId変更時だけlive Siteを追加確認。既存snapshotはSite・取極め変更で更新しない | 一覧・filter・作成入口をブラウザ確認。実績writeなし。snapshot不変test成功 |
| `ArrangementNotifications` | 通知CRUDで参照・更新 | createまたはsiteId変更時だけlive Siteを追加確認。通常更新・deleteは維持 | 配置managerの既存grid・集計表示をブラウザ確認。通知writeなし。Rules test成功 |
| `Billings` | 請求CRUDで参照・更新 | createまたはsiteId変更時にlive Siteを追加確認し、新規初期化は同一transactionでSiteを読む。既存非Site field更新・delete・readは維持 | accountantの一覧・filterをブラウザ確認。Billing writeなし。Rules/Callable test成功 |
| `SiteEmployeeHistories` | 実績を読み履歴を再構築 | 再構築時に実績とlive Siteを確認。実績0件cleanupは維持 | browser writeなし。Emulator test成功 |
| `System` / `Users` | 各処理に応じて参照 | Site Callableのmaintenance・strict actor判定で追加read | product writeなし。UI受入れ用にrunning Emulatorの`System/system`と合成User/claimsだけを一時設定し、exportせず停止で破棄 |
| その他 | 各既存機能の契約 | SITE-07はCustomer未設定時の不要なCustomer readを停止し、非Site document writeを追加しない | Customer、Storage、勤怠、通知、請求、実績、予定、配置へのbrowser business writeなし |

`DailyAttendances`と`DailyOperationsByEmployee`はOperationResult由来の下流snapshotで、archive対象・書込み対象に追加していない。Site取極め変更が既存OperationResultへ影響しないことは仕様どおりである。remote legacy shapeはSITE-09 preflightまで未確認である。

## 環境、保存差分、cleanup

- 初回Site作成失敗は保存fixtureに`System/system`がなく、SITE-04で追加したmaintenance Rulesがfail closedになったことが原因だった。製品回帰ではない。受入れではrunning Emulatorだけに`isMaintenance=false`を設定した。保存fixtureの更新・昇格は別判断とする。
- UI product writeはSite 2件の作成、1件のarchive、もう1件の終了・再有効化・再終了だけだった。非Site業務document writeはなかった。
- 非UI setup writeはrunning Emulatorの`System/system`、合成User/claims、actor確認用Company/Siteだけで、remoteへ送らずexportもしなかった。Emulator停止により破棄された。
- `.codex-test/saved-data`は実行前後とも7 files、同一aggregate SHA-256 `c8c7bed285f9c7c9e1fb9942f84cba63994d9e183502401d6365c53aef728ca4`だった。
- クラッシュ後の再開確認で専用server/Emulator portsはLISTEN 0件、worktreeはcleanだった。
- 生成済み`.output`はworkspace内の通常directoryでlinkではないことを確認したが、再帰削除は安全審査で利用者の明示承認が必要とされたため残置している。

## SITE-09へ進む前の停止条件

- Site専用のtemporary/disabled既読詳細消去を修正し、権限切替を再確認する。
- 予定、稼働実績、請求、配置通知について代表的な正規UI write・update・deleteとbackend保存差分・不変を確認する。
- SITE-08の`.output` cleanupと文書・Git統合を完了する。
- Dev/remote接続前に、既存予定の`operationResultId`・日付field、既存archive、取極め、下流snapshot、必要indexのshapeをread-onlyで確認する。
- 競合、legacy欠損、active/archive同ID等があればdeploy・migrationを有効化せず、対象件数、backup、dry-run、post-check、rollbackを示して別承認へ止める。
- SITE-09のDev反映・remote/data確認は別承認であり、本記録では実施していない。
