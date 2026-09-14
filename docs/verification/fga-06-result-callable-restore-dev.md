# FGA-06 稼働実績Callable復元 Dev反映・受入れ記録

- Checkpoint: `FGA-06-RESULT-DELETE-CLIENT-06`、`FGA-06-RESULT-CALLABLE-RESTORE-07`
- 実施日: 2026-09-14（Asia/Tokyo）
- 初回release commit: `a32fd8dcafa27e9bc5fc2a2800d71cc8caf3e00f`
- 作業員初期値補正commit: `8d90d5d1218e4bd7697d5900725f8fce6c3af881`
- 状態: Dev反映、会社管理者sessionによる通常CRUD・物理削除・見た目受入れ完了

## 反映範囲

- 稼働実績の基本情報と作業員配列を、`OperationResultManager`／`WorkersManager`、Air Manager、model標準client保存へ戻した。
- 後から追加された実績編集用writer、Employee存在確認transaction、再読込handler、実績`overview`／`workers`／`delete` Callable入力と、通常更新に重複していたRulesの参照存在確認を撤去した。
- 稼働実績の物理削除は標準client deleteとし、関連data連携は既存Triggerへ維持した。
- このDev記録の対象では実績作成・複製、稼働外売上、請求、lock、予定、通知、実績化、schema、migration、既存data一括変更、Prodは変更していない。後に一覧CREATEの見落としが判明し、作成経路は`FGA-06-RESULT-CREATE-CLIENT-08`として別checkpointで補正する。

## GitHub Actions結果

- [初回Dev deployment](https://github.com/shisyamo4131/air-guard-v2/actions/runs/34805743656)はFirestore Rules、Functions、Hostingを反映し、成功した。
- 初回受入れで、作業員追加時に親実績の勤務初期値を引き継がない不具合を確認した。過去repositoryの`WorkersManager`接続と現行component契約を照合し、詳細画面から日付・現場・勤務区分・開始・終了・翌日開始・規定実働・休憩の8値を渡す補正を行った。
- [補正Dev deployment](https://github.com/shisyamo4131/air-guard-v2/actions/runs/34807993191)はHostingだけを反映し、成功した。Functions依存導入はselectorによりskipされた。

## 補正後の検証

補正commitに対して次を個別実行し、いずれもexit status 0を確認した。

| command | 結果 | exit status |
|---|---|---:|
| `node --test test/domain/operation-editor.test.mjs` | 35/35 pass | 0 |
| `node --test test/domain/*.test.mjs` | 1446/1446 pass | 0 |
| `npm run test:local` | 179/179 pass | 0 |
| `npm run test:local:ui:build` | client／server build成功 | 0 |
| `pwsh -NoProfile -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` | 314 Markdown、72 ADR、12 roadmaps、8 TOML pass | 0 |
| `git diff --check` | errorなし | 0 |

## 認証済みChromeによるDev受入れ

利用者が用意したCodex専用tenantの会社管理者sessionで、合成dataだけを使用して次を確認した。通常CRUDはroleで差を設けない確定仕様のため、統括accountでの重複確認は利用者判断により省略した。

1. 合成OperationResultを作成し、基本情報を表示した。
2. 既存の合成Employeeを作業員へ追加した。入力dialogが親実績の開始08:00、終了17:00、休憩1.0時間、規定実働8.0時間を引き継ぎ、保存後の一覧に同じ値と残業0時間が表示された。
3. 作業員のOJTを有効に更新し、再読込後の編集dialogでも有効状態が保持された。
4. 作業員を削除し、再読込後の一覧が空であることを確認した。
5. 合成OperationResultを既存の確認dialogから物理削除し、2026年9月の稼働実績一覧が0件であることを確認した。
6. 基本情報card、日報、作業員toolbar・table・入力dialog、稼働外売上一覧、物理削除button・確認dialogに意図しない見た目変更がないことを確認した。

## Trigger確認とCleanup

- 作成、作業員追加、OJT更新、作業員削除、実績物理削除の各操作に対応する`onOperationResultChange`イベントをDevログで確認した。補正後の合成実績に対するイベント後にerrorは記録されていない。
- 作業員削除後は画面再読込でも作業員0件、実績削除後は一覧0件を確認した。合成OperationResultは削除済みである。
- Triggerログの成功を関連処理の実行証拠とする。請求・日次勤怠・勤務回数・現場従業員履歴等の派生document全件をremoteから直接列挙する確認は行っていない。
- 既存の合成Siteと合成Employeeはこの受入れで作成したdataではないため、変更・削除していない。

## 残存riskと対象外

- 同一tenantの有効な本登録UserがRulesを直接使う場合、通常業務fieldの完全なshapeをRulesで重複検査しない既知riskは残る。[Local検証記録](fga-06-result-callable-restore-local.md)の受容境界を変更しない。
- locked実績の拒否、他tenant、未認証等の拒否経路はLocal Emulatorを正とし、Devで破壊的に再実行していない。
- 実績作成は後続の08で標準client保存へ補正する。実績複製、稼働外売上、請求、lock、予定に残るCallableの要否は後続checkpointで操作ごとに判定する。

## Rollback

補正を含む現在の製品状態から直前のmain `a32fd8dcafa27e9bc5fc2a2800d71cc8caf3e00f`へ戻すと作業員初期値の不具合が再発する。FGA-06稼働実績Callable復元全体を戻す場合は、各製品commitのrevertを作成し、Firestore Rules、Functions、Hostingを承認済みrelease手順で再反映する。schema変更とmigrationはない。rollback実行と環境操作は別承認を要する。
