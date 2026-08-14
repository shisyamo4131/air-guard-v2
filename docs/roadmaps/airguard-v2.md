# AirGuardV2 正式運用準備ロードマップ

- 目標: 試験運用の知見を反映し、テナント分離、主要業務、復旧可能性、利用者受入れを検証したうえで正式運用へ移行できる状態にする。
- この進捗の100%が表す範囲: 正式運用開始の承認準備完了。以後の継続改善や新機能完了を意味しない。
- 現在の進捗: 10%
- 最終確認日: 2026-08-14
- 承認境界: 重要仕様変更、実データ操作、Firebaseデプロイ、データ移行、外部サービス変更、Git push、正式運用開始は利用者の明示的承認を必要とする。

## マイルストーン

| マイルストーン | 重み | 得点 | 状態 | 完了証拠と残作業 |
|---|---:|---:|---|---|
| ガバナンスと現行仕様の基準線 | 10 | 10 | Completed（完了） | 下記 G1～G5 の全ゲートを満たした。 |
| 主要業務とデータ整合性 | 25 | 0 | In progress（進行中） | schemaとFunctionsの静的レビューでlock、Billing、勤怠・履歴同期、rounding、snapshotの問題を確認した。修正、Emulator、回帰test、試験運用照合が未完了。 |
| 認証・認可・テナント分離 | 20 | 0 | Verification required（要検証） | User更新Auth同期と有効化・無効化Callableのactor/company/target境界を修正し単体testを追加した。invitation takeover、管理者移譲、他Callable、Rules、Storage、Emulator/remote検証は未完了。 |
| 運用信頼性と外部連携 | 15 | 0 | Verification required（要検証） | 通知、Storage、派生同期、Admin backup/restoreを静的レビューした。Stripe、監視、復旧演習、依存関係脆弱性、実環境検証が未完了。 |
| 利用者受入れと業務マニュアル | 15 | 0 | In progress（進行中） | 共通UI sourceでlock/disabled、validation、非同期race、date-time、accessibilityの問題を確認した。browser test、修正、利用者確認、manual整合が未完了。 |
| 正式運用移行判定 | 15 | 0 | Not started（未着手） | SLA、保持期間、監視・障害対応基準、移行・ロールバック、正式運用開始承認を確定する。 |
| **合計** | **100** | **10** |  |  |

部分加点は行わない。各マイルストーンの完了条件をすべて満たした時点で、その重み全体を得点する。

## 調査証拠の進捗（正式運用準備スコアとは別）

- 主repoの531-file deep reviewは、A 310件から519件へ増加した。B/C残数は209件から0件へ減少し、予定したsource本文精査を完了した。D 11件とE 1件は分類済みのtest/config/asset・外部境界であり、runtime検証済みという意味ではない。
- schema runtime 76 paths、共通UI runtime 43 paths、Admin SDK runtime 14 pathsを、主repo母数とは別のpackage境界として静的レビューした。
- 利用者用local環境から分離したCodex専用Emulator seedとAuth・Firestore Rulesの4件の基盤testを追加した。Functions、Storage/Realtime Database Rules、UI、外部サービスの回帰testは未完了であり、公式進捗は加点しない。
- 調査完了は問題の特定証拠であり、修正、test、運用受入れの完了証拠ではない。そのため公式進捗は10%のままとする。
- 詳細な問題、台帳対応、要判断事項は[2026-08-12 source review統合記録](../implementation/review-reconciliation-2026-08-12.md)を参照する。

### ガバナンス基準線の完了ゲート

- [x] G1: 必須成果物（作業規則、文書案内、現行仕様、ロードマップ、ADR索引、運用手順、開始プロンプト、変更履歴、専門エージェント設定）が存在し、索引から到達できる。
- [x] G2: `.codex/config.toml` と全専門エージェントTOMLを正式なTOMLパーサーで解析し、必須キー、型、エージェント名、sandbox modeを検証できる。
- [x] G3: Markdown相対リンク、GitHub互換見出しアンカー、重要文書の索引到達性を機械検証できる。
- [x] G4: ADR本文と索引の状態、ロードマップの重み、得点、無部分加点、索引進捗を機械検証できる。
- [x] G5: 独立レビューの指摘を反映し、ガバナンス検証、陰性試験、PowerShell構文確認、`git diff --check` が成功する。

