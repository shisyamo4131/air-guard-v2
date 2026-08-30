# Company部分更新ロードマップ

- 状態: Active
- 開始日: 2026-08-30
- 現在の進捗: 0%
- 部分加点: なし
- 完了条件: Companyの全whole-document writerをoperation別の変更field保存へ移し、schema validation、actor/field境界、real-time競合表示、local自動検証、bounded Dev反映・利用者受入れまで完了する
- 正本: [現行仕様](../specification.md#company設定とtenant-lifecycle)、[ADR 0031](../decisions/0031-proportional-data-boundary-and-change-safeguards.md)

## 境界

このroadmapはCompany documentを無条件に分割しない。`AirItemManager`・`AirArrayManager`をproject全体から一括削除せず、Companyの基本情報、振込先、通常設定、既定取極め、表示順を独立したoperationとして段階移行する。

document共通validationはFireModel/Class schema、operation固有fieldと追加条件は共有operation contractを正本とする。画面は独立draftを編集し、保存前に最新Companyへ変更fieldを重ねて検証する。Firestoreへ保存するのは実際に変わったfieldと更新metadataだけとする。

単純な可逆更新はRulesで保存境界を完全に表現できる場合だけclient部分更新を選ぶ。複雑なvalidationや厳密なactor確認を要するoperationは専用Callableを使う。Dev deploy、remote検証、実data migrationは別のbounded承認を必要とする。

## マイルストーン

| マイルストーン | 重み | 得点 | 状態 | 完了証拠 |
|---|---:|---:|---|---|
| CPU-01 schema/editor境界の確定 | 10 | 0 | In progress | project rules、仕様、ADR、Company operation一覧、共通validationとdraft競合契約を確定する |
| CPU-02 Company基本情報の部分更新 | 20 | 0 | Not started | 専用editor/writer、管理者境界、変更fieldだけの保存、server timestamp、schema/operation validation、回帰testを完了する |
| CPU-03 振込先・通常設定の部分更新 | 20 | 0 | Not started | 2 operationを専用editor/writerへ移し、相関・enum・変更反映を検証する |
| CPU-04 取極め・表示順の部分更新 | 20 | 0 | Not started | `agreementsV2`、`siteOrder`、`scheduleOrder`のwriterを分離し、配列全体の対象fieldだけを更新する |
| CPU-05 旧Company writer除去・local受入れ | 15 | 0 | Not started | Company全体`set/update()` caller 0、Rules/Functions回帰、listener競合表示、主要画面再読込を確認する |
| CPU-06 bounded Dev反映・利用者受入れ | 15 | 0 | Not started | 承認済みreleaseでDevへ反映し、利用者受入れ、error確認、rollback確認を完了する |

重みは合計100。各マイルストーンは記載した証拠がすべて揃った場合だけ加点する。

## 現在の次工程

1. CPU-01の文書契約を確定する。
2. CPU-02としてCompany基本情報を最初のoperationにし、Class schemaを使う独立draft editorと、変更fieldだけを保存する専用Callableを実装する。
3. 同じoperation所有fieldのclient直接更新をRulesで拒否し、既存の未移行Company writerは対象外fieldだけを継続できる移行境界を作る。
4. local自動検証後、振込先・通常設定へ同じ構造を展開する。Dev反映は別承認とする。

## 進捗履歴

| 日付 | 進捗 | 変更 | 根拠 |
|---|---:|---:|---|
| 2026-08-30 | 0% | 0 | AirItemManager/AirArrayManagerをFirestore CRUDの既定から外し、schema validationを維持したoperation固有editorへ段階移行する方針を利用者が採用した。実装・local受入れ・Dev反映は未完了。 |
