# AirGuardV2 正式運用準備ロードマップ

- 目標: 試験運用の知見を反映し、テナント分離、主要業務、復旧可能性、利用者受入れを検証したうえで正式運用へ移行できる状態にする。
- この進捗の100%が表す範囲: 正式運用開始の承認準備完了。以後の継続改善や新機能完了を意味しない。
- 現在の進捗: 10%
- 最終確認日: 2026-08-17
- 承認境界: 重要仕様変更、実データ操作、Firebaseデプロイ、データ移行、外部サービス変更、Git push、正式運用開始は利用者の明示的承認を必要とする。

## マイルストーン

| マイルストーン | 重み | 得点 | 状態 | 完了証拠と残作業 |
|---|---:|---:|---|---|
| ガバナンスと現行仕様の基準線 | 10 | 10 | Completed（完了） | 下記 G1～G5 の全ゲートを満たした。 |
| 主要業務とデータ整合性 | 25 | 0 | In progress（進行中） | schemaとFunctionsの静的レビューでlock、Billing、勤怠・履歴同期、rounding、snapshotの問題を確認した。修正、Emulator、回帰test、試験運用照合が未完了。 |
| 認証・認可・テナント分離 | 20 | 0 | Verification required（要検証） | User更新Auth同期、有効化・無効化Callable、会社管理者移譲、一般User本登録、初期管理者signupのactor/company/identity境界を修正した。Firestore・Storage Rulesはverified email、正常な会社claim、tenant path、有効な本登録Userを要求し、恒久的なsuper-user全会社bypassを廃止した。Auth/User会社整合性helperは`isSuperUser`のbooleanを必須化し、管理SDKでEmulator・Devの既存所属アカウントを検証した。全10 Callableを`functions/apis`の公開indexへ整理し、Auth削除処理をtriggerへ分離した。会社所属済み6 Callableを共通Auth identity gateへ統一した。UWB-01で単独／Employee連携User、`users:write`、仮登録管理actor、段階的な改修順を確定した。専用Emulator suite 71件、全domain単体test 226件、初期管理者を含むChrome flowで検証した。UWBの実装、Users Rulesのfield/actor制約、App Check、Dev・remoteのアプリflow検証は未完了で、deploy不可。 |
| 運用信頼性と外部連携 | 15 | 0 | Verification required（要検証） | 通知、Storage、派生同期、Admin backup/restoreを静的レビューした。Stripe、監視、復旧演習、依存関係脆弱性、実環境検証が未完了。 |
| 利用者受入れと業務マニュアル | 15 | 0 | In progress（進行中） | 共通UI sourceでlock/disabled、validation、非同期race、date-time、accessibilityの問題を確認した。browser test、修正、利用者確認、manual整合が未完了。 |
| 正式運用移行判定 | 15 | 0 | Not started（未着手） | SLA、保持期間、監視・障害対応基準、移行・ロールバック、正式運用開始承認を確定する。 |
| **合計** | **100** | **10** |  |  |

部分加点は行わない。各マイルストーンの完了条件をすべて満たした時点で、その重み全体を得点する。

## 調査証拠の進捗（正式運用準備スコアとは別）

- 主repoの531-file deep reviewは、A 310件から519件へ増加した。B/C残数は209件から0件へ減少し、予定したsource本文精査を完了した。D 11件とE 1件は分類済みのtest/config/asset・外部境界であり、runtime検証済みという意味ではない。
- schema runtime 76 paths、共通UI runtime 43 paths、Admin SDK runtime 14 pathsを、主repo母数とは別のpackage境界として静的レビューした。
- 利用者用local環境から分離したCodex専用Emulator seedとAuth・Firestore・Storage Rules・再構築Callable・全会社メール重複確認Callable handlerの51件のtestを追加した。全Companies collectionとSecurityReports fileのtenant identity gate、恒久的なsuper-user bypass廃止、SecurityReportIndexes・StripeDataの個別操作制約、再構築実行者の現在Auth/User整合性、全会社メール重複確認の会社管理者境界を確認した。Chromeからlocal EmulatorへのFunctions transportは再構築2件とUser有効化・無効化の4件を実測した。残るFunctions transport、Realtime Database Rules、外部サービスの回帰testは未完了であり、公式進捗は加点しない。
- 調査完了は問題の特定証拠であり、修正、test、運用受入れの完了証拠ではない。そのため公式進捗は10%のままとする。
- 詳細な問題、台帳対応、要判断事項は[2026-08-12 source review統合記録](../implementation/review-reconciliation-2026-08-12.md)を参照する。

