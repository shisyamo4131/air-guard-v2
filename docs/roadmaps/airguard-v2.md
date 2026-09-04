# AirGuardV2 正式運用準備ロードマップ

- 目標: 試験運用の知見を反映し、テナント分離、主要業務、復旧可能性、Codexによる自動・UI検証、利用者による実際の利用環境での最終受入れを確認したうえで正式運用へ移行できる状態にする。
- この進捗の100%が表す範囲: 正式運用開始の承認準備完了。以後の継続改善や新機能完了を意味しない。
- 現在の進捗: 10%
- 最終確認日: 2026-09-04
- 承認境界: 重要仕様変更、実データ操作、データ移行、外部サービス変更、Git push、Prodデプロイ、正式運用開始は利用者の明示的承認を必要とする。Devは正式運用準備とは独立したbounded release checkpointとして承認し、そのrunbook内の静的生成、deploy、remote検証を積極的に行う。
- 上記の利用者最終受入れは正式運用移行全体の完了条件であり、個々の既存画面改修に利用者local受入れを一律要求する意味ではない。個別変更は[local UI検証runbook](../runbooks/local-ui-testing.md)の省略基準に従う。

## マイルストーン

| マイルストーン | 重み | 得点 | 状態 | 完了証拠と残作業 |
|---|---:|---:|---|---|
| ガバナンスと現行仕様の基準線 | 10 | 10 | Completed（完了） | 下記 G1～G5 の全ゲートを満たした。 |
| 主要業務とデータ整合性 | 25 | 0 | In progress（進行中） | schemaとFunctionsの静的レビューでlock、Billing、勤怠・履歴同期、rounding、snapshotの問題を確認した。修正、Emulator、回帰test、試験運用照合が未完了。 |
| 認証・認可・テナント分離 | 20 | 0 | Verification required（要検証） | UWB-01〜10のlocal完了とDEV-UWB-RELEASE-001のDev cutoverに加え、専用合成会社で管理者・一般Userの正規signup、roleless・role別route、2 tabのstale role、User/Auth無効化・復帰、非破壊lifecycleを確認した。`disableuser`/`enableuser`のCloud Run public invoker欠落をDev限定で修復し、第2合成会社から別会社pathのread・list・update・deleteが403となるtenant拒否を確認した。Company rootのclient create/deleteは閉じた。既存master・transactionの広いtenant内writeはCustomerから機能単位で見直し、App Check・全般的なrate limit・public invoker常時監視はProd公開前gateで扱う。 |
| 運用信頼性と外部連携 | 15 | 0 | Verification required（要検証） | DEV-UWB-RELEASE-001でFirestore PITR 7日保持、maintenance中の全体snapshot、Rules/Functions/Hosting deploy、ERROR log 0件を確認した。継続監視、snapshotからの復旧演習、Admin backup/restore正式scope、依存関係脆弱性は未完了。Stripe/subscriptionは現在の正式運用準備範囲外。 |
| 利用者受入れと業務マニュアル | 15 | 0 | In progress（進行中） | 共通UI sourceでlock/disabled、validation、非同期race、date-time、accessibilityの問題を確認した。Codexの自動検証・必要なin-app UI smoke、修正、利用者による実際の利用環境での最終UI acceptance、manual整合が未完了。 |
| 正式運用移行判定 | 15 | 0 | Not started（未着手） | App Check、全般的なrate limit、Callable public invoker常時監視、SLA、保持期間、監視・障害対応基準、移行・ロールバック、正式運用開始承認を確定する。 |
| **合計** | **100** | **10** |  |  |

部分加点は行わない。各マイルストーンの完了条件をすべて満たした時点で、その重み全体を得点する。

## 調査証拠の進捗（正式運用準備スコアとは別）