## 次の作業

1. Critical security問題を利用者が仕様理解できる最小segmentへ分け、remote dataに触れないEmulator/contract test計画、現行の攻撃・失敗経路、Rules/Functions/modelの変更契約、互換性、rollback、陰性testを1件ずつ決める。application codeは利用者が原則実装し、Codexは設計、差分review、許可済み検証、document、local Gitを担当する。
2. OperationResultの管制側編集lockと権限境界をRules・model・UIで強制する修正案を作り、Billing/勤怠/履歴同期、rounding、notificationの回帰testとreconcile設計を確定する。
3. Admin backup/restoreの正式scope、RPO/RTO、operator、artifact保護、復旧演習条件について利用者判断を得る。
4. 共通UIのdisabled強制、single-flight、draft conflict、非同期latest-wins、date-time/accessibilityをtest可能な契約へ整理する。
5. ルートアプリとCloud Functionsの依存関係脆弱性を、破壊的な自動修正を行わず調査する。

## 成果物と検証証拠

| マイルストーン | 設計・判断 | 実装 | テスト・レビュー・環境受入れ |
|---|---|---|---|
| ガバナンスと現行仕様 | [ADR 0001](../decisions/0001-governance-and-specification-source.md)、[ADR 0011](../decisions/0011-roadmap-and-codex-session-lifecycle.md)、[ADR 0013](../decisions/0013-managed-governance-reconstruction.md) | 文書・`.codex/` 設定 | `scripts/check-project-docs.ps1`、`scripts/check-governance.ps1` |
| 主要業務とデータ整合性 | [ADR 0003](../decisions/0003-operation-result-billing-integrity.md)、[現行仕様](../specification.md) | 関連画面、モデル、Functions | 関連テスト、試験運用受入れ（未完了） |
| 認証・認可・テナント分離 | [ADR 0002](../decisions/0002-multitenant-firebase-architecture.md)、[ADR 0014](../decisions/0014-codex-dedicated-local-test-data.md) | Rules、認証・管理者処理、Codex専用local基盤 | セキュリティレビュー、Auth・Firestore基盤test、User更新Auth同期と有効化・無効化Callableの会社・UID・actor境界単体test。実Callable/Emulatorと残る認証問題の回帰検証は未完了 |
| 運用信頼性と外部連携 | [運用・開発手順](../operations.md) | 通知、Storage、Stripe、バックアップ設定 | 障害経路・復旧確認（未完了） |
| 利用者受入れとマニュアル | [画面マニュアル](../manual/index.md) | 対象画面 | 認証済みUI検証、利用者確認（未完了） |
| 正式運用移行判定 | [現行仕様](../specification.md) | 未確定 | 移行・復旧演習、利用者承認（未完了） |

## 未解決問題

- invitation/account setup、User documentとglobal Auth UID、Callable actor/tenant、同一tenant内field権限、SecurityReport Storageの認可不備。
- OperationResultの管制側編集lock・権限強制、agreementなしresult、Billing status、請求書snapshot、同時更新、勤怠・履歴・report indexの部分失敗と再構築。
- FireModelのprocess-global context、full-set/upsert、serialization、validation、client/server adapter差。
- 通知の重複、FCM token lifecycle/log、ArrangementNotification日時・状態遷移。
- UI managerのdisable非強制、二重送信、draft競合、入力debounce、非同期stale response、date-time、accessibility。
- Admin backup/restoreのcoverage、平文artifact/credential、operator権限、監査、rollback/resume、migration例外。
- npm依存関係の脆弱性と互換性を保つ更新方法。
- Stripe本番運用、キャンセル、プラン、従業員数制限。
- remote/Emulator/browser/real dataによる検証、監視、SLA、保持期間、復旧目標、試験運用受入れ証拠。

## 要判断事項

1. 正式なrole・permission matrixと、管理Callable・super-user・developerのactor/tenant境界。
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