### ガバナンス基準線の完了ゲート

- [x] G1: 必須成果物（作業規則、文書案内、現行仕様、ロードマップ、ADR索引、運用手順、開始プロンプト、変更履歴、専門エージェント設定）が存在し、索引から到達できる。
- [x] G2: `.codex/config.toml` と全専門エージェントTOMLを正式なTOMLパーサーで解析し、必須キー、型、エージェント名、sandbox modeを検証できる。
- [x] G3: Markdown相対リンク、GitHub互換見出しアンカー、重要文書の索引到達性を機械検証できる。
- [x] G4: ADR本文と索引の状態、ロードマップの重み、得点、無部分加点、索引進捗を機械検証できる。
- [x] G5: 独立レビューの指摘を反映し、ガバナンス検証、陰性試験、PowerShell構文確認、`git diff --check` が成功する。

## 次の作業

1. Auth claim・tenant path・User状態の認可整合性を最優先で継続する。Firestore・Storage Rules、会社所属済み6 Callableの共通Auth identity gate、一般User本登録、初期管理者signupの専用guard、UWB-01〜03は実装・local検証済みである。次はUWB-04で単独／Employee連携の仮登録User作成をserver境界へ移し、UWB-07で本登録Userの利用停止・退職・削除についてarchive、UID参照、削除条件、監査・復旧を具体例から確定してから、Users Rulesのfield/actor制約を閉じる。続いてApp Check・rate limitとDev受入れへ進む。将来の他社support accessは明示的な開始・終了手続きを持つ別機能として設計する。このgate全体の完了までdeployしない。
2. OperationResultの管制側編集lockと権限境界をRules・model・UIで強制する修正案を作り、Billing/勤怠/履歴同期、rounding、notificationの回帰testとreconcile設計を確定する。
3. Admin backup/restoreの正式scope、RPO/RTO、operator、artifact保護、復旧演習条件について利用者判断を得る。
4. 共通UIのdisabled強制、single-flight、draft conflict、非同期latest-wins、date-time/accessibilityをtest可能な契約へ整理する。
5. ルートアプリとCloud Functionsの依存関係脆弱性を、破壊的な自動修正を行わず調査する。

## 成果物と検証証拠

| マイルストーン | 設計・判断 | 実装 | テスト・レビュー・環境受入れ |
|---|---|---|---|
| ガバナンスと現行仕様 | [ADR 0001](../decisions/0001-governance-and-specification-source.md)、[ADR 0011](../decisions/0011-roadmap-and-codex-session-lifecycle.md)、[ADR 0013](../decisions/0013-managed-governance-reconstruction.md) | 文書・`.codex/` 設定 | `scripts/check-project-docs.ps1`、`scripts/check-governance.ps1` |
| 主要業務とデータ整合性 | [ADR 0003](../decisions/0003-operation-result-billing-integrity.md)、[現行仕様](../specification.md) | 関連画面、モデル、Functions | 関連テスト、試験運用受入れ（未完了） |
| 認証・認可・テナント分離 | [ADR 0002](../decisions/0002-multitenant-firebase-architecture.md)、[ADR 0014](../decisions/0014-codex-dedicated-local-test-data.md)、[ADR 0016](../decisions/0016-firemodel-crud-boundary.md)、[ADR 0017](../decisions/0017-callable-auth-identity-gate.md)、[ADR 0018](../decisions/0018-user-provisioning-and-employee-link-boundary.md) | Rules、認証・管理者処理、Codex専用local基盤 | セキュリティレビュー、専用local suite 72件、全domain単体test 226件。一般Userと初期管理者はlocal Emulatorの合成UserでAuth作成、メール確認、Callable、claim反映、dashboard到達を確認済み。Codex専用UIの最小経路も専用Functions、合成account、Codex管理ブラウザ、cleanupまで確認済み。全10 Callableの正式API export、内部helper非公開、管理者会社作成のCompany・User・claim整合と再実行を確認済み。会社所属済み6 Callableは共通Auth identity gateへ統一済み。UWB-01契約は確定したが実装、Users Rulesのfield/actor制約、App Check、Dev・remote受入れは未完了 |
| 運用信頼性と外部連携 | [運用・開発手順](../operations.md) | 通知、Storage、Stripe、バックアップ設定 | 障害経路・復旧確認（未完了） |
| 利用者受入れとマニュアル | [画面マニュアル](../manual/index.md) | 対象画面 | 認証済みUI検証、利用者確認（未完了） |
| 正式運用移行判定 | [現行仕様](../specification.md) | 未確定 | 移行・復旧演習、利用者承認（未完了） |

