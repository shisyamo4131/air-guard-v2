# Firebase Storage でのファイル管理

AirGuardV2 でのファイル管理には Firebase Storage を利用する。

## 基本方針

- Firestore ドキュメントへの URL 保存は行わない。ファイルの取得は Storage の `listAll()` で行う。
- Cloud Functions による Firestore ドキュメントの更新は行わない（書き込みコスト抑制、トリガー連鎖の回避）。
- ファイル名は `crypto.randomUUID()` で生成した UUID を使用し、競合を回避する。

## ユーティリティー

### ファイルアップロード

- `uploadBytes` を使用する。
- アップロード時の `customMetadata` に `uploadedBy: currentUser.uid` を含める。
- アップロード前に `browser-image-compression` で圧縮する。

### ファイル一覧取得

- `listAll()` を使用する。
- `listAll()` は対象ディレクトリ内のファイルの `StorageReference`（名前・パス情報）を返す。実ファイルのバイナリは含まない。
- ダウンロード URL が必要な場合は、各 `StorageReference` に対して `getDownloadURL()` を呼ぶ。
- ファイルの並び替えが必要な場合は `getMetadata()` の `timeCreated` を利用する。

### ファイル削除

- `deleteObject()` を使用する。
- 本体ファイルと対応するサムネイルを同時に削除する。

## ファイル管理対象

### 警備日報

> 詳細な設計・実装方針は [definition_security_reports.md](./definition_security_reports.md) を参照。

#### 概要

- 下番報告時に警備員が写真をアップロードする。
- 1 つの現場稼働に対して原則 1 枚。5 名超の場合は複数枚になる場合がある。
- Firestore ドキュメントへの URL 保存は行わない。

#### Storage パス

```
Companies/${companyId}/Operations/${operationId}/SecurityReports/${uuid}.jpg
Companies/${companyId}/Operations/${operationId}/SecurityReports/${uuid}_thumb.jpg
```

- テナント分離のため、Firestore と同様に `Companies/${companyId}` をルートとする。
- `operationId` は `SiteOperationSchedule.docId` または `OperationResult.docId`（両者は同一の値）。
- `SiteOperationSchedule` を持たない直接作成の `OperationResult` の場合は `OperationResult.docId` を使用する。
- 本体ファイル：`${uuid}.jpg`
- サムネイル：`${uuid}_thumb.jpg`（Cloud Functions が自動生成）

#### アップロード処理（クライアント）

1. `browser-image-compression` で圧縮する。
2. `crypto.randomUUID()` でファイル名を生成する。
3. `uploadBytes()` でアップロードする。`customMetadata` に `uploadedBy: currentUser.uid` を付与する。
4. `companyId` は `useAuthStore` から取得する。

#### ファイル一覧取得（管制室）

1. `listAll()` で対象ディレクトリのファイル一覧を取得する。
2. `_thumb` を含まないファイルを本体として扱う。
3. `getMetadata()` の `timeCreated` を使って作成日時昇順で並び替える。
4. `getDownloadURL()` でダウンロード URL を取得して表示する。

#### サムネイル（Cloud Functions）

- トリガー：`onObjectFinalized`
- 対象：`Operations/{operationId}/SecurityReports/` 配下かつファイル名に `_thumb` を含まないファイル
- 処理：`${uuid}_thumb.jpg` として同一ディレクトリに保存する。
- Firestore への書き込みは行わない。

#### 個別削除（管制室）

- `deleteObject()` で本体 `${uuid}.jpg` とサムネイル `${uuid}_thumb.jpg` を削除する。

#### 自動削除（Cloud Functions）

日報の自動削除は Firestore ドキュメントの削除トリガーで行う。詳細は [definition_security_reports.md](./definition_security_reports.md) を参照。

- `SiteOperationSchedule.onDelete`：`operationResultId === null` の場合のみ `Operations/{docId}/SecurityReports/` を全削除する。
- `OperationResult.onDelete`：`Operations/{docId}/SecurityReports/` を全削除する。

## セキュリティルール

```
match /Companies/{companyId}/Operations/{operationId}/SecurityReports/{file} {
  allow read, write: if request.auth != null;
}
```

## 実装タスク

> **前提**
>
> - `firebase/storage` は `firebase ^11.8.1` に含まれており、`$storage` インスタンスは `plugins/01.firebase.init.js` で既に提供済み。
> - `browser-image-compression` はインストール済み。

### フェーズ1：基盤整備

- [x] `browser-image-compression` をインストールする。
- [x] `utils/storage.js` を作成し、以下の関数を実装する。
  - `uploadSecurityReport(operationId, file)` — 圧縮・UUID生成・`uploadBytes` を行い、`StorageReference` を返す。
  - `listSecurityReports(operationId)` — `listAll` + `_thumb` フィルタリング + `getMetadata` による日時ソートを行い、`StorageReference[]` を返す。
  - `deleteSecurityReport(ref)` — 本体と `_thumb` を `deleteObject` で削除する。
- [x] `storage.rules` に警備日報用セキュリティルールを追加してデプロイする。
- [ ] **【要対応】** `utils/storage.js` の Storage パスを `SiteOperationSchedules/{id}` から `Operations/{id}` に変更する。
- [ ] **【要対応】** `storage.rules` のパスを `Operations/{operationId}` に更新する。

### フェーズ2：Cloud Functions（サムネイル生成）

- [x] `functions/modules/securityReports.js` に `onObjectFinalized` トリガーの関数を実装する。
- [ ] **【要対応】** サムネイル生成トリガーの対象パス正規表現を `Operations/{operationId}/SecurityReports/` に更新する。

### フェーズ3：Cloud Functions（自動削除トリガー）

- [ ] `SiteOperationSchedule.onDelete` トリガーを実装する。
  - `operationResultId === null` の場合のみ `Operations/{docId}/SecurityReports/` を全削除する。
- [ ] `OperationResult.onDelete` トリガーを実装する。
  - `Operations/{docId}/SecurityReports/` を全削除する。
  - `siteOperationScheduleId` が存在する場合は、対応する `SiteOperationSchedule` を削除する。

### フェーズ4：下番報告フォームへの組み込み

- [ ] `ArrangementNotificationManagerToLeaved`（下番報告フォーム）に写真アップロード UI を追加する。
  - ファイル選択・プレビュー表示。
  - `utils/storage.js` の `uploadSecurityReport` を呼び出す。
  - アップロードは `toLeaved()` の実行と同時に行う（どちらかが失敗した場合のエラーハンドリングを考慮）。

### フェーズ5：管制室での確認画面

- [ ] 日報写真確認コンポーネントを作成する。
  - `listSecurityReports` でサムネイル一覧を表示する（サムネイル未生成時は代替アイコンを表示）。
  - サムネイルをタップするとオリジナル画像をフルスクリーン表示する。
  - 管制室ユーザーが個別削除できるボタンを配置する（`deleteSecurityReport` を呼び出す）。
