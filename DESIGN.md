# AirGuard v2 設計ドキュメント

> このドキュメントは、AirGuard v2 の設計思想、基本設計、現在の仕様を記録したものです。
> 新規チャットセッションでの引継ぎ資料としても使用します。

## 目次

1. [アプリケーション概要](#アプリケーション概要)
1. [技術スタック](#技術スタック)
1. [アーキテクチャ](#アーキテクチャ)
1. [データモデル](#データモデル)
1. [ユーザー管理と認証](#ユーザー管理と認証)
1. [権限管理システム](#権限管理システム)
1. [ビジネスロジック](#ビジネスロジック)
1. [重要な設計判断](#重要な設計判断)

---

## アプリケーション概要

### 目的

警備業の業務をサポートするための Web アプリケーション。

### 主要機能

- **マスタデータ管理**: 取引先(Customer)、現場(Site)、従業員(Employee)、外注先(Outsourcer)
- **トランザクションデータ管理**: 現場稼働予定(SiteOperationSchedule)、稼働実績(OperationResult)
- **請求管理**: 稼働実績に基づく自動請求データ生成(Billing)
- **配置管理**: 従業員・外注先の配置と配置通知(ArrangementNotification)

### 対象ユーザー

- 警備会社の管理者・従業員
- マルチテナント対応（複数の会社での利用を想定）

---

## 技術スタック

### フロントエンド

- **フレームワーク**: Nuxt 3
- **UI ライブラリ**: Vuetify 3
- **状態管理**: Pinia
- **認証**: Firebase Authentication

### バックエンド

- **BaaS**: Firebase
  - Firestore (データベース) - **v9 モジュラー API を使用**
  - Cloud Functions (サーバーサイド処理) - **v2 を使用**
  - Authentication (認証)
  - Hosting (デプロイ)

### カスタムパッケージ

自作パッケージによる Firestore 操作の抽象化:

- `@shisyamo4131/air-firebase-v2`: FireModel ベースクラス
- `@shisyamo4131/air-firebase-v2-client-adapter`: クライアント側アダプター
- `@shisyamo4131/air-firebase-v2-server-adapter`: サーバー側アダプター
- `@shisyamo4131/air-guard-v2-schemas`: ドキュメントスキーマ定義

### コーディング規約

#### Firebase SDK のバージョン

- **クライアント側 (Nuxt アプリ)**: Firebase SDK v9 のモジュラー API を使用
  - 例: `import { collection, doc, addDoc } from 'firebase/firestore'`
  - 旧形式 (`db.collection().doc()`) は使用しない
- **サーバー側 (Cloud Functions)**: Firebase Functions v2 を使用
  - 例: `import { onRequest } from 'firebase-functions/v2/https'`
  - 旧形式 (`functions.https.onRequest()`) は使用しない

---

## アーキテクチャ

### データベース構造

#### Firestore コレクション構造

```
Companies (ルートコレクション)
├── {companyId}
│   ├── Users (サブコレクション)
│   ├── Customers (サブコレクション)
│   │   └── {customerId}
│   ├── Sites (サブコレクション)
│   │   └── {siteId}
│   ├── Employees (サブコレクション)
│   ├── Outsourcers (サブコレクション)
│   ├── SiteOperationSchedules (サブコレクション)
│   ├── OperationResults (サブコレクション)
│   ├── ArrangementNotifications (サブコレクション)
│   ├── Billings (サブコレクション)
│   └── ... (その他のサブコレクション)
│
System (ルートコレクション)
└── system (メンテナンスモード管理用)
```

#### マルチテナント設計

- `Companies`コレクションがルートコレクション
- 各会社のデータは独立したサブコレクションとして管理
- データセグメントは`companyId`によって実現
- Firestore Security Rules でカスタムクレームの`companyId`を検証

### スキーマ設計原則

#### クラス階層

```
BaseClass (air-firebase-v2)
└── FireModel (air-firebase-v2)
    ├── WorkingResult (抽象クラス)
    │   ├── Agreement (取極め)
    │   └── Operation (抽象クラス)
    │       ├── OperationResult (稼働実績)
    │       └── SiteOperationSchedule (現場稼働予定)
    ├── OperationDetail (抽象クラス)
    │   ├── OperationResultDetail (稼働実績詳細)
    │   └── SiteOperationScheduleDetail (現場稼働予定詳細)
    │       └── ArrangementNotification (配置通知)
    ├── Customer (取引先)
    ├── Site (現場)
    ├── Employee (従業員)
    ├── Outsourcer (外注先)
    ├── User (ユーザー)
    ├── Company (会社)
    └── Billing (請求)
```

#### FireModel の役割

- Firestore への CRUD 処理を抽象化
- クライアント側とサーバー側でコードを共有
- アダプターパターンで異なる SDK の差異を吸収

#### BaseClass の役割

- FireModel の継承元で Firestore に依存しない基本機能を提供
- データの初期化、バリデーション、シリアライゼーション

---

## データモデル

- データモデルの詳細は実際のクラス定義を参照
- @shisyamo4131/air-guard-v2-schemas パッケージを利用
- アプリ側でのオーバーライドが必要な場合があるため、@/schemas/index.js でインポート・エクスポート

### 主要エンティティ

#### Customer (取引先)

- 取引先情報
- 入金サイト情報を保有する

**重要な仕様:**

- 入金サイトは請求データ初回作成時に参照される
- 既存の請求データには影響しない
- 支払期日の計算: `getPaymentDueDateAt(baseDate)`メソッドで算出

#### Site (現場)

- 現場情報
- Customer : Site ＝ 1 : N

**重要な仕様:**

- `customer`プロパティは更新不可（`beforeUpdate`でチェック）
- Customer ドキュメントが更新されると Cloud Functions で `customer` プロパティが同期される。
- 取引先の変更は過去の請求実績に影響するため禁止
- `customerId`は`customer.docId`から取得可能

#### Agreement (取極め)

WorkingResult を継承。現場ごとの料金設定を管理。

**キーとなるプロパティ:**

- `key`: `${date}-${dayType}-${shiftType}`で一意に識別
- `date`: `dateAt`から生成される YYYY-MM-DD 形式の文字列

**取極めの判定ロジック:**

```javascript
// Site.getAgreement(args)メソッド
getAgreement({ date, dayType, shiftType }) {
  return this.agreements
    .filter(agr => agr.dayType === dayType && agr.shiftType === shiftType)
    .sort((a, b) => b.date.localeCompare(a.date))
    .find(agr => agr.date <= date) || null;
}
```

- 稼働日、曜日区分、勤務区分が一致する取極めから最も新しいものを選択
- 適用開始日が稼働日以前のものが対象

#### Employee (従業員)

| 項目               | 型           | 桁数 | 必須 | 備考                                       |
| ------------------ | ------------ | ---- | ---- | ------------------------------------------ |
| 従業員コード       | 文字列       | 10   |      | 利用者の環境に合わせて自由入力             |
| 姓                 | 文字列       | 20   | ○    |                                            |
| 名                 | 文字列       | 20   | ○    |                                            |
| セイ               | 文字列       | 40   | ○    | カタカナのみ                               |
| メイ               | 文字列       | 40   | ○    | カタカナのみ                               |
| 表示名             | 文字列       | 6    | ○    | アプリ上で表示する名前                     |
| 性別               | 文字列       | -    | ○    | { MALE: '男性', FEMALE: '女性' }           |
| 生年月日           | 日付         | -    | ○    |                                            |
| 郵便番号           | 文字列       | 7    | ○    |                                            |
| 都道府県コード     | 文字列       | 2    | ○    | 都道府県はコードで保有                     |
| 市区町村           | 文字列       | 10   | ○    |                                            |
| 町域名・番地       | 文字列       | 15   | ○    |                                            |
| 建物名・階数       | 文字列       | 30   |      |                                            |
| ロケーション       | オブジェクト | -    |      | 非表示項目                                 |
| 携帯番号           | 文字列       | 13   | ○    |                                            |
| メールアドレス     | 文字列       | 50   |      |                                            |
| 入社日             | 日付         | -    | ○    |                                            |
| 状態               | 文字列       | -    | ○    | { ACTIVE: '在職中', TERMINATED: '離職済' } |
| 肩書・役職         | 文字列       | 20   |      |                                            |
| 退職日             | 日付         | -    |      |                                            |
| 外国籍             | フラグ       | -    |      |                                            |
| 本名               | 文字列       | 50   |      | 外国籍の場合は必須                         |
| 国籍               | 文字列       | 50   |      | 外国籍の場合は必須                         |
| 在留資格           | 文字列       | 10   |      | 外国籍の場合は必須                         |
| 在留期間満了日     | 日付         | -    |      | 外国籍の場合は必須                         |
| 警備員登録有無     | フラグ       | -    |      | 警備員登録の有無                           |
| 警備員登録日       | 日付         | -    |      | 警備員登録ありの場合は必須                 |
| 血液型             | 文字列       | 2    |      | 警備員登録ありの場合は必須                 |
| 緊急連絡先氏名     | 文字列       | 20   |      | 警備員登録ありの場合は必須                 |
| 緊急連絡先続柄     | 文字列       | 6    |      | 警備員登録ありの場合は必須                 |
| 緊急連絡先続柄詳細 | 文字列       | 20   |      | 警備員登録ありの場合は必須                 |
| 緊急連絡先住所     | 文字列       | 20   |      | 警備員登録ありの場合は必須                 |
| 緊急連絡先電話番号 | 文字列       | 13   |      | 警備員登録ありの場合は必須                 |
| 本籍地             | 文字列       | 30   |      | 警備員登録ありの場合は必須                 |
| 警備保有資格       | 配列         | -    |      | 警備員としての保有資格                     |
| 備考               | 文字列       | 200  |      |                                            |

#### Outsourcer (外注先)

#### SiteOperationSchedule (現場稼働予定)

Operation を継承。現場の稼働予定と配置を管理。

**重要な仕様:**

- 稼働日から 60 日が経過すると自動削除 (Cloud Functions)
- 配置通知(ArrangementNotification)の作成元

#### ArrangementNotification (配置通知)

SiteOperationScheduleDetail を継承。従業員への配置通知と実績記録。

**docId の仕様:**

- `${siteOperationScheduleId}-${workerId}`で固定
- ドキュメントの再作成が可能

**状態遷移:**

- `ARRANGED` → `CONFIRMED` → `ARRIVED` → `LEAVED`
- 各状態への遷移には専用メソッドを使用
- 直接`update()`は使用不可

#### OperationResult (稼働実績)

Operation を継承。実際の稼働実績と売上計算。

**計算プロパティ:**

```javascript
// 統計情報
statistics: {
  base: { quantity, regularTimeWorkMinutes, overtimeWorkMinutes, ... },
  qualified: { quantity, regularTimeWorkMinutes, overtimeWorkMinutes, ... },
  total: { ... }
}

// 売上情報
sales: {
  base: { unitPrice, quantity, regularAmount, overtimeAmount, total },
  qualified: { unitPrice, quantity, regularAmount, overtimeAmount, total }
}

salesAmount: number,    // 売上金額（税抜）
tax: number,            // 消費税
billingAmount: number,  // 請求金額（税込）
billingDate: string,    // YYYY-MM-DD
billingMonth: string,   // YYYY-MM
hasAgreement: boolean,
isInvalid: string|false // 検証結果
```

**取極めの自動適用:**

- `beforeCreate`: 新規作成時に自動適用
- `beforeUpdate`: `key`が変更された場合に再適用
- `Site.getAgreement({ date, dayType, shiftType })`で取得

**ロック機能:**

- `isLocked: true`の場合、更新・削除が不可能
- 稼働請求管理で確定した実績を保護

#### Billing (請求)

- operationResults プロパティ（配列）に OperationResult ドキュメントデータが同期される。
- operationResults プロパティ（配列）に保存されているデータから各種金額などを計算。

**計算プロパティ:**

```javascript
billingDate: string,      // YYYY-MM-DD
billingMonth: string,     // YYYY-MM
paymentDueDate: string,   // YYYY-MM-DD
paymentDueMonth: string,  // YYYY-MM
subtotal: number,         // 小計（税抜）
taxAmount: number,        // 消費税額
totalAmount: number,      // 合計（税込）
summary: object[]         // 明細サマリー
```

**自動更新の仕組み (Cloud Functions):**

`functions/modules/billings.js`のトリガー関数:

```javascript
onOperationResultChange = onDocumentWritten(
  "Companies/{companyId}/OperationResults/{docId}",
  async (event) => { ... }
)
```

**処理フロー:**

1. **OperationResult 作成時:**
   - `isInvalid`が false の場合のみ処理
   - Billing ドキュメントが存在しなければ新規作成
     - Customer から入金サイトを取得して`paymentDueDateAt`を計算
   - `operationResults`配列に追加

2. **OperationResult 更新時:**
   - 有効/無効の状態変化を判定
   - `billingDate`が変更された場合は別の Billing へ移動（トランザクション処理）
   - 同じ Billing 内の更新は該当要素を置き換え

3. **OperationResult 削除時:**
   - Billing の`operationResults`配列から削除
   - 配列が空になったら Billing ドキュメントも削除

**Billing ドキュメントの自動生成:**

- OperationResult が作成されると自動的に Billing が生成される
- docId は`${customerId}-${siteId}-${billingDate}`
- 締日ごと、現場ごとに Billing が作成される

---

## 権限管理システム

### 権限システムの構成要素

#### 1. useRolePresets (composables/useRolePresets.js)

プリセット役割と権限の定義:

```javascript
ROLE_PRESETS = {
  manager: {
    // 部長・所長
    permissions: [
      "customers:write",
      "sites:write",
      "employees:write",
      "outsourcers:write",
      "site-operation-schedules:write",
      "operation-results:write",
      "billings:write",
    ],
  },
  controller: {
    // 管制
    permissions: [
      "customers:read",
      "sites:write",
      "employees:read",
      "outsourcers:read",
      "site-operation-schedules:write",
      "operation-results:write",
    ],
  },
  accountant: {
    // 経理
    permissions: [
      "customers:read",
      "sites:read",
      "employees:read",
      "outsourcers:read",
      "operation-results:read",
      "operation-billings:write",
      "billings:write",
    ],
  },
  "human-resource": {
    // 人事
    permissions: [
      "customers:read",
      "sites:read",
      "employees:write",
      "operation-results:read",
    ],
  },
  labor: {
    // 労務
    permissions: [
      "customers:read",
      "sites:read",
      "employees:read",
      "operation-results:read",
    ],
  },
  legal: {
    // 法務
    permissions: ["customers:write", "sites:write", "employees:read"],
  },
};
```

**権限の自動付与:**

- `write` → `read`の自動付与
- 例: `"sites:write"` → `["sites:write", "sites:read"]`

#### 2. useAuthStore (stores/useAuthStore.js)

認証状態と権限チェック:

```javascript
// 計算プロパティ
roles: computed(() => {
  const result = [...(userInstance.roles || [])];
  if (isSuperUser.value) result.push('super-user');
  if (userInstance.isAdmin) result.push('admin');
  return result;
})

// メソッド
hasRole(role): boolean        // 役割の保持チェック
hasPermission(permission): boolean // 権限チェック
```

#### 3. ナビゲーションガード (middleware/auth.global.js)

ページ遷移時の権限チェック:

```javascript
// ページごとの権限設定を pageSettings.js で定義
// 権限がない場合はダッシュボードへリダイレクト
```

### 役割ごとの権限マトリックス

| リソース       | manager  | controller | accountant | human-resource | labor   | legal    |
| -------------- | -------- | ---------- | ---------- | -------------- | ------- | -------- |
| **取引先**     | ✏️ write | 👁️ read    | 👁️ read    | 👁️ read        | 👁️ read | ✏️ write |
| **現場**       | ✏️ write | ✏️ write   | 👁️ read    | 👁️ read        | 👁️ read | ✏️ write |
| **従業員**     | ✏️ write | 👁️ read    | 👁️ read    | ✏️ write       | 👁️ read | 👁️ read  |
| **外注先**     | ✏️ write | 👁️ read    | 👁️ read    | -              | -       | -        |
| **配置管理**   | ✏️ write | ✏️ write   | -          | -              | -       | -        |
| **稼働実績**   | ✏️ write | ✏️ write   | 👁️ read    | 👁️ read        | 👁️ read | -        |
| **稼働請求**   | ✏️ write | -          | ✏️ write   | -              | -       | -        |
| **取引先請求** | ✏️ write | -          | ✏️ write   | -              | -       | -        |

### 特別な役割

| 役割         | 説明             | 権限                        | 設定方法                       |
| ------------ | ---------------- | --------------------------- | ------------------------------ |
| `admin`      | 管理者           | すべての権限 + ユーザー管理 | 会社登録時に自動設定、移譲可   |
| `super-user` | スーパーユーザー | すべての権限 + テスト機能   | Admin SDK で設定（開発者のみ） |

---

## ビジネスロジック

### 取極めの適用

#### 自動適用のタイミング

1. **OperationResult 作成時** (`beforeCreate`)
2. **OperationResult 更新時** (`beforeUpdate`) ※ key が変更された場合のみ

#### 適用ロジック

```javascript
// OperationResult._syncCustomerIdAndApplyAgreement()
async _syncCustomerIdAndApplyAgreement() {
  if (!this.siteId) return;
  const siteInstance = new Site();
  await siteInstance.fetch({ docId: this.siteId });
  this.customerId = siteInstance.customerId;
  this.agreement = siteInstance.getAgreement(this);
}
```

```javascript
// Site.getAgreement({ date, dayType, shiftType })
getAgreement(args) {
  const { date, dayType, shiftType } = args;
  return this.agreements
    .filter(agr => agr.dayType === dayType && agr.shiftType === shiftType)
    .sort((a, b) => b.date.localeCompare(a.date))
    .find(agr => agr.date <= date) || null;
}
```

**判定の流れ:**

1. 稼働日(`date`)、曜日区分(`dayType`)、勤務区分(`shiftType`)が一致する取極めを抽出
2. 適用開始日(`dateAt`)の降順でソート
3. 稼働日以前の最も新しい取極めを選択

### 締日と請求日の計算

#### 請求締日の計算

```javascript
// OperationResult.refreshBillingDateAt()
refreshBillingDateAt() {
  if (!this.dateAt || !this.agreement ||
      (this.agreement.cutoffDate !== 0 && !this.agreement.cutoffDate)) {
    this.billingDateAt = null;
    return;
  }
  this.billingDateAt = CutoffDate.calculateBillingDateAt(
    this.dateAt,
    this.agreement.cutoffDate
  );
}
```

**締日の種類:**

- `0`: 月末締め
- `1-31`: 各日締め

#### 支払期日の計算

```javascript
// Customer.getPaymentDueDateAt(baseDate)
getPaymentDueDateAt(baseDate) {
  // 1. baseDateに入金サイト（月数）を加算
  // 2. paymentDateが月末なら月末日、それ以外は指定日
  // 3. 指定日が存在しない場合は月末
}
```

**入金サイトの設定:**

- `paymentMonth`: 月数（例: 1 = 翌月）
- `paymentDate`: 日付（0=月末、1-31=各日）

### 消費税の計算

#### 基本方針

- 稼働実績の日付から適用税率を判定
- 請求書内の税率別税抜売上合計に対して消費税を計上
- 端数処理は`RoundSetting`に従う

#### 計算ロジック

```javascript
// OperationResult.taxRate (computed)
get taxRate() {
  return Tax.getRate(this.date);
}
```

```javascript
// Tax.calc(amount, date)
calc(amount, date) {
  // 日付に基づいて税率を判定（8% or 10%）
  // RoundSettingに従って端数処理
}
```

### 売上の計算

#### 統計情報の集計

```javascript
// OperationResult.statistics (computed)
statistics: {
  base: {
    quantity: number,               // 基本人工数
    regularTimeWorkMinutes: number, // 通常労働時間
    overtimeWorkMinutes: number,    // 残業時間
    totalWorkMinutes: number,       // 総労働時間
    breakMinutes: number,           // 休憩時間
    ojt: { ... }                    // OJTの内訳
  },
  qualified: { ... },               // 資格者の内訳
  total: { ... }                    // 合計
}
```

#### 売上金額の計算

```javascript
// OperationResult.sales (computed)
sales: {
  base: {
    unitPrice: number,              // 単価
    quantity: number,               // 数量（人工 or 時間）
    regularAmount: number,          // 通常売上
    overtimeUnitPrice: number,      // 残業単価
    overtimeMinutes: number,        // 残業時間
    overtimeAmount: number,         // 残業売上
    total: number                   // 合計
  },
  qualified: { ... }
}
```

**請求単位の違い:**

- **日単位 (PER_DAY)**:
  - `quantity` = 人数
  - 休憩時間は無関係

- **時間単位 (PER_HOUR)**:
  - `quantity` = 総労働時間 / 60
  - `includeBreakInBilling: true`の場合、休憩時間も加算

#### 調整数量の使用

`useAdjustedQuantity: true`の場合:

- `adjustedQuantityBase` / `adjustedQuantityQualified`
- `adjustedOvertimeBase` / `adjustedOvertimeQualified`

を使用して売上を計算。

### 上下番確定処理

現場稼働予定から稼働実績への変換プロセス。

#### 処理フロー

```
1. 現場稼働予定(SiteOperationSchedule)を選択
   ↓
2. 配置通知(ArrangementNotification)の有無を確認
   ↓
3-A. 配置通知がある場合:
     - actualStartTime, actualEndTime, actualBreakMinutes を使用
   ↓
3-B. 配置通知がない場合:
     - 現場稼働予定の startTime, endTime, breakMinutes を使用
   ↓
4. OperationResultを作成
   - agreement は beforeCreate で自動適用
     (Site.getAgreement({ date, dayType, shiftType }))
   - 取極めが存在しない場合は agreement: null
   - billingDateAt は agreement があれば自動計算、なければ null
   ↓
5. OperationResultの検証
   - agreement が null の場合、isInvalid: 'EMPTY_AGREEMENT'
   - billingDateAt が null の場合、isInvalid: 'EMPTY_BILLING_DATE'
   - isInvalid が true の場合、Billingドキュメントには反映されない
   ↓
6. Billingドキュメントの自動更新 (Cloud Functions)
   - isInvalid: false の場合のみ Billing に反映
   - isInvalid: true の場合はスキップされる
```

#### 取極めが存在しない場合の対応

**現在の仕様:**

- OperationResult の作成自体は可能（エラーにならない）
- `agreement: null`、`isInvalid: 'EMPTY_AGREEMENT'`の状態で作成される
- Billing ドキュメントには反映されない

**請求管理での対応:**

- 稼働請求管理画面で個別に取極めを設定・変更可能
- 取極めを設定すると`isInvalid: false`になる
- `isInvalid`が`false`になった時点で Billing ドキュメントに反映される

**allowEmptyAgreement フラグ:**

- `allowEmptyAgreement: true`に設定すると、取極めなしでも有効とみなされる
- 売上に連動しない稼働実績の記録用

### 配置通知の状態管理

#### 状態遷移

```
ARRANGED (配置済み)
   ↓
CONFIRMED (確認済み)
   ↓
ARRIVED (上番)
   ↓
LEAVED (下番)
```

#### 各状態への遷移メソッド

```javascript
// ArrangementNotification
toArranged(); // 予定時間で初期化
toConfirmed(); // 確認日時を記録
toArrived(); // 上番日時を記録
toLeaved(); // 下番日時を記録、実際の勤務時間を記録
```

**注意点:**

- 直接`update()`は使用不可
- 状態遷移メソッドを使用すること

---

## 重要な設計判断

### 1. 現場の取引先は変更不可

**理由:**

- 過去の請求実績に影響が及ぶ
- 誤操作による実績改変をフォロー不可能
- 代わりに`OperationResult.customerId`を持たせることで開発効率が向上

**実装:**

```javascript
// Site.beforeUpdate()
async beforeUpdate() {
  if (this.customer.docId !== this._beforeData.customer.docId) {
    throw new Error('Not allowed to change customer reference.');
  }
}
```

### 2. 稼働実績の現場変更は可能

**理由:**

- 現場稼働予定はあくまで予定
- 実際の稼働が異なるケースに対応

**制約:**

- `isLocked: true`の場合は変更不可

### 3. 取極めは自動適用だが、なくてもエラーにしない

**理由:**

- ユーザーが選択する方式では運用負荷が高い
- 明確な判定ロジックで自動適用可能
- 取極めが未設定でも稼働実績の記録は必要

**実装:**

- OperationResult 作成時に取極めを自動適用（`beforeCreate`）
- 取極めが存在しない場合は`agreement: null`で作成
- `isInvalid: 'EMPTY_AGREEMENT'`となり、Billing には反映されない
- 請求管理画面で後から取極めを設定・変更可能

**例外:**

- `allowEmptyAgreement: true`で取極めなしを許容
- 売上に連動しない稼働実績の記録用

### 4. 消費税率は稼働実績ごと、消費税額は請求書・税率ごとに計算

**理由:**

- 稼働実績の日付に応じた税率変更へ対応できる
- 適格請求書単位・税率単位で端数処理できる

**メリット:**

- 現場別請求書と取引先統合請求書を、それぞれ独立した請求書単位で計算できる

### 5. 入金サイトは変更可能だが既存データには影響しない

**理由:**

- 契約中に入金サイトが変更されるケースがある
- 過去の実績は変更する必要がない

**実装:**

- Billing ドキュメント初回作成時のみ Customer の入金サイトを参照
- 既存の Billing は手動で個別変更

### 6. マルチテナントアーキテクチャ

**理由:**

- 複数の会社での利用を想定
- データの完全な分離が必要

**実装:**

- Companies ルートコレクション
- Firestore Security Rules でカスタムクレームを検証
- クライアントコードで`FireModel.setConfig({ prefix: 'Companies/${companyId}' })`

### 7. 管理者アカウントは削除不可

**理由:**

- 会社の管理者が誤って削除されることを防ぐ
- 管理者権限の移譲機能を提供

**実装:**

```javascript
// User.delete()
async delete() {
  if (this.isAdmin) {
    throw new Error('Administrator accounts cannot be deleted.');
  }
  await super.delete();
}
```

### 8. OperationResult のロック機能

**理由:**

- 稼働請求管理で確定した実績を保護
- 誤った編集・削除を防止

**実装:**

```javascript
// OperationResult.beforeUpdate() / beforeDelete()
if (this.isLocked) {
  throw new Error("This OperationResult is locked...");
}
```

---

## 開発ガイドライン

### コンポーザブルの利用定義

1. 特定の汎用コンポーネントに機能を注入する位置づけで作成
2. マスタデータの取得はコンポーネント内で条件を定義してよい
3. トランザクションデータは外部から条件を受け取り、`set`関数で取得開始
4. 複数機能の複合は、コンポーザブルを統合せず個別にセットアップ

### 環境変数と環境管理

- `.env` (本番)
- `.env.local` (ローカル開発)
- `.env.development` (テスト環境)

**使用方法:**

```bash
# package.json
npm run generate:prod  # --dotenv .env
npm run generate:dev   # --dotenv .env.development
```

### デプロイ手順

```bash
# 1. コンパイル
npm run generate:prod  # or generate:dev

# 2. デプロイ
firebase deploy

# デプロイ先の切り替え
firebase use <project-alias>
```

### 動的な高さとスクロールバー

```vue
<template>
  <v-container class="fill-height">
    <v-row class="fill-height">
      <v-col class="d-flex flex-column fill-height">
        <v-list class="overflow-y-auto">
          <!-- コンテンツ -->
        </v-list>
      </v-col>
    </v-row>
  </v-container>
</template>
```

**ポイント:**

- 最終的なスクローラブル要素に`overflow-y-auto`
- 親要素から先祖要素まですべてに高さが指定されていること

---

## Stripe 決済統合

### 概要

従業員数に応じた月額課金制のサブスクリプションモデル。

### 基本仕様

#### 課金タイミング

- **管理者サインアップ時**: Stripe 顧客は作成しない
- **初回サブスクリプション登録時**: Stripe 顧客を自動作成し、`Company.stripeCustomerId`を保存
- **無料トライアル**: 30 日間

#### 顧客タイプ (customerType)

`useAuthStore.customerType`で判定:

- **`'free'`**: サブスクリプション未契約（従業員登録上限: 5 名）
- **`'paid'`**: 有効なサブスクリプション契約中（`status: 'active'` or `'trialing'`）
- **`'expired'`**: 期限切れまたはキャンセル済み（`status: 'canceled'`, `'past_due'`, `'unpaid'`）

### データモデル

#### Company スキーマ拡張

```javascript
stripeCustomerId: String  // Stripe Customer ID
subscription: {
  id: String | null,              // Subscription ID
  status: String | null,          // active, trialing, canceled, etc.
  currentPeriodEnd: Timestamp | null,  // 次回更新日
  employeeLimit: Number           // プランごとの従業員上限
}
```

#### Firestore 構造

```
Companies/{companyId}
  └── StripeData (サブコレクション)
      └── {sessionId} (Checkout Sessionドキュメント)
          - price: string
          - success_url: string
          - cancel_url: string
          - sessionUrl: string (Cloud Functionが設定)
          - customerId: string (Cloud Functionが設定)
          - error: object | null
```

### 実装構成

#### Cloud Functions

**`functions/modules/stripe.js`**:

1. **`onCreateCheckoutSession`** (Firestore Trigger)
   - トリガー: `Companies/{companyId}/StripeData/{sessionId}`の作成
   - 処理:
     - `Company.stripeCustomerId`の確認
     - 未設定の場合: Stripe 顧客を新規作成
     - Checkout Session を作成
     - `sessionUrl`をドキュメントに保存

2. **`webhooks`** (HTTPS Callable)
   - エンドポイント: `/webhooks`
   - 処理イベント:
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
   - 処理内容: `syncCompanySubscription()`で`Company.subscription`を更新

#### フロントエンド

**`pages/settings/checkout.vue`**:

- サブスクリプション登録画面
- `StripeData`サブコレクションにドキュメント作成
- `onSnapshot`で`sessionUrl`の更新を監視
- 取得後、Stripe 決済ページにリダイレクト

**`stores/useAuthStore.js`**:

- `customerType` computed property 追加
- `Company.subscription`の状態から自動判定

### セキュリティ設定

#### Firestore Security Rules

```javascript
match /Companies/{companyId}/StripeData/{docId} {
  allow read: if (isAuthenticated() && userCompanyId() == companyId) || isSuperUser();
  allow create: if (isAuthenticated() && userCompanyId() == companyId) || isSuperUser();
  allow update, delete: if false;  // Cloud Functionsのみ
}
```

#### 環境変数管理

| 環境         | ファイル                  | 用途                                 |
| ------------ | ------------------------- | ------------------------------------ |
| **ローカル** | `functions/.secret.local` | STRIPE_SECRET, STRIPE_WEBHOOK_SECRET |
| **DEV/PROD** | Firebase Secret Manager   | 同上                                 |

**ローカル開発時の Webhook**:

```powershell
stripe listen --forward-to http://127.0.0.1:5001/{project-id}/asia-northeast1/webhooks
```

### 実装状況

#### ✅ 完了

- Company スキーマ拡張（v1.3.0）
- `stripe.js`実装（Webhook + Checkout Session 作成）
- `useAuthStore.customerType`実装
- `checkout.vue`実装
- Firestore Security Rules 設定
- ローカル環境でのテスト完了

#### ⏳ 保留（後日実施）

- DEV/PROD 環境へのデプロイ
- Firebase Secret Manager へのキー登録
- Stripe Dashboard での本番 Webhook エンドポイント登録
- プラン選択 UI（現在は 1 プランのみ）
- サブスクリプションキャンセル機能
- 従業員数制限のエンフォースメント

### API Keys

- **公開可能キー**: 不要（Stripe Checkout Session 使用のため）
- **シークレットキー**: Cloud Functions で使用
- **Webhook シークレット**: Webhook 署名検証に使用

---

## 補足事項

### メンテナンスモード

- `System/system`ドキュメントの`isMaintenance`フラグで制御
- SDK から切り替え可能
- プラグイン(`07.system.js`)が監視
- ナビゲーションガードで`/maintenance`へリダイレクト

### pdfMake

- VFS フォントデータの読み込みに時間がかかる
- 遅延読み込み(lazy loading)を推奨

### 今後の実装予定

1. **User.employeeId**
   - Employee マスタとの紐付け
   - 従業員への通知機能

2. **ArrangementNotification の通知機能**
   - プッシュ通知
   - LINE 通知

3. **Billing の入金管理**
   - `paymentRecords`配列の実装

---

## まとめ

このドキュメントは、AirGuard v2 の設計思想と現在の実装状況を記録したものです。
新しいチャットセッションでこのドキュメントを参照することで、開発の一貫性を保ち、効率的にコーディングを進めることができます。

**重要な原則:**

- 確証がない事項は必ず確認する
- 勝手な判断による仕様変更を避ける
- 段階的に質問し、一度に 3 つまでの質問に留める

## git の使い方

作業ブランチ作成
git switch -c refact/worktimebase

変更をコミット
git add .
git commit -m "Refactor WorkingResult to WorkTimeBase"

リモートへpush
git push -u origin refact/worktimebase

dev公開（バージョン加算 + publish を一発）
npm run dev:publish

利用側プロジェクトでdevをインストール
npm i @shisyamo4131/air-guard-v2-schemas@dev

動作確認後、mainへマージ
git switch main
git pull origin main
git merge --no-ff refact/worktimebase
git push origin main

main側でもdevを更新公開したい場合のみ
npm run dev:publish

利用側で再インストール
npm i @shisyamo4131/air-guard-v2-schemas@dev
