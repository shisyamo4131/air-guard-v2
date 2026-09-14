# FGA-06 稼働実績一覧CREATE標準client保存 Dev反映・受入れ記録

- Checkpoint: `FGA-06-RESULT-CREATE-CLIENT-08`
- 実施日: 2026-09-14（Asia/Tokyo）
- 製品commit: `c171b593`
- release commit: `65a10bde5caf653bfb8f2fdad0064425ae3f8b49`
- GitHub Actions: [Dev deployment 34817237903](https://github.com/shisyamo4131/air-guard-v2/actions/runs/34817237903)
- 状態: Dev反映、会社管理者sessionによる一覧CREATE・詳細遷移・物理削除・見た目受入れ完了

## Release境界

- Projectは`air-guard-v2-dev`、databaseは`(default)`、Firestore Standard edition / Native mode、locationは`asia-northeast1`とread-onlyで確認した。
- selectorは`firestore,functions,hosting`を選択した。GitHub Actionsの固定Dev設定、`generate:dev`、Functions依存導入、鍵なし認証、Firebase CLI `15.29.0`、dry-run、実deployはすべて成功した。
- release classはclient／server contract同時変更とRulesを含むserver境界。schemaとmigrationはなく、既存dataの一括変更、maintenance、snapshotは不要と判断した。
- data作用はCodex専用tenantの合成OperationResult 1件の作成と削除だけで、受入れ後の2026年9月一覧は0件へ戻した。既存Siteは参照だけに使い、変更・削除していない。

## Release前検証

製品commit後に製品source・Rules・Functions・testへ変更がないため、[Local検証記録](fga-06-result-create-client-local.md)のdomain 1,447件、Local Emulator 178件、専用UI buildを再利用した。release commitに対して次を個別実行し、いずれもexit status 0を確認した。

| gate / command | 結果 | exit status |
|---|---|---:|
| `npx -y firebase-tools@latest --version` | `15.30.0`を確認 | 0 |
| `npx -y firebase-tools@latest firestore:databases:get "(default)" --project air-guard-v2-dev --json`（allowlist fieldだけをprocess内出力） | Standard / Native / `asia-northeast1`を確認 | 0 |
| `pwsh -NoProfile -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` | 316 Markdown、72 ADR、12 roadmaps、8 TOML pass | 0 |
| `pwsh -NoProfile -File scripts/test-project-docs-check.ps1` | negative fixtures pass | 0 |
| `pwsh -NoProfile -File scripts/test-codex-session-size.ps1` | 7 checks pass | 0 |
| `pwsh -NoProfile -File scripts/check-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2` | managed hashes・生成AGENTS・policy整合 pass | 0 |
| `git diff --check` | errorなし | 0 |

## Dev受入れ

通常CRUDはroleで差を設けない確定仕様のため、利用者判断に従い会社管理者sessionだけで確認した。

1. 稼働実績一覧の既存追加buttonから、既存の合成Site、2026年9月14日、日勤、08:00〜17:00、休憩1時間、規定実働8時間、必要人数1人を入力して保存した。
2. 保存成功後に稼働実績詳細へ遷移し、取引先・現場・日付・勤務区分・定時・休憩・規定実働・必要人数が入力値どおり表示された。
3. 作成dialogは既存の幅・入力・button配置を維持し、詳細画面の基本情報、作業員、稼働外売上、物理削除buttonにも意図しない見た目変更がないことを確認した。
4. 承認後、既存確認dialogから合成OperationResultを物理削除した。稼働実績一覧へ戻り、2026年9月が0件であることを確認した。

## Triggerとcleanup

- `onOperationResultChange`のDevログで、今回の合成OperationResultに対応する作成イベントと削除イベントを確認した。両イベントは情報ログとして記録され、その後に当該合成OperationResultのerrorは記録されていない。
- Trigger成功は処理入口の実行証拠である。Billing、DailyAttendance、DailyOperationsByEmployee、SiteEmployeeHistoryの派生document全件をremoteから直接列挙する確認は行っていない。
- 合成OperationResultは削除済みであり、受入れ用に新たな残存dataはない。

## 残存risk・対象外

- 同一tenantの有効な本登録UserがSDKを直接使う場合、通常業務field全体のshape・sizeをRulesで重複検査しない既知の受容境界は変わらない。
- locked実績、他tenant、未認証、無効・仮User、Site／Customer archive競合の拒否経路はLocal Emulatorを正とし、Devで破壊的に再実行していない。
- 稼働実績複製、稼働外売上、請求、lock、予定、通知、実績化、Prodは本受入れの対象外である。

## Rollback

製品commit `c171b593`をrevertし、承認済みの標準release経路でFirestore Rules、Functions、Hostingを再反映する。schema変更とmigrationはない。rollback実行とProd操作は別承認を要する。