- 主repoの531-file deep reviewは、A 310件から519件へ増加した。B/C残数は209件から0件へ減少し、予定したsource本文精査を完了した。D 11件とE 1件は分類済みのtest/config/asset・外部境界であり、runtime検証済みという意味ではない。
- schema runtime 76 paths、共通UI runtime 43 paths、Admin SDK runtime 14 pathsを、主repo母数とは別のpackage境界として静的レビューした。
- 利用者用local環境から分離したCodex専用Emulator seedとAuth・Firestore・Storage Rules・再構築Callable・全会社メール重複確認Callable handlerの51件のtestを追加した。全Companies collectionとSecurityReports fileのtenant identity gate、恒久的なsuper-user bypass廃止、SecurityReportIndexes・StripeDataの個別操作制約、再構築実行者の現在Auth/User整合性、全会社メール重複確認の会社管理者境界を確認した。Chromeからlocal EmulatorへのFunctions transportは再構築2件とUser有効化・無効化の4件を実測した。残るFunctions transport、Realtime Database Rules、外部サービスの回帰testは未完了であり、公式進捗は加点しない。
- 調査完了とDEV-UWB-RELEASE-001は重要な実装・remote証拠だが、いずれの未完了マイルストーンも全ゲートには達していない。そのため無部分加点規則により公式進捗は10%のままとする。
- 詳細な問題、台帳対応、要判断事項は[2026-08-12 source review統合記録](../implementation/review-reconciliation-2026-08-12.md)を参照する。

### ガバナンス基準線の完了ゲート

- [x] G1: 必須成果物（作業規則、文書案内、現行仕様、ロードマップ、ADR索引、運用手順、開始プロンプト、変更履歴、専門エージェント設定）が存在し、索引から到達できる。
- [x] G2: `.codex/config.toml` と全専門エージェントTOMLを正式なTOMLパーサーで解析し、必須キー、型、エージェント名、sandbox modeを検証できる。
- [x] G3: Markdown相対リンク、GitHub互換見出しアンカー、重要文書の索引到達性を機械検証できる。
- [x] G4: ADR本文と索引の状態、ロードマップの重み、得点、無部分加点、索引進捗を機械検証できる。
- [x] G5: 独立レビューの指摘を反映し、ガバナンス検証、陰性試験、PowerShell構文確認、`git diff --check` が成功する。

## 次の作業