## 未解決問題

- invitation/account setup、User documentとglobal Auth UID、匿名signup Callableのabuse防止、同一tenant内field権限。
- OperationResultの管制側編集lock・権限強制、agreementなしresult、Billing status、請求書snapshot、同時更新、勤怠・履歴・report indexの部分失敗と再構築。
- FireModelのprocess-global context、full-set/upsert、serialization、validation、client/server adapter差。
- 通知の重複、FCM token lifecycle/log、ArrangementNotification日時・状態遷移。
- UI managerのdisable非強制、二重送信、draft競合、入力debounce、非同期stale response、date-time、accessibility。
- Admin backup/restoreのcoverage、平文artifact/credential、operator権限、監査、rollback/resume、migration例外。
- npm依存関係の脆弱性と互換性を保つ更新方法。
- Stripe本番運用、キャンセル、プラン、従業員数制限。
- remote/Emulator/browser/real dataによる検証、監視、SLA、保持期間、復旧目標、試験運用受入れ証拠。

## 要判断事項

1. 正式なrole・permission matrixと、管理Callable・super-user・developerのactor/tenant境界。super-userの他社support accessについて、対象会社、同意、許可範囲、有効期限、再認証、監査、終了・取消を含む手続きを確定する。
2. 招待本人の証明方法、verification前操作、取消・再送・部分状態の回復手順。
3. 請求書発行後の訂正・取消・管理者修復、およびAdmin migration例外。OperationResultの`isLocked`は請求確定とは分離し、`operation-billings:write`による設定・解除と請求編集を許可する方針で確定済み。
4. 正式backup対象、復旧時点、RPO/RTO、artifact保護、operator承認・監査・drill。
5. 個人・勤怠・請求・通知・backupの閲覧者、log、保持、匿名化、削除。
6. trigger/callable/scheduled処理のretry、重複防止、部分成功、manual replay、SLO。
7. 編集競合、error/loading、date-time入力、外部住所lookup、accessibilityの共通UX基準。

## 完了条件

- 全マイルストーンが完了し、合計100点である。
- 仕様、ADR、実装、テスト、マニュアル、運用手順、変更履歴が一致する。
- テナント分離と主要な失敗経路が独立レビューされている。
- 移行・復旧方法と正式運用条件を利用者が明示的に承認している。

## 進捗履歴

