# 警備日報（SecurityReport）設計・実装方針

## 概要

警備日報は、警備員が下番報告時に写真をアップロードするものであり、Firebase Storage に保存される。  
警備日報は **稼働単位（現場稼働予定または稼働実績）** に紐づけて管理される。

---

## ドキュメントの関係

### SiteOperationSchedule（現場稼働予定）

- 稼働日前にユーザーが作成する。
- 稼働実績作成後、`operationResultId` プロパティに作成された `OperationResult` の `docId` が記録される。
- `operationResultId` の値は**自身の `docId` と同一**（`syncToOperationResult` メソッドの仕様）。
- 既定日数（60日）が経過するとデイリータスクにより削除される（`operationResultId` の有無を問わない）。
  - 理由：稼働実績未作成のまま放置されたスケジュールも自動的に削除する必要があるため。

### OperationResult（稼働実績）

- `SiteOperationSchedule.syncToOperationResult()` で作成された場合、`docId` はベースとなった `SiteOperationSchedule` と**同一**。
- `siteOperationScheduleId` プロパティにベースとなった `SiteOperationSchedule` の `docId` を保持する。
- ベースとなる `SiteOperationSchedule` が存在しない「直接作成」ケースも運用上ありうる。

---

## Storage パス

```
Companies/{companyId}/Operations/{operationId}/SecurityReports/{uuid}.jpg
Companies/{companyId}/Operations/{operationId}/SecurityReports/{uuid}_thumb.jpg
```

### パス設計の根拠

- `SiteOperationSchedule` と `OperationResult` は同じ `docId` を共有するため、`operationId` としてその共通 `docId` を使用することで**同一のディレクトリを参照**できる。
- ディレクトリ名を `SiteOperationSchedules` ではなく `Operations` としたのは、直接作成された稼働実績（スケジュールを持たない）の日報も同一の構造で管理するためであり、セマンティック上も「稼働に紐づく日報」として自然な名称である。

### 直接作成された稼働実績の場合

- `siteOperationScheduleId` は null となる。
- 稼働実績の `docId` をそのまま `operationId` として `Operations/{docId}/SecurityReports/` に保存する。

---

## 日報の削除ロジック

### SiteOperationSchedule.onDelete トリガー

| 条件                                         | 処理                                                              |
| -------------------------------------------- | ----------------------------------------------------------------- |
| `operationResultId === null`（実績未作成）   | `Operations/{docId}/SecurityReports/` を全削除                    |
| `operationResultId !== null`（実績作成済み） | **何もしない**（日報は OperationResult のライフサイクルに委ねる） |

**理由：** 実績作成済みのスケジュールはデイリータスクで削除されるが、その時点で日報は実績に紐づいて現役である。スケジュール削除によって日報が消えるべきではない。

### OperationResult.onDelete トリガー

| 処理                                                                                                        |
| ----------------------------------------------------------------------------------------------------------- |
| `Operations/{docId}/SecurityReports/` を全削除                                                              |
| `siteOperationScheduleId` が存在する場合は、該当 `SiteOperationSchedule` を削除する（存在しない場合は無視） |

**注意：** `SiteOperationSchedule` の削除により `SiteOperationSchedule.onDelete` が発火するが、この時点では `operationResultId` が設定されているため日報削除は行われない（`OperationResult.onDelete` 側で削除済み）。

### デイリータスク（maintenance.js）

- `cleanUpSiteOperationSchedules` の処理は**変更不要**。
- `SiteOperationSchedule.onDelete` トリガーが日報の連鎖削除を担うため、デイリータスク側に Storage 操作を追加する必要はない。

---

## 全ケース検証

| ケース                                                  | 経路                                                                                                                     | 日報の結果   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------ |
| スケジュールのみ存在、実績未作成 → デイリータスクで削除 | デイリータスク → `SiteOperationSchedule.onDelete`（`operationResultId === null`） → 日報削除                             | ✓ 削除される |
| 実績作成済みスケジュール → デイリータスクで削除         | デイリータスク → `SiteOperationSchedule.onDelete`（`operationResultId !== null`） → 何もしない                           | ✓ 保持される |
| ユーザーが実績を削除（スケジュールあり）                | `OperationResult.onDelete` → 日報削除 → `SiteOperationSchedule` 削除 → `onDelete` 発火するが日報は既に削除済みのため無害 | ✓ 削除される |
| ユーザーが実績を削除（スケジュールなし・直接作成）      | `OperationResult.onDelete` → 日報削除（`siteOperationScheduleId === null` のため SiteOperationSchedule 削除はスキップ）  | ✓ 削除される |
| ユーザーがスケジュールを手動削除（実績未作成）          | `SiteOperationSchedule.onDelete`（`operationResultId === null`） → 日報削除                                              | ✓ 削除される |

---

## 実装タスク

### フェーズ1：Storage パス変更

- [x] `utils/storage.js` の Storage パスを `SiteOperationSchedules/{id}/SecurityReports` から `Operations/{id}/SecurityReports` に変更する。
- [x] `composables/storage/useSecurityReports.js` の引数名を `scheduleId` から `operationId` に変更する。
- [x] `storage.rules` のパスを更新する。
- [x] Cloud Functions `securityReports.js`（サムネイル生成トリガー）のパス正規表現を更新する。

### フェーズ2：Cloud Functions トリガー追加

- [x] `SiteOperationSchedule.onDelete` トリガーを実装する。（`functions/modules/operationCleanup.js`）
  - `operationResultId === null` の場合のみ `Operations/{docId}/SecurityReports/` を全削除する。
- [x] `OperationResult.onDelete` トリガーを実装する。（`functions/modules/operationCleanup.js`）
  - `Operations/{docId}/SecurityReports/` を全削除する。
  - `siteOperationScheduleId` が存在する場合は、対応する `SiteOperationSchedule` を削除する。

### フェーズ3：動作確認

- [x] エミュレーター環境で以下のケースを手動確認する。
  - 実績未作成スケジュールの手動削除 → 日報が削除されること。
  - 実績作成済みスケジュールのデイリータスク模擬削除 → 日報が保持されること。
  - 実績削除 → 日報が削除され、スケジュールも削除されること。
  - 直接作成された実績削除 → 日報が削除されること。
