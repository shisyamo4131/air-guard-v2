# AirGuardV2 正式運用準備ロードマップ

- 目標: 試験運用の知見を反映し、テナント分離、主要業務、復旧可能性、影響に応じて選択した自動・環境検証、固定commitのDev最終受入れを確認したうえで正式運用へ移行できる状態にする。
- この進捗の100%が表す範囲: 正式運用開始の承認準備完了。以後の継続改善や新機能完了を意味しない。
- 現在の進捗: 10%
- 最終確認日: 2026-09-05
- 承認境界: 重要仕様変更、実データ操作、データ移行、外部サービス変更、Git push、Prodデプロイ、正式運用開始は利用者の明示的承認を必要とする。Devは正式運用準備とは独立したbounded release checkpointとして承認し、そのrunbook内の静的生成、deploy、remote検証を積極的に行う。
- 製品変更は固定commitのDev受入れを完了条件とする。Codex専用Localと利用者環境Localは手戻り抑制のために必要な場合だけ選び、個々の改修へ一律に要求しない。環境ごとの選択と保証範囲は[Environment and approval rules](../project-rules/environment-and-approval.md#local-emulatorとlocal-ui)に従う。正式運用開始とProd反映はDev受入れとは別の明示承認を維持する。

## マイルストーン

| マイルストーン | 重み | 得点 | 状態 | 完了証拠と残作業 |
|---|---:|---:|---|---|
| ガバナンスと現行仕様の基準線 | 10 | 10 | Completed（完了） | 下記 G1～G5 の全ゲートを満たした。 |
| 主要業務とデータ整合性 | 25 | 0 | In progress（進行中） | schemaとFunctionsの静的レビューでlock、Billing、勤怠・履歴同期、rounding、snapshotの問題を確認した。修正、Emulator、回帰test、試験運用照合が未完了。 |
| 認証・認可・テナント分離 | 20 | 0 | Verification required（要検証） | UWB-01〜10のlocal完了とDEV-UWB-RELEASE-001のDev cutoverに加え、専用合成会社で管理者・一般Userの正規signup、roleless・role別route、2 tabのstale role、User/Auth無効化・復帰、非破壊lifecycleを確認した。`disableuser`/`enableuser`のCloud Run public invoker欠落をDev限定で修復し、第2合成会社から別会社pathのread・list・update・deleteが403となるtenant拒否を確認した。Company rootのclient create/deleteは閉じた。既存master・transactionの広いtenant内writeはCustomerから機能単位で見直し、App Check・全般的なrate limit・public invoker常時監視はProd公開前gateで扱う。 |
| 運用信頼性と外部連携 | 15 | 0 | Verification required（要検証） | DEV-UWB-RELEASE-001でFirestore PITR 7日保持、maintenance中の全体snapshot、Rules/Functions/Hosting deploy、ERROR log 0件を確認した。継続監視、snapshotからの復旧演習、Admin backup/restore正式scope、依存関係脆弱性は未完了。Stripe/subscriptionは現在の正式運用準備範囲外。 |
| Dev受入れと業務マニュアル | 15 | 0 | In progress（進行中） | 共通UI sourceでlock/disabled、validation、非同期race、date-time、accessibilityの問題を確認した。対象変更の自動検証・必要なpre-Dev環境検証、固定commitのDev最終受入れ、manual整合が未完了。 |
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

1. CustomerはRules・HostingをDevへ反映し、座標付き保存のRules不具合を修正して会社管理者の通常作成・基本情報・支払条件・指定既存取引先の編集と復元を確認した。[Dev試験とcleanup](../verification/customer-01d-dev-test.md)を参照。権限別UI確認は[CUSTOMER-01E記録](../verification/customer-01e-dev-test.md)を参照。実Devの直接拒否probeは対象外。請求期日・PDFの受入れは利用者指示で稼働実績管理改修後の請求書発行機能確認へ移し、Customerフェーズの完了条件から外す。次のフェーズは着手前に[テスト範囲を利用者と合意](../project-rules/development-and-data.md#フェーズごとのテスト範囲の合意)する。[既存の検査証拠](../verification/customer-01b-dev-compatibility.md)は保持し、追加全件診断・予防修復を一律の先行作業にしない。
2. Customerの作成・基本情報・支払条件に関する先行フェーズは[閉鎖記録](../verification/customer-01e-dev-test.md#利用者承認によるフェーズ閉鎖)のとおり終了した。取引状態は[Customer状態ロードマップ](customer-status.md)のCS-04、archive safetyは[専用ロードマップ](customer-archive-safety.md)のCAS-05までDev受入れを完了し、いずれも100%とした。参照ありarchive拒否と拒否後の不変を一時合成Customer・active Siteで確認し、両masterは承認済みarchive経路でcleanupした。restore、code一意性・検索拡張、Siteへの移行は別の作業単位として後続合意する。
3. Outsourcerは[専用ロードマップ](outsourcer.md)で管理する。利用者は、Outsourcerを特定の協力会社masterとし、同じ外注先を配置へ複数回登録できる現行方式を維持して、旧試行の人数集約方式を採用しないと確定した。OUT-01からOUT-07のlocal実装・統合に加え、OUT-08でbounded Dev反映後の会社管理者による作成・検索・編集・契約終了・終了済み表示と、経理accountの閲覧・write導線非表示を確認して100%とした。製品にarchive／deleteを設けない契約どおり、合成masterは契約終了状態で保持する。周辺transaction機能は変更していない。
4. Siteは[専用ロードマップ](site.md)で管理する。SITE-08のLocal統合後、SITE-09で初回bounded Dev反映、Rules評価上限の補正、Rules-only再反映、会社管理者の合成Site作成・編集・検索・終了・終了済み検索・再有効化・参照なしarchive、経理accountの閲覧・作成導線非表示を確認した。利用者は機能面を完了、見た目・操作感の追加改善を後続phaseと判断し、Siteの進捗を95%から100%へ更新した。Prod、Site自動終了公開、既存data全件検査・補完は別承認である。
5. Employee master改修は[Employeeロードマップ](employee.md)のEMP-09まで完了し、100%とした。Local統合の実測は[EMP-08記録](../verification/employee-08-local.md)、bounded Dev反映後の会社管理者による通常編集・退職／復帰と経理accountのread-only境界は[Dev受入れ結果](../implementation/master-dev-acceptance-plan.md#no10後のcustomeroutsourceremployee-dev受入れ結果)を正とする。通常archive APIのtenant allowlistは空のままで、実Employee／User／Authentication、実data補完、migration、Prodへ承認を拡張しない。
6. 配置管理の楽観的更新回帰は、clientから`functions/shared`への直接importを解消し、操作後のlocal表示へ直ちに反映してCallableを独立送信し、listenerの正本で無条件に置き換える方式へ修正した。通常操作用のpending lock、queue、更新順保証、履歴管理は持たず、失敗時だけ対象予定を明示再取得する。会社管理者のLocal確認と、開発serverをDev backendへ接続した利用者受入れを完了し、mainへ統合した。予定更新dialogの削除checkboxと、実績化前だけを削除できる既存Callable境界は維持する。Functions、Rules、schema、保存形式、Dev dataは変更せず、Dev Hosting deploy、Prod、pushは実施していない。[FUT-0186](../implementation/future-actions.md#fut-0186-配置管理の楽観的更新回帰を復旧する)と[受入れ記録](../verification/arrangement-optimistic-dev-acceptance.md)を参照する。
7. 配置管理の楽観的更新修正後の必須phaseとして、Firestore Rulesの責務と式数を段階的に整理する。最初に全subcollectionとreader／writerを棚卸しし、次に未定義collectionの既定拒否化、高risk更新のCallable化、Site Rulesの式数削減、必要なread model分離を独立checkpointで進める。一括書換えはせず、各checkpointで既存query互換、許可・拒否のEmulator test、Dev切替・rollback条件を確認する。詳細な未実施範囲は[FUT-0185](../implementation/future-actions.md#fut-0185-firestore-rulesの責務と式数を段階的に整理する)を正とし、着手前のため進捗へ加点しない。
8. マスタ管理機能の改修中は対象masterのCRUDを主対象とする。配置・通知・稼働実績・請求・帳票などtransaction系機能への波及変更は、Firestore更新に関係しない表示・読取り・描画identityの互換修正に限定する。transaction系の要改修箇所を検出しても実装せず、既知課題として記録する。マスタ管理の一連の改修後に、OperationResultの管制側編集lockと権限境界、Billing/勤怠/履歴同期、rounding、notification、配置更新失敗時のrollback/refetchを含む改修範囲を別checkpointで合意する。
9. 配置管理の表示順行削除の観測と詳細案は[提案中の専用ロードマップ](arrangement-row-removal-ux.md)で扱う。行単位のpending、同じ`siteOrder`のsingle-flight、live反映待機、失敗・timeout後の明示retryはARU-01で利用者承認を得るまで実装要件としない。Site/Schedule削除やgeneric UI全体はscope外で、現在は提案0%のため本ロードマップの10%進捗には加点しない。
10. 後続の運用課題として、Admin backup/restoreの正式scope、RPO/RTO、operator、artifact保護、復旧演習条件について利用者判断を得る。
11. [ADR 0056](../decisions/0056-employee-role-and-archive-boundary.md)の通常業務の統括更新方針に対し、Employee外のCompany設定・稼働請求等は既存catalog/実装との整合対象として残る。各operationの保護例外・package・UI/server/testの差を確認して後続checkpointを合意する。Employeeの統括退職・archive/物理削除は専用roadmapで扱う。[ADR 0060](../decisions/0060-common-archive-purge-and-address-contract.md)により別collection archiveへ戻し、必要な従属writerの保護を限定して設計する。共通archive・住所/座標仕様を整備するが、他master全体の実装変更や過去完了点への加点を導かない。
12. 共通UIのdisabled強制、draft conflict、非同期latest-wins、date-time/accessibilityをtest可能な契約へ整理する。UWB-10の認証変更はroleと有効状態へ局所化し、汎用single-flight・revision・lock・ledgerを共通UIや他documentへ展開しない。
13. ルートアプリとCloud Functionsの依存関係脆弱性を、破壊的な自動修正を行わず調査する。

### 今後のDev受入テストの実施時期

2026-09-03の利用者指示により、以降の改修ではDev受入テストを原則後回しにし、まとめて実施する計画とする。Customerの残改修を優先してマスタデータ管理の改修とレビュー・local検証を先行し、その一連の改修が揃った後に、権限別のDev受入テストとマスタ間の関連操作をまとめて確認する。アカウント切替とテストデータ準備の重複を減らすことを目的とする。

- 各改修は「実装・local検証完了」と「Dev受入待ち」を区別し、未実施のDev受入を成功・全工程完了として扱わない。Devで確認する操作・期待結果・権限・必要dataを各checkpointへ残し、まとめた受入時に対象を確定する。
- Schemaの明らかな変更、他機能への明確な影響、その他確実に必要な場合の状態確認・必要なmigrationは既存規則を維持する。Dev反映時に必要な確認と受入テストの延期を区別し、deploy時期・対象・承認は個別に決める。
- これはロードマップ上の実施順序の記録であり、検証policy・現行の完了条件は変更しない。2026-09-04の反省会で承認されたproject rule整理は[ADR 0049](../decisions/0049-project-rule-routing-and-checkpoint-closeout.md)へ分離する。正式運用準備の進捗値と、終了済みCustomerの受入結果は変更しない。

## 成果物と検証証拠

| マイルストーン | 設計・判断 | 実装 | テスト・レビュー・環境受入れ |
|---|---|---|---|
| ガバナンスと現行仕様 | [ADR 0001](../decisions/0001-governance-and-specification-source.md)、[ADR 0011](../decisions/0011-roadmap-and-codex-session-lifecycle.md)、[ADR 0013](../decisions/0013-managed-governance-reconstruction.md)、[ADR 0032](../decisions/0032-required-specialist-subagent-routing.md)、[ADR 0034](../decisions/0034-codex-bounded-implementation-and-user-ui-acceptance.md) | 文書・`.codex/` 設定 | `scripts/check-project-docs.ps1`、`scripts/check-governance.ps1` |
| 主要業務とデータ整合性 | [ADR 0003](../decisions/0003-operation-result-billing-integrity.md)、[現行仕様](../specification.md) | 関連画面、モデル、Functions | 関連テスト、試験運用受入れ（未完了） |
| 認証・認可・テナント分離 | [ADR 0002](../decisions/0002-multitenant-firebase-architecture.md)、[ADR 0014](../decisions/0014-codex-dedicated-local-test-data.md)、[ADR 0016](../decisions/0016-firemodel-crud-boundary.md)、[ADR 0017](../decisions/0017-callable-auth-identity-gate.md)、[ADR 0018](../decisions/0018-user-provisioning-and-employee-link-boundary.md)、[ADR 0019](../decisions/0019-client-operation-policy-composable-boundary.md)、[ADR 0020](../decisions/0020-employee-retirement-user-offboarding-and-reinstatement.md)、[ADR 0024](../decisions/0024-dev-trial-deployment-and-migration-runbook.md) | Rules、認証・管理者処理、Codex専用local基盤 | UWB-01〜10のlocal完了とDev cutoverに加え、認証済みDevでsignup、roleless・role別route、stale role、disabled User/Auth同期と復帰、非破壊lifecycle、第2合成会社からのtenant拒否を確認した。Cloud Run invoker欠落2件を修復し、browser CORS/IAM gateをrunbookへ追加した。既存master・transactionのCUD境界はCustomerから順次見直し、App Check・全般的なrate limit・public invoker常時監視はProd公開前gateへ残す。 |
| 運用信頼性と外部連携 | [運用・開発手順](../operations.md) | 通知、Storage、Stripe、バックアップ設定 | Dev PITR、maintenance snapshot、deployとERROR log 0件を確認。復旧演習、継続監視、正式backup scopeは未完了 |
| Dev受入れとマニュアル | [画面マニュアル](../manual/index.md) | 対象画面 | 自動検証・必要なpre-Dev環境検証、固定commitのDev最終受入れ、manual整合（未完了） |
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

全体判断に必要な基準線と節目を残す。下表の各時点は正式運用準備10%であり、機能別の進捗を加算しない。細かな実装・検証件数・途中の停止状態は各機能の記録、以前の逐次記載はGit履歴を参照する。

| 日付 | 進捗 | 変化 | 理由と証拠 |
|---|---:|---:|---|
| 2026-08-10 | 10% | 基準線 | ガバナンス・仕様・ADR・運用手順を基準に、正式運用準備を100点の加重マイルストーンとして設定した。 |
| 2026-08-12 | 10% | 0 | 固定対象のsource精査を完了したが、製品修正・回帰・運用受入れまでの全gateは未達のため据置。[精査計画](../implementation/deep-review-plan.md)と[調査統合記録](../implementation/review-reconciliation-2026-08-12.md)を参照。 |
| 2026-08-26 | 10% | 0 | UWBの段階実装とLocal受入れを進め、UWB-01〜10のLocal完了を確定。正式運用の認証マイルストーン全体は未達のため据置。途中の実装・訂正・検証は[UWB記録](../implementation/user-write-boundary.md)を参照。 |
| 2026-08-27 | 10% | 0 | UWBのbounded Dev反映・認証済み受入れを完了したが、Rules全体、App Check・rate limit、復旧演習等の残件により正式運用の全gateは未達。[Dev受入れと残る境界](../implementation/user-write-boundary.md#dev環境受入れ)を参照。 |
| 2026-08-28 | 10% | 0 | Company旧CCBの設計成果とガバナンス移行は、未完了の製品マイルストーンの達成とはしない。[旧CCBロードマップ](company-settings.md)は後続で置換された履歴として参照する。 |
| 2026-08-30 | 10% | 0 | 旧CCBのcorrective rollbackとCompany部分更新への移行を進めた。後続の機能別完了も正式運用全体の得点へ自動加算しない。[Company部分更新](company-partial-updates.md)と[ADR 0031](../decisions/0031-proportional-data-boundary-and-change-safeguards.md)を参照。 |

ガバナンスの役割変更・専門担当・実装責任の経緯は[ADR索引](../decisions/README.md)へ、現行の作業順と未完了条件は本書の「次の作業」「マイルストーン」へ照合する。当時の未完了表現を現在の製品状態として再採用しない。この整理では重み、得点、部分加点禁止、正式運用開始条件を変更していない。