1. CustomerはRules・HostingをDevへ反映し、座標付き保存のRules不具合を修正して会社管理者の通常作成・基本情報・支払条件・指定既存取引先の編集と復元を確認した。[Dev試験とcleanup](../verification/customer-01d-dev-test.md)を参照。権限別UI確認は[CUSTOMER-01E記録](../verification/customer-01e-dev-test.md)を参照。実Devの直接拒否probeは対象外。請求期日・PDFの受入れは利用者指示で稼働実績管理改修後の請求書発行機能確認へ移し、Customerフェーズの完了条件から外す。次のフェーズは着手前に[テスト範囲を利用者と合意](../../governance/project-rules.md#フェーズごとのテスト範囲の合意)する。[既存の検査証拠](../verification/customer-01b-dev-compatibility.md)は保持し、追加全件診断・予防修復を一律の先行作業にしない。
2. Customerの作成・基本情報・支払条件に関する先行フェーズは[閉鎖記録](../verification/customer-01e-dev-test.md#利用者承認によるフェーズ閉鎖)のとおり終了した。取引状態の表示・編集は[Customer状態ロードマップ](customer-status.md)のCS-03、archive safetyは[専用ロードマップ](customer-archive-safety.md)のCAS-04までlocal実装・検証を完了した。CS-04とCAS-05のDev反映・受入れはマスタデータ管理の一連の改修後へ延期し、別承認する。restore、code一意性・検索拡張、Siteへの移行は別の作業単位として後続合意する。個別改修の未実施Dev受入れを成功扱いせず、下記方針に従ってまとめて確認する。
3. マスタ管理の改修後に、OperationResultの管制側編集lockと権限境界の改修範囲をすり合わせる。Billing/勤怠/履歴同期、rounding、notificationを含む検証はそのフェーズで範囲を合意し、現在のCustomer検証へ含めない。
4. 配置管理の表示順行削除の観測と詳細案は[提案中の専用ロードマップ](arrangement-row-removal-ux.md)で扱う。行単位のpending、同じ`siteOrder`のsingle-flight、live反映待機、失敗・timeout後の明示retryはARU-01で利用者承認を得るまで実装要件としない。Site/Schedule削除やgeneric UI全体はscope外で、現在は提案0%のため本ロードマップの10%進捗には加点しない。
5. 後続の運用課題として、Admin backup/restoreの正式scope、RPO/RTO、operator、artifact保護、復旧演習条件について利用者判断を得る。
6. 共通UIのdisabled強制、draft conflict、非同期latest-wins、date-time/accessibilityをtest可能な契約へ整理する。UWB-10の認証変更はroleと有効状態へ局所化し、汎用single-flight・revision・lock・ledgerを共通UIや他documentへ展開しない。
7. ルートアプリとCloud Functionsの依存関係脆弱性を、破壊的な自動修正を行わず調査する。

### 今後のDev受入テストの実施時期

2026-09-03の利用者指示により、以降の改修ではDev受入テストを原則後回しにし、まとめて実施する計画とする。Customerの残改修を優先してマスタデータ管理の改修とレビュー・local検証を先行し、その一連の改修が揃った後に、権限別のDev受入テストとマスタ間の関連操作をまとめて確認する。アカウント切替とテストデータ準備の重複を減らすことを目的とする。

- 各改修は「実装・local検証完了」と「Dev受入待ち」を区別し、未実施のDev受入を成功・全工程完了として扱わない。Devで確認する操作・期待結果・権限・必要dataを各checkpointへ残し、まとめた受入時に対象を確定する。
- Schemaの明らかな変更、他機能への明確な影響、その他確実に必要な場合の状態確認・必要なmigrationは既存規則を維持する。Dev反映時に必要な確認と受入テストの延期を区別し、deploy時期・対象・承認は個別に決める。
- これはロードマップ上の実施順序の記録であり、今回ガバナンス・検証policy・現行の完了条件は変更しない。全改修に共通する規則としてのガバナンス反映要否は利用者の検討待ち。正式運用準備の進捗値と、終了済みCustomerの受入結果は変更しない。

## 成果物と検証証拠

| マイルストーン | 設計・判断 | 実装 | テスト・レビュー・環境受入れ |
|---|---|---|---|
| ガバナンスと現行仕様 | [ADR 0001](../decisions/0001-governance-and-specification-source.md)、[ADR 0011](../decisions/0011-roadmap-and-codex-session-lifecycle.md)、[ADR 0013](../decisions/0013-managed-governance-reconstruction.md)、[ADR 0032](../decisions/0032-required-specialist-subagent-routing.md)、[ADR 0034](../decisions/0034-codex-bounded-implementation-and-user-ui-acceptance.md) | 文書・`.codex/` 設定 | `scripts/check-project-docs.ps1`、`scripts/check-governance.ps1` |
| 主要業務とデータ整合性 | [ADR 0003](../decisions/0003-operation-result-billing-integrity.md)、[現行仕様](../specification.md) | 関連画面、モデル、Functions | 関連テスト、試験運用受入れ（未完了） |
| 認証・認可・テナント分離 | [ADR 0002](../decisions/0002-multitenant-firebase-architecture.md)、[ADR 0014](../decisions/0014-codex-dedicated-local-test-data.md)、[ADR 0016](../decisions/0016-firemodel-crud-boundary.md)、[ADR 0017](../decisions/0017-callable-auth-identity-gate.md)、[ADR 0018](../decisions/0018-user-provisioning-and-employee-link-boundary.md)、[ADR 0019](../decisions/0019-client-operation-policy-composable-boundary.md)、[ADR 0020](../decisions/0020-employee-retirement-user-offboarding-and-reinstatement.md)、[ADR 0024](../decisions/0024-dev-trial-deployment-and-migration-runbook.md) | Rules、認証・管理者処理、Codex専用local基盤 | UWB-01〜10のlocal完了とDev cutoverに加え、認証済みDevでsignup、roleless・role別route、stale role、disabled User/Auth同期と復帰、非破壊lifecycle、第2合成会社からのtenant拒否を確認した。Cloud Run invoker欠落2件を修復し、browser CORS/IAM gateをrunbookへ追加した。既存master・transactionのCUD境界はCustomerから順次見直し、App Check・全般的なrate limit・public invoker常時監視はProd公開前gateへ残す。 |
| 運用信頼性と外部連携 | [運用・開発手順](../operations.md) | 通知、Storage、Stripe、バックアップ設定 | Dev PITR、maintenance snapshot、deployとERROR log 0件を確認。復旧演習、継続監視、正式backup scopeは未完了 |
| 利用者受入れとマニュアル | [画面マニュアル](../manual/index.md) | 対象画面 | Codex自動検証・必要なin-app UI smoke、利用者による実際の利用環境での最終UI acceptance（未完了） |
| 正式運用移行判定 | [現行仕様](../specification.md) | 未確定 | 移行・復旧演習、利用者承認（未完了） |

## 未解決問題

- invitation/account setup、User documentとglobal Auth UID、匿名signup Callableのabuse防止、同一tenant内field権限。
- OperationResultの管制側編集lock・権限強制、agreementなしresult、Billing status、請求書snapshot、同時更新、勤怠・履歴・report indexの部分失敗と再構築。
- FireModelのprocess-global context、full-set/upsert、serialization、validation、client/server adapter差。
- 通知の重複、FCM token lifecycle/log、ArrangementNotification日時・状態遷移。
- UI managerのdisable非強制、二重送信、draft競合、入力debounce、非同期stale response、date-time、accessibility。
- Admin backup/restoreのcoverage、平文artifact/credential、operator権限、監査、rollback/resume、migration例外。
- npm依存関係の脆弱性と互換性を保つ更新方法。
- 将来サブスクリプションを企画する場合のprovider、契約管理、料金、利用上限。現行の未同期Stripe scaffold撤去とは分離する。
- Prod公開前のApp Check・全般的なrate limit・Callable public invoker常時監視、SLA、保持期間、復旧目標、試験運用受入れ証拠。

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
| 2026-08-20 | 10% | 0 | UWB-04で全User email予約・Employee予約を正本化し、単独／Employee連携仮登録作成、削除、本登録変換、初期管理者作成、匿名事前確認、Rules、Emulator限定migration tool、client policy/controller/UI接続を実装した。旧global availability APIを非公開化し、全domain単体test 462件と対象SFC compileが成功した。saved-data migration、Emulator concurrency、正規UI、UWB-08 Users Rules、App Check、Dev・remote受入れが未完了のため進捗は据え置いた。 |
| 2026-08-21 | 10% | 0 | UWB-04の予約migration dry-runはclean、専用Emulator suite 74件、単独／Employee連携仮登録Userの正規UI作成・削除とbackend assertionが成功した。Employee連携では既知role、両予約pointer、Auth不存在、削除後のEmployee残存を確認した。UWB-08 Users Rules、App Check、Dev・remote受入れ等が残るためマイルストーンは未完了で、無部分加点規則により進捗は据え置いた。 |
| 2026-08-21 | 10% | 0 | 利用者が機能branchのlocal UIでUWB-04の単独／Employee連携作成、取消、削除、表示・操作感を受入れた。User一覧に明示的な「仮登録」表示がなく、Employee詳細には表示される現行差異も確認した。UWB全体と認証マイルストーンは未完了のため進捗は据え置いた。 |
| 2026-08-21 | 10% | 0 | UWB-02R〜04Rで仮登録操作を`users:provision`、role・通知等の管理を`users:write`へ分離した。managerへ両方、human-resourceへprovisionだけを付与し、provision-only actorの非空rolesを拒否した。domain単体test 467件と専用Emulator 74件は成功したが、human-resource UI再受入れと後続UWBが未完了のため進捗は据え置いた。 |
| 2026-08-21 | 10% | 0 | permission分離後のhuman-resource正規UI再受入れを完了した。一般User signupの通常submit中断とprovision-only dialogのgeneric role field露出を修正し、role control不存在、emailだけのEmployee連携仮登録作成・削除、作成後・削除後のbackend状態を確認した。domain単体test 468件、変更2 SFC compile、専用Emulator 74件が成功した。UWB-05以降が未完了のため進捗は据え置いた。 |
| 2026-08-24 | 10% | 0 | 利用者がUWB-04の最小確認項目通過を報告した。Functions authのpolicy・permission定義とCallable error mapperを専用directoryへ整理し、全domain単体test 468件と専用Emulator suite 74件で挙動不変を確認してUWB-04を最終完了とした。UWB-05以降が未完了のため進捗は据え置いた。 |
| 2026-08-24 | 10% | 0 | UWB-05で本人プロフィール、管理対象Userの通知3フラグ、他の非管理者Userのroleをfield別Callableへ分離し、User一覧・本人設定のFireModel full updateを除去した。全domain単体test 490件と専用Emulator suite 79件が成功した。利用者によるapplication file・local UI受入れと後続UWBが未完了のため進捗は据え置いた。 |
| 2026-08-24 | 10% | 0 | 利用者がUWB-05のapplication implementation fileと動作を確認し、完了を承認した。UWB-06以降、Users Rules、App Check、Dev・remote受入れが未完了で認証マイルストーンを満たさないため、無部分加点規則により進捗は据え置いた。 |
| 2026-08-24 | 10% | 0 | UWB-06でUser管理操作をoperation・target単位のsingle-flightへ統合し、独立loading、会社管理者専用controlのfail-closed表示、`/settings/users`のstrict preset route・navigation判定、直接Firestore write不在の監査を実装した。domain単体test 507件と専用Emulator suite 79件が成功した。利用者UI受入れと後続UWBが未完了のため進捗は据え置いた。 |
| 2026-08-24 | 10% | 0 | UWB-06の多重実行scopeを見直し、全documentへの汎用single-flightを採用せず、共通managerの`isLoading`再入guardと独自3 actionの共通pendingへ限定した。未対応client、複数tab・端末・actorを含む包括的な多重実行risk評価はUWB-10後段へ移した。UWB-06利用者UI受入れと後続UWBが未完了のため進捗は据え置いた。 |
| 2026-08-24 | 10% | 0 | pageSettingsの全35 routeを共有accessPolicy catalogへ移し、12のpathなしgroupをアクセス可能な子から導出した。User管理のstrict境界を維持し、super-userの会社設定menu表示をroute許可と整合させ、legacy field併記等をfail closedとした。domain単体test 521件が成功した。UWB-06利用者UI受入れと後続UWBが未完了のため進捗は据え置いた。 |
| 2026-08-24 | 10% | 0 | 利用者がUWB-06の画面確認完了を報告し、実装・自動検証・UI受入れを完了した。UWB-07以降、Users Rules、App Check、Dev・remote受入れが未完了で認証マイルストーンを満たさないため、無部分加点規則により進捗は据え置いた。 |
| 2026-08-24 | 10% | 0 | UWB-07をEmployee退職、会社管理者専用の単独本登録User削除、会社管理者専用の誤退職訂正へ再構成し、User archive不採用、統合`LifecycleOperations`、本登録Auth削除intent・reconcile、User/Auth非復元、仮Userのfail-closed分離、current Auth gate、FCM通知・Rules・logを含むUWB-08同時release gateを確定した。実装、保持期間、Rules、test、UI受入れは未完了のため、無部分加点規則により進捗は据え置いた。 |
| 2026-08-24 | 10% | 0 | UWB-07第1checkpointとして`employees:terminate`をclient/serverのstrict `human-resource` presetへ追加し、A/B/Cのexact input、actor、targetを検証するFunctions純粋policyを実装した。対象test 34件と全domain単体test 540件が成功した。operation基盤、use-case、Callable、Emulator、Rules、UI受入れが未完了のため、無部分加点規則により進捗は据え置いた。 |
| 2026-08-24 | 10% | 0 | UWB-07第2checkpointとしてserver-only operation/event/lock/head schema、request fingerprint、Firestore transaction store、共通registered User削除phase engineを実装した。外部Auth/FCM作用をtransaction外へ限定し、phase順序、冪等再開、failure記録、terminal cleanup後だけのlock解放を対象test 17件と全domain単体test 557件で検証した。A/B/C use-case、Callable、Emulator、Rules、UI受入れが未完了のため、無部分加点規則により進捗は据え置いた。 |
| 2026-08-24 | 10% | 0 | UWB-07第3A core checkpointとしてEmployee-only退職をoperation・event・一時lock・head・Employee更新の単一transactionへ統合し、本登録User連携Aを予約pointer・一意User検査、Auth再照合・削除、User・両予約finalize、FCM cleanupへ接続した。対象35件と全domain単体test 575件が成功した。Callable・Emulator・B/C・Rules・UI受入れが未完了のため、無部分加点規則により進捗は据え置いた。 |
| 2026-08-24 | 10% | 0 | UWB-07/08のA/B/C Callable、reconcilerと必要なcollection-group index、訂正用最小context、client UI、User・Employee・lifecycle・FCM Rules、通知eligibilityとprivacy是正を実装した。全domain単体test 609件、専用Emulator suite 88件、Codex専用UIの管理者sign-inと対象一覧画面smokeが成功した。利用者local操作受入れ、Rules確認、履歴reader・保持期間・legal hold・terminal後UID縮小が未完了のため進捗は据え置いた。 |
| 2026-08-24 | 10% | 0 | 利用者用EmulatorとChromeでUWB-07の権限別UIを受け入れ、正規UIで作成・本登録したEmployee連携Userを対象に退職、Auth/User削除、誤退職訂正、User/Auth非復元、Employeeの在職一覧復帰を確認した。単独本登録User削除とEmployee-only経路も成功した。super-userの退職・訂正・単独User削除controlをserverと同じfail closedへ揃え、sign-out listenerは既存の共通認証課題FUT-0005へ分離した。履歴reader・保持期間・legal hold・terminal後UID縮小が未完了のため、無部分加点規則により進捗は据え置いた。 |
| 2026-08-25 | 10% | 0 | `LifecycleOperations`は現段階で固定保存期限を設けず自動削除しないと確定した。削除を前提とするlegal hold、terminal後UID縮小、purgeは、data量・法令・社内規程・privacy・費用・運用上の必要性から見直しが必要と判断した時点の将来検討へ移した。会社管理者専用履歴reader、利用者Rules確認等が未完了で認証マイルストーンを満たさないため、進捗は据え置いた。 |
| 2026-08-25 | 10% | 0 | 会社管理者専用履歴readerを、専用page、全stateの3段階表示、20件固定cursor、exact最小projection、Firestore client直読denyとして確定した。reader実装・検証と利用者Rules確認が未完了で認証マイルストーンを満たさないため、進捗は据え置いた。 |
| 2026-08-25 | 10% | 0 | 会社管理者専用履歴readerをCallable、専用page、route・navigationへ実装した。返却直前のAuth・actor再検証、exact Timestamp/cursor、20/21件境界、同時刻tie-break、Rules直接read denyを対象70件、全domain 635件、専用Emulator 92件で確認し、追加indexは不要だった。Nuxt dev serverの既知hydrate問題により履歴pageの実browser確認は未完了で、利用者Rules確認等も残るため進捗は据え置いた。 |
| 2026-08-25 | 10% | 0 | 利用者のログイン済みChromeで管理者menuから履歴pageへ通常操作で到達し、空状態、無効な前後button、console warning/error 0件を確認した。利用者は`firestore.rules`のUser client write拒否、Employee lifecycle field・delete拒否、lifecycle ledger/event/lock/head直接access拒否を承認し、UWB-08を完了した。履歴data行・実page移動、UWB-09以降、App Check、Dev・remote受入れが未完了のため進捗は据え置いた。 |
| 2026-08-25 | 10% | 0 | Codex専用EmulatorとNuxt/Viteを十分に予熱してからインアプリブラウザを開く標準手順を確定し、cold restart 3回でreloadなしの製品top、保存済み合成accountでsign-inからdashboard到達を確認した。application deliverableではなく、UWB-09以降、App Check、Dev・remote受入れが未完了のため進捗は据え置いた。 |
| 2026-08-26 | 10% | 0 | UWB-09としてSchemasの公開`2.4.2-dev.166`からrole preset catalogをルートとFunctionsへexact同一version・tarball・integrityで導入し、重複local catalogを削除した。strict client/Functionsはprototype-keyを含む未知roleをfail closedとし、一般clientの直接permission互換を維持した。対象26件と全domain 638件がNode 22で成功したが、認証マイルストーン全体のApp Check、Dev・remote受入れ等が未完了のため進捗は据え置いた。 |
| 2026-08-26 | 10% | 0 | 利用者がUWB-09の最小UI smokeとして、User管理とEmployee詳細のrole名称・icon・選択肢、および権限に応じたUser管理controlの表示を確認した。UWB-09のconsumer導入受入れを完了したが、認証マイルストーン全体のApp Check、Dev・remote受入れ等は未完了のため進捗は据え置いた。 |
| 2026-08-26 | 10% | 0 | UWB-10の多重実行riskを操作別に評価し、認証・認可へ直接影響するrole更新と有効状態変更だけへ期待値照合とlifecycle lock拒否を採用した。管理者移譲、仮User、lifecycleは既存保護を維持し、通知設定はlast-write-winsを受容する。全document共通のrevision・lock・ledgerは不採用とし、通常CRUDと他collectionへ展開しない。全体回帰と利用者受入れが未完了のため進捗は据え置いた。 |
| 2026-08-26 | 10% | 0 | UWB-10の認証限定競合制御について、全domain単体test 646件とCodex専用Emulator 93件が成功した。stale role、有効状態のstale再操作、active lifecycle lock中の変更を安全な`aborted`として確認した。内蔵ブラウザは標準予熱後も起動templateで停止し、Chrome補助経路も接続できなかったためUI成功とはしない。全専用port閉鎖、saved-data指紋不変、runtime残留0を確認した。通常UI受入れ、利用者の全file確認、feature commit・main統合、App Check、Dev・remote受入れが未完了のため進捗は据え置いた。 |
| 2026-08-26 | 10% | 0 | 利用者起動のlocal Emulator・開発サーバーと会社管理者Chromeで、非管理者Userの無効化・再有効化、2画面のrole先行保存、古いrole保存の安全な拒否、最終的な有効・role未設定への復元を確認した。通常UIのUWB-10受入れは成功したが、利用者の全file確認とUWB local確定、main統合、App Check、Dev・remote受入れが未完了のため進捗は据え置いた。 |
| 2026-08-26 | 10% | 0 | 利用者は全file・全行の確認ではなく、変更挙動、security境界、test、残存risk、rollbackに基づいてUWB-10のlocal確定を承認した。UWB-10は完了したが、UWB-07の残存陰性証拠、main統合、App Check、Dev・remote受入れが未完了であり、認証マイルストーンも未達のため進捗は据え置いた。 |
| 2026-08-26 | 10% | 0 | UWB-07に残っていたcurrent Auth disabled、仮User連携、同emailの別tenant新User・予約・Auth UIDとAuth-only raceの陰性証拠を追加した。既存のphase failure・reconcile・通知privacy・20/21件cursor paging、Chromeの履歴route・loading・empty確認と合わせ、全domain 646件、専用Emulator 96件でUWB-01〜10のlocal完了を確定した。main統合、Firestore Rules全体のtenant内write縮小、App Check・rate limit、Dev・remote受入れが未完了で認証マイルストーンを満たさないため、無部分加点規則により進捗は10%に据え置いた。 |
| 2026-08-27 | 10% | 0 | Devを正式運用可否判定前の非本番試行環境として、検証済み変更を積極的にdeploy・受入れする方針へ訂正した。UWB全体cutoverと予約migrationをmaintenance、snapshot、server境界、migration、client、解除の標準checkpointへ統合した。Dev証拠は未取得でマイルストーン完了条件を満たさないため進捗は据え置いた。 |
| 2026-08-27 | 10% | 0 | DEV-UWB-RELEASE-001を実施した。release commit `52dd607d16e9b77f90ec238250eca11757548097`で、PITR 7日保持、maintenance後snapshot 22,268 documents、Rules・indexes・全Functions、create-only予約migration 16 writes、Hosting live version `049afa156793e630`、maintenance解除を確認した。Functions 36件は全ACTIVE、廃止`checkEmailAvailabilityGlobal`は0件、UWB 11 Callableは未認証を401で拒否し、scheduled reconcilerはENABLED、cutover以降のFunctions ERROR logは0件だった。新browser sessionでtopとsign-in画面、console error 0件を確認した。認証済み実accountのrole・tenant・disabled・stale/lifecycle受入れ、App Check・rate limit、Rules全体縮小、復旧演習等が残り、無部分加点規則により進捗は据え置いた。 |
| 2026-08-27 | 10% | 0 | 専用合成会社の認証済みDev受入れで、管理者・一般User signup、roleless route拒否、2 tabのstale role拒否、一般Userの無効化・サインイン拒否・再有効化・復帰を確認した。当初の無効化失敗は`disableuser`/`enableuser`だけCloud Run `allUsers -> roles/run.invoker`が欠落しbrowser `OPTIONS`が403となる入口IAM不整合で、Dev限定・明示承認の付与と独立再取得後に正常化した。tenant拒否、非破壊lifecycle、Rules全体縮小等が残るため無部分加点規則で10%を維持した。 |
| 2026-08-27 | 10% | 0 | 認証済みDev受入れの残件として、一般Userの`労務`role表示・管理者route拒否・role未設定への復元、会社管理者用lifecycle履歴の空結果、User削除確認の取消とUser残存を確認した。第2合成会社管理者の正規tokenによるbackend assertionでは自社readが200、別会社pathのread・list・precondition付きupdate/deleteが各403、mutation 0だった。UWBのDev受入れは完了したが、Rules全体縮小、App Check・rate limit等が未完了のため進捗は10%に据え置いた。 |
| 2026-08-27 | 10% | 0 | Firestore Rules縮小の最初の安全な単位として、Company root documentのclient create/deleteを拒否し、同社read/updateとFunctionsによる初期作成を維持した。Codex専用Emulator suite 97件が成功した。以後はCUDを一律Functions化せず機能単位で境界を見直す。既存Company update、他collection、App Check・rate limitが残るため進捗は10%に据え置いた。 |
| 2026-08-27 | 10% | 0 | Company設定のclient、server、Rules/security、下流依存を独立調査し、専用ロードマップへ全体保存競合、field ownership、請求・丸め・勤怠・取極め・表示順・maintenance・Stripe・tenant修復の実施順と検証条件を設定した。計画作成のみで実装・test・Dev受入れは未完了のため、親ロードマップ進捗は10%に据え置いた。 |
| 2026-08-28 | 10% | 0 | CCB-01でCompany設定分割、actor、validation、revision/audit、snapshot、勤怠表示方式、廃止field、tenant lifecycle、project-wide maintenance、Stripe延期を承認済み仕様・ADR・runbookへ反映し、CCB専用進捗を10%とした。親ロードマップの未完了マイルストーンは実装・test・Dev受入れを満たさないため、公式進捗は10%に据え置いた。 |
| 2026-08-28 | 10% | 0 | Managed common governance 1.4.0へ移行し、4つの容量確認表現を現在task IDのsession JSONL実測へ明示routeした。300 MiB task handoff、10 GiB全体参考警告、最新session推測禁止、標準報告・停止条件・回帰testを整合した。application、product gate、Dev受入れの完了条件は変わらないため公式進捗は据え置いた。 |
| 2026-08-30 | 10% | 0 | ADR 0031に基づき旧CCBのcompatible reader、migration/restore tooling、pre-containment Rulesを4つのcorrective implementation commitでrollbackした。Schemas `.167` artifact/pin、Admin SDK guard、UWB、Company create/delete拒否を保持し、Rules source contract 2件と隔離Emulator 97件が成功した。新CCBのwhole-document replacement除去、STRIPE-01、Dev受入れは未完了のため公式進捗は据え置いた。 |
| 2026-08-30 | 10% | 0 | Company基本情報を独立draftと専用Callableによる変更field保存へ移し、server timestamp、会社管理者境界、編集中変更通知、client直接変更拒否を実装した。全domain 659件と隔離Emulator 99件が成功した。Company部分更新roadmapは30%だが、残るwhole-document writer、local UI、Dev受入れが未完了のため親roadmapは10%に据え置いた。 |
| 2026-08-30 | 10% | 0 | task交代中を除き、独立して分割できる調査・review・test・利用者承認済み補助実装等へ適切なsubagentを使用し、Checkpoint固有の禁止を当該Checkpointだけに限定する運用を採用した。ガバナンス基準線の成果物と検証可能性は維持され、未完了product milestoneに新たな完了証拠はないため進捗は据え置いた。 |
| 2026-08-30 | 10% | 0 | ADR 0034で、承認済みcheckpoint内のCodex実装・自動検証・必要なin-app UI smokeと、利用者による実際の利用環境での最終UI acceptanceを標準責任へ変更した。product実装・検証・受入れの新しい完了証拠はなく、instruction-chain turnover完了までapplication checkpointを停止するため公式進捗は据え置いた。 |