| 日付 | 進捗 | 変化 | 理由と証拠 |
|---|---:|---:|---|
| 2026-08-10 | 10% | 基準線 | 既存ガバナンス、現行仕様、ADR、運用手順を確認し、正式運用準備を100点の加重マイルストーンとして新規設定した。 |
| 2026-08-12 | 10% | 0 | 主repoのdeep reviewを310/531から519/531へ進め、B/Cを0として予定したsource本文精査を完了した。schema、components、composables、PDF/CSV/utils/service、共通UI、Admin SDK、認証・Functionsの問題を台帳化した。各未完了マイルストーンは修正・test・運用受入れの全ゲートを満たしていないため、無部分加点規則により公式進捗は据え置いた。 |
| 2026-08-12 | 10% | 0 | 利用者用local環境から分離したCodex専用Emulator seed、容量・指紋ガード、Auth・Firestore Rulesの4件の基盤testを追加した。未完了マイルストーンの回帰・受入れ条件は満たしていないため進捗は据え置いた。 |
| 2026-08-13 | 10% | 0 | OperationResultの`isLocked`を請求確定から分離し、管制側編集保護、機能権限、理由入力・承認・新規履歴collectionを要求しない契約を確定した。文書整合のみで実装・Rules・回帰testは未完了のため進捗は据え置いた。 |
| 2026-08-14 | 10% | 0 | application codeを利用者主導へ戻し、Codexを設計・review・検証・document・local Git管理へ集中させた。認証改善を最小segmentで進める統治を確定したが、製品修正・回帰test・環境受入れは未実施のため進捗は据え置いた。 |
| 2026-08-14 | 10% | 0 | User更新時のAuth同期を新規policy・use-caseへ分離し、Firestore path、User company、Auth UID、Auth company claimの不一致をAuth更新前に拒否するよう改修した。Firebase非接続の単体test 27件は成功したが、Emulator、既存data、他の認証・Rules境界、運用受入れが未完了のため進捗は据え置いた。 |
| 2026-08-14 | 10% | 0 | User有効化・無効化をactor company起点のFirestore transactionへ変更し、有効な本登録会社管理者、別UIDの本登録非管理者target、Auth UID/company claimを更新前に検証するよう改修した。認証単体test 75件は成功したが、管理者移譲等の残存問題、Emulator、既存data、運用受入れが未完了のため進捗は据え置いた。 |
| 2026-08-15 | 10% | 0 | 会社管理者移譲をactor本人かつ同社の唯一の有効な本登録管理者に限定し、移譲元・移譲先のUser/Auth整合性、管理者数、無効・仮登録状態を同一Firestore transactionの更新前に検証するよう改修した。認証関連単体test 151件と4ファイルの構文検査は成功したが、Functions依存packageを使う実import、Emulator、既存data、Rules、運用受入れが未完了のため進捗は据え置いた。 |
| 2026-08-15 | 10% | 0 | 一般User本登録のverified email、一意仮登録、path/company一致、client指定ID非信頼をpolicy/use-caseへ分離し、安全なerror mappingと仮User削除時のAuth削除抑止を追加した。認証関連単体test 193件は成功したが、既存Callable/client flowへの接続、部分状態回復、Rules、rate limit、Emulator/remote受入れは未完了のため進捗は据え置いた。 |
| 2026-08-15 | 10% | 0 | 一般User本登録を既存Callableとメール確認後client flowへ接続し、client指定会社ID・仮User IDを廃止した。全domain単体test 200件と4実装fileの構文・SFC検査は成功した。Auth claim・tenant path・User状態の認可整合性、Rules、Storage、Emulator/remote受入れが未完了でdeploy不可のため、進捗は据え置いた。 |
| 2026-08-15 | 10% | 0 | 一般User本登録のclient flowをlocal Emulatorの合成Userで検証し、明示import漏れと、メール確認済み・会社claim未設定Userをglobal middlewareがdashboardへ早期転送する問題を修正した。全domain単体test 201件、構文・SFC検査、仮登録照合、Auth作成、メール確認、本登録Callable、company claim反映、dashboard再読込みが成功した。認可整合性とRules等のrelease blockerが残るため進捗は据え置いた。 |
| 2026-08-15 | 10% | 0 | Firestore Rulesへverified email、正常なcompany claim、tenant path、有効な本登録Userの整合性gateを追加し、恒久的なsuper-user全会社bypassを廃止した。専用loopback Emulator 32件で全Companies collectionの同一tenant操作・他tenant拒否とSecurityReportIndexes・StripeDataの個別制約を確認した。Storage・Callable・remote受入れが未完了のため進捗は据え置いた。 |
| 2026-08-15 | 10% | 0 | Storage RulesのSecurityReportsをverified email、正常なcompany claim、tenant path、有効な本登録Userが整合する場合だけ許可した。専用loopback Emulator 39件でupload、list、metadata、download URL、byte download、delete、他tenant・不正identity拒否を確認した。画像圧縮・Vue画面・thumbnail Functions、IAM、Dev・remote受入れ、Callableが未完了のため進捗は据え置いた。 |
| 2026-08-15 | 10% | 0 | スーパーユーザー向けの履歴・警備日報インデックス再構築Callableを、ID token、現在のAuthentication User、同社の有効な本登録User、要求会社がすべて整合する場合だけ許可した。Auth無効・User無効・他社指定等を含む専用loopback Emulator 46件と全domain単体test 201件が成功した。残る管理・signup Callable、Functions transport、Dev・remote受入れが未完了のため進捗は据え置いた。 |
| 2026-08-15 | 10% | 0 | 全会社メール重複確認Callableを、有効な同社会社管理者だけに限定した。公開Callableと再構築Callableを`functions/apis`の単体ファイルへ分離し、共有再構築認可はAPI indexから非公開とした。正式なAPI index経由の専用loopback Emulator 51件、全domain単体test 201件、両validatorが成功した。残るsignup Callable、App Check・rate limit、Functions transport、Dev・remote受入れが未完了のため進捗は据え置いた。 |
| 2026-08-15 | 10% | 0 | signup用`checkEmailAvailability`を`functions/apis`の単体ファイルへ移し、公開名と既存挙動を維持した。正式なAPI index経由で入力型、Authentication重複、管理者登録時の全会社User重複、一般User登録時の仮User有無を含む専用loopback Emulator 55件と全domain単体test 201件が成功した。未認証入口、caller指定`isAdmin`、App Check・rate limit、Functions transport、Dev・remote受入れが未完了のため進捗は据え置いた。 |
| 2026-08-15 | 10% | 0 | `auth-v2.js`に残る全Callableを`functions/apis`へ移し、Auth削除処理を`functions/triggers/auth.js`へ分離した。公開Function名と既存挙動を維持し、正式API indexの10 Callable、内部helper非公開、仮登録検索、管理者会社作成、各入口guardを専用loopback Emulator 60件、全domain単体test 201件、functions entry実importで確認した。認可改善ではないため残存guard、Functions transport、Dev・remote受入れは未完了で、進捗は据え置いた。 |
| 2026-08-16 | 10% | 0 | 認証済みChromeからlocal Emulatorへ接続し、履歴・警備日報index再構築、非管理者Userの無効化・再有効化の4 CallableについてFunctions transportと画面反映を確認した。dashboard復帰後も認証を維持し、console errorは0件だった。残るCallable transport、匿名signup情報境界、App Check・rate limit、Dev・remote受入れが未完了のため進捗は据え置いた。 |
| 2026-08-16 | 10% | 0 | 未認証の事前登録確認応答をbooleanだけへ縮小し、会社ID・表示名・role・仮User IDの公開を廃止した。複数仮登録を拒否し、signup画面もbooleanだけを保持する。専用loopback Emulator 61件、全domain単体test 202件、SFC・構文検査が成功した。存在有無の列挙、App Check・rate limit、招待token、残る匿名Callable境界が未完了のため進捗は据え置いた。 |
| 2026-08-16 | 10% | 0 | `checkEmailAvailability`を初期会社管理者signup専用へ限定し、client指定`isAdmin`を廃止してemailだけでAuthと全会社Userを確認するよう変更した。一般User signupは当該Callableを使用しない。専用loopback Emulator 61件、全domain単体test 207件、SFC・構文検査が成功した。非atomicな競合・Auth-only部分状態、`createAdminAccount`の既存所属・再実行guard、email列挙、App Check・rate limit、Dev・remote受入れが未完了のため進捗は据え置いた。 |
| 2026-08-16 | 10% | 0 | `createAdminAccount`をメール確認済み・有効な未所属Authへ限定し、token/current Auth、既存User/Company、company claim、`isSuperUser`を検証した。claims失敗後の整合した既存Company/Userを再利用して重複Companyを防ぎ、管理者setupをメール確認後へ移した。専用local suite 67件、全domain単体test 212件、ChromeでAuth作成からdashboard到達、6文字の管理者名validationまで確認した。claim schema統一、一般User部分状態、App Check、Users Rules、Dev・remote受入れが未完了のため進捗は据え置いた。 |
| 2026-08-16 | 10% | 0 | Auth/User会社整合性helperで`isSuperUser`の欠損・非booleanを拒否し、管理SDKの権限解除を`false`保存へ変更した。専用マイグレーションをEmulator 3件とDev 6件へdry-run、apply、再dry-runの順で実行し、全件が既にbooleanで不整合0件、更新0件であることを確認した。全domain単体test 214件と管理SDK単体test 9件が成功した。保護対象Callable全体のclaim schema統一、Users Rules、App Checkが未完了のため進捗は据え置いた。 |
| 2026-08-16 | 10% | 0 | 会社所属済みCallableの共通Auth identity gateと安全なerror mappingを追加し、`disableUser`・`enableUser`でtoken/current AuthのUID・email・verified・company・`isSuperUser`・有効状態を固有policyより先に照合した。全domain単体test 228件、専用local suite 69件が成功した。残る保護対象Callable、Users Rules、App Check、Dev・remote受入れが未完了のため進捗は据え置いた。 |
| 2026-08-16 | 10% | 0 | 共通Auth identity gateを`changeAdminUser`、`checkEmailAvailabilityGlobal`、再構築2 APIにも適用し、会社所属済み6 Callableすべてでtoken/current AuthのUID・email・verified・company・`isSuperUser`・有効状態を固有policyより先に照合した。全domain単体test 226件、専用local suite 71件が成功した。Users Rules、App Check、Dev・remote受入れが未完了のため進捗は据え置いた。 |
| 2026-08-16 | 10% | 0 | UWB-01で単独UserとEmployee連携Userを分け、会社管理者と`users:write`保有者による仮登録管理、`manager`・`human-resource`への初期付与、単独／Employee連携の作成入口分離、1 Employee対最大1 Userを確定した。本登録User lifecycleとEmployee Self Accessは別ゲートへ分離した。文書契約のみで実装・Rules・test・受入れは未完了のため進捗は据え置いた。 |
| 2026-08-17 | 10% | 0 | Codexが専用Emulator、隔離済みFunctions、local server、合成account/data、Codex管理ブラウザを準備し、利用者のChrome起動やsign-inなしにlocal UI testを完結させる方針を確定した。専用Functions接続、開発サーバー設定、browser sign-inは未実装・未検証であり、既存マイルストーンの完了条件を満たさないため進捗は据え置いた。 |
| 2026-08-17 | 10% | 0 | Codex専用UIの最小経路を実装し、外部作用deny、専用Functions・Firebase port、PWA/通知無効化、メール確認済み・company claim付き合成User、Codex管理ブラウザsign-in、dashboard到達、専用suite 72件、process・runtime・一時build cleanupを確認した。サインアウト直後のsnapshot listener error、Users Rules、UWB、App Check、Dev・remote受入れが未完了のため進捗は据え置いた。 |
| 2026-08-20 | 10% | 0 | UWB-03の仮登録User削除を、正規UIで作成した単独UserとEmployee連携Userで再検証し、取消、処理中、成功、既削除への安全な失敗、Auth不変を確認した。正規管理者signupからCodex専用saved-dataを更新し通常再起動も確認した。UWB-04以降、Users Rules、App Check、Dev・remote受入れが未完了でdeploy不可のため進捗は据え置いた。 |
