# PWA 化と Firebase Cloud Messaging（FCM）による通知機能の実装定義

> 作成日: 2026年4月16日  
> 最終更新日: 2026年6月4日  
> 更新履歴:
>
> - 2026年6月4日: Notification/onNotificationCreated によるプッシュ通知アーキテクチャへ移行
> - 2026年6月4日: ArrangementNotification から notificationSentAt/notificationError を削除
> - 2026年6月4日: sendMulticastNotification を 500 件チャンク分割対応に改修
> - 2026年5月13日: Service Worker を FCM 専用に簡素化（Workbox 完全削除）
> - 2026年5月13日: Firebase Hosting によるキャッシュ制御とSPAルーティングを実装
> - 2026年5月13日: 白画面問題およびキャッシュ更新問題を解決
> - 2026年4月28日: ArrangementNotification プッシュ通知機能実装完了
> - 2026年4月28日: FcmToken グローバルコレクションへの移行完了（User.fcmTokens廃止）
>
> 目的: ArrangementNotification 作成時にユーザーへプッシュ通知を送信する機能の実装

## 目次

1. [概要](#概要)
2. [実装方針](#実装方針)
3. [データモデル](#データモデル)
4. [実装ファイル構成](#実装ファイル構成)
5. [実装完了状況](#実装完了状況)
6. [未実装機能（Notification コレクション）](#未実装機能notification-コレクション)

---

## 概要

### 背景

- ArrangementNotification ドキュメント作成時に、該当する従業員（Employee）に通知を送りたい
- LINE 連携は企業側の管理者に技術的な設定負担が大きすぎる
- Firebase Cloud Messaging（FCM）を使うことで、企業側の設定不要で実装可能

### 要件

1. ArrangementNotification ドキュメントが作成されたら、内容に従って通知を送信
2. ArrangementNotification には `employeeId` フィールドがあり、Employee ドキュメントの ID と一致
3. User ドキュメントにも `employeeId` フィールドがあり、Employee と紐づいている
4. User ドキュメントの `docId` は Firebase Authentication の UID と一致
5. 通知にはリンクがあり、タップしたらアプリを起動して該当ページを表示

### メリット

✅ **企業管理者の設定不要** - Firebase プロジェクト内で完結  
✅ **マルチテナント対応** - すべての企業が同じ仕組みを使用  
✅ **PWA と親和性が高い** - Service Worker でプッシュ通知を受信  
✅ **リンククリックでアプリ起動** - 通知からアプリへスムーズに遷移  
✅ **開発が簡単** - LINE より遥かにシンプル

---

## 実装方針

### FCM の仕組み

```
1. ユーザーがアプリを開く
   ↓
2. Service Worker が FCM トークンを取得
   ↓
3. FcmToken ドキュメントを作成（FcmTokens/{token}）
   - ドキュメントID = トークン
   - 同じトークンが存在する場合は uid を上書き
   ↓
4. ArrangementNotification 作成
   ↓
5. onArrangementNotificationCreated が Notification ドキュメントを作成
   ↓
6. onNotificationCreated が recipientUserIds → FcmToken 検索
   ↓
7. Cloud Functions が FCM でプッシュ通知送信（500件チャンク分割）
   ↓
8. ユーザーのデバイスに通知が届く
   ↓
9. 通知をタップ → PWA アプリが起動
```

### アーキテクチャ

```
[フロントエンド (Nuxt + PWA)]
├── Service Worker (firebase-messaging-sw.js)
│   └── バックグラウンド通知受信
├── Composable (useNotification.js)
│   ├── 通知許可リクエスト
│   ├── FCM初期化（動的インポート）
│   └── FcmToken ドキュメント作成
└── Store (useAuthStore.js)
    └── ログイン時のトークン登録呼び出し

[Firestore]
├── FcmTokens/{token}  ← グローバルコレクション
│   ├── token: string
│   ├── uid: string
│   ├── companyId: string
│   └── updatedAt: Date
├── Companies/{companyId}/Users/{userId}
│   └── uid: string  (Firebase Authentication UID)
├── Companies/{companyId}/ArrangementNotifications/{notificationId}
└── Companies/{companyId}/Notifications/{notificationId}
    ├── title, body, imageUrl, data
    ├── recipientUserIds: string[]
    ├── status: pending / processing / completed / failed
    ├── successCount, failureCount
    ├── sourceType: arrangement / manual / ...
    ├── sourceId: string
    └── Recipients/{userId}  ← サブコレクション
        ├── status: pending / sent / failed
        ├── sentAt: Date
        └── error: string

[Cloud Functions]
├── onArrangementNotificationCreated
│   └── Notification ドキュメントを作成（sourceType: "arrangement"）
└── onNotificationCreated
    ├── recipientUserIds → FcmToken 検索
    ├── Recipients サブコレクション作成
    ├── FCM 送信（500件チャンク分割）
    ├── 無効トークン削除
    └── 送信結果を Notification/Recipients に記録
```

---

## データモデル

### FcmToken グローバルコレクション（2026年4月28日実装）

**従来の問題点:**

User ドキュメントの `fcmTokens` 配列で FCM トークンを管理していた方式には以下の問題がありました:

1. **同一デバイスでの複数ユーザーログイン問題**
   - ユーザーA がデバイス X でログイン → User A に token X を保存
   - ユーザーB が同じデバイス X でログイン → User B に token X を保存
   - 結果: token X が User A と User B の両方に存在
   - **問題**: ユーザーA宛の通知がユーザーBのデバイスに届く

2. **マルチテナント環境での問題**
   - 同一トークンが `Companies/A/Users/{uid}` と `Companies/B/Users/{uid}` の両方に存在
   - Company A の通知が Company B のユーザーに届く可能性

**解決策: FcmToken グローバルコレクション**

```
FcmTokens/{token}  ← グローバルコレクション（Companies 配下ではない）
├── token: string        (ドキュメントID = トークンそのもの)
├── uid: string          (Firebase Authentication UID)
├── companyId: string    (マルチテナント対応)
└── updatedAt: Date      (最終更新日時)
```

**メリット:**

✅ **トークンの一意性保証**: 同じトークン = 同じドキュメント  
✅ **自動上書き**: 同じデバイスで別ユーザーがログイン → uid が上書きされる  
✅ **マルチテナント対応**: companyId でフィルタリング可能  
✅ **セキュリティ**: Firestore ルールで自分の uid のみ作成可能

**Firestore セキュリティルール:**

```javascript
match /FcmTokens/{token} {
  allow create, update: if isAuthenticated()
                        && request.resource.data.uid == request.auth.uid;
  allow delete: if isAuthenticated()
                && resource.data.uid == request.auth.uid;
  allow read: if false; // Cloud Functions only
}
```

**トークン登録フロー:**

```javascript
// useNotification.js - registFCMToken()
const fcmToken = new FcmToken();
fcmToken.token = currentToken;
fcmToken.uid = userInstance.uid;
fcmToken.companyId = userInstance.companyId;
await fcmToken.create({ docId: currentToken }); // ドキュメントID = トークン
```

**通知送信フロー:**

```javascript
// ArrangementNotifications.js
// 1. employeeId → User 検索 → uid 取得
const usersSnapshot = await db
  .collection(`Companies/${companyId}/Users`)
  .where("employeeId", "==", employeeId)
  .get();

// 2. uid → FcmToken 検索
for (const userDoc of usersSnapshot.docs) {
  const fcmTokensSnapshot = await db
    .collection("FcmTokens")
    .where("uid", "==", userDoc.data().uid)
    .where("companyId", "==", companyId)
    .get();

  fcmTokensSnapshot.docs.forEach((doc) => {
    allTokens.push(doc.id); // ドキュメントID = トークン
  });
}

// 3. 通知送信
await sendMulticastNotification(allTokens, notification, data);
```

**データ構造:**

```
FcmTokens/{token}
├── token: string        (ドキュメントID = トークン)
├── uid: string          (Firebase Auth UID)
├── companyId: string    (企業ID)
└── updatedAt: Date
```

**通知送信フロー:**

```
1. employeeId → Users 検索 → uid 取得
2. uid + companyId → FcmTokens 検索 → トークン取得
3. sendMulticastNotification で一括送信
4. 無効トークンは FcmTokens ドキュメントを削除
```

---

### ArrangementNotification

**2026年6月4日**: 通知送信状態フィールド（`notificationSentAt` / `notificationError`）を削除しました。  
送信結果は `Notifications` コレクションの `Notification` ドキュメントおよび `Recipients` サブコレクションで管理します。

---

## 実装ファイル構成

````
air-guard-v2/

```javascript
{
  title: {
    type: String,
    required: true,
    label: "通知タイトル",
  },
  body: {
    type: String,
    required: true,
    label: "通知本文",
  },
  imageUrl: {
    type: String,
    default: "",
    label: "画像URL",
    required: false,
  },
  data: {
    type: Object,
    default: () => ({}),
    label: "カスタムデータ",
    required: false,
  },
  recipientUserIds: {
    type: Array,
    default: () => [],
    label: "送信先ユーザーID",
    required: false,
  },
  totalCount: {
    type: Number,
    default: 0,
    label: "送信対象数",
    required: false,
  },
  successCount: {
    type: Number,
    default: 0,
    label: "送信成功数",
    required: false,
  },
  failureCount: {
    type: Number,
    default: 0,
    label: "送信失敗数",
    required: false,
  },
  status: {
    type: String,
    default: "pending",
    label: "送信ステータス",
    required: false,
  },
  sourceType: {
    type: String,
    default: "",
    label: "送信元タイプ",
    required: false,
  },
  sourceId: {
    type: String,
    default: "",
    label: "送信元ID",
    required: false,
  },
  createdBy: {
    type: String,
    default: "",
    label: "作成者",
  },
}
````

**サブコレクション（Recipients）のスキーマ**:

```javascript
{
  notificationId: {
    type: String,
    default: "",
    label: "通知ID",
    required: true,
  },
  userId: {
    type: String,
    default: "",
    label: "ユーザーID",
    required: true,
  },
  status: {
    type: String,
    default: "pending",
    label: "送信ステータス",
  },
  sentAt: {
    type: Date,
    default: null,
    label: "送信日時",
  },
  error: {
    type: String,
    default: "",
    label: "エラーメッセージ",
  },
}
```

**重要な設計ポイント**:

- **Notification クラス**: FireModel を継承
  - アプリ（管理者UI）から作成可能
  - hasMany 設定は不要（削除抑制が目的の機能のため）
- **NotificationRecipient クラス**: BaseClass を継承
  - FireModel の機能は使用しない
  - Cloud Functions のみが作成・更新
  - サブコレクションとして格納（`Recipients/{recipientId}`）
- **recipientUserIds**: 送信対象ユーザーIDのリスト
  - アプリ側で Notification 作成時に設定
  - Cloud Functions がこれを元に Recipients を作成

**ステータス値**:

- `pending`: 送信待ち
- `processing`: 送信中
- `sent`: 送信成功
- `failed`: 送信失敗
- `completed`: 全送信完了

**sourceType の例**:

- `manual`: 手動送信（UI から）
- `arrangement`: 配置通知
- `billing`: 請求通知
- など、拡張可能

---

### データフロー: Notification 作成から通知送信まで

#### 1. アプリ側（管理者UI）

```javascript
// Notification ドキュメントを作成
const notification = new Notification({
  title: "全従業員への通知",
  body: "明日の会議について",
  imageUrl: "https://...",
  data: { type: "meeting", meetingId: "xxx" },
  recipientUserIds: ["user1", "user2", "user3"], // 送信対象
  sourceType: "manual",
  createdBy: currentUser.uid,
});

await notification.create();
// → Firestore: Companies/{companyId}/Notifications/{notificationId} 作成
// → Cloud Functions: onNotificationCreated トリガー発火
```

#### 2. Cloud Functions: onNotificationCreated トリガー

```javascript
export const onNotificationCreated = onDocumentCreated(
  "Companies/{companyId}/Notifications/{notificationId}",
  async (event) => {
    const { companyId, notificationId } = event.params;
    const notificationData = event.data.data();
    const recipientUserIds = notificationData.recipientUserIds || [];

    // ステップ 2-1: Recipients サブコレクションを作成
    const batch = admin.firestore().batch();
    const notificationRef = admin
      .firestore()
      .doc(`Companies/${companyId}/Notifications/${notificationId}`);

    recipientUserIds.forEach((userId) => {
      const recipientRef = notificationRef.collection("Recipients").doc();
      batch.set(recipientRef, {
        notificationId,
        userId,
        status: "pending",
        sentAt: null,
        error: "",
      });
    });

    await batch.commit();
    // → Recipients ドキュメント作成完了

    // ステップ 2-2: ユーザーの fcmTokens を取得
    const userTokensMap = new Map(); // userId → tokens[]
    const tokenUserMap = new Map(); // token → userId

    for (const userId of recipientUserIds) {
      const userDoc = await admin
        .firestore()
        .doc(`Companies/${companyId}/Users/${userId}`)
        .get();

      const tokens = userDoc.data()?.fcmTokens || [];
      userTokensMap.set(userId, tokens);

      tokens.forEach((token) => {
        tokenUserMap.set(token, userId);
      });
    }

    const allTokens = Array.from(tokenUserMap.keys());

    // ステップ 2-3: 通知送信（sendMulticastNotification）
    const result = await sendMulticastNotification(
      allTokens,
      {
        title: notificationData.title,
        body: notificationData.body,
        imageUrl: notificationData.imageUrl,
      },
      notificationData.data,
    );
    // result = {
    //   successCount: 2,
    //   failureCount: 1,
    //   invalidTokens: ['token3'],
    //   responses: [
    //     { token: 'token1', success: true, messageId: 'xxx' },
    //     { token: 'token2', success: true, messageId: 'yyy' },
    //     { token: 'token3', success: false, error: 'invalid-token' },
    //   ]
    // }

    // ステップ 2-4: トークンごとの結果をユーザーごとに集計
    const userResults = new Map(); // userId → { success: boolean, error?: string }

    result.responses.forEach(({ token, success, error }) => {
      const userId = tokenUserMap.get(token);
      if (!userResults.has(userId)) {
        userResults.set(userId, { success, error });
      } else if (success) {
        // 1つでも成功すれば成功とする
        userResults.set(userId, { success: true });
      }
    });

    // ステップ 2-5: Recipients ドキュメントを更新
    const updateBatch = admin.firestore().batch();

    const recipientsSnapshot = await notificationRef
      .collection("Recipients")
      .where("notificationId", "==", notificationId)
      .get();

    recipientsSnapshot.docs.forEach((doc) => {
      const { userId } = doc.data();
      const userResult = userResults.get(userId) || {
        success: false,
        error: "No tokens",
      };

      updateBatch.update(doc.ref, {
        status: userResult.success ? "sent" : "failed",
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        error: userResult.error || "",
      });
    });

    // ステップ 2-6: Notification ドキュメントを更新
    updateBatch.update(notificationRef, {
      totalCount: recipientUserIds.length,
      successCount: result.successCount,
      failureCount: result.failureCount,
      status: "completed",
    });

    await updateBatch.commit();
    // → 送信結果が Firestore に反映完了
  },
);
```

#### 3. アプリ側（結果確認）

```javascript
// 管理者: 送信履歴の確認
const notifications = await Notification.fetchDocs({
  orderBy: [{ field: "createdAt", direction: "desc" }],
  limit: 20,
});

notifications.forEach((notification) => {
  console.log(
    `${notification.title}: ${notification.successCount}/${notification.totalCount} 送信成功`,
  );
});

// 詳細: Recipients の確認
const recipients = await admin
  .firestore()
  .collection(
    `Companies/${companyId}/Notifications/${notificationId}/Recipients`,
  )
  .get();

recipients.docs.forEach((doc) => {
  const data = doc.data();
  console.log(`${data.userId}: ${data.status} - ${data.error}`);
});

// ユーザー視点: 自分宛の通知を確認
const myNotifications = await admin
  .firestore()
  .collectionGroup("Recipients")
  .where("userId", "==", currentUserId)
  .orderBy("sentAt", "desc")
  .get();
```

---

**履歴の保持期間**:

- **90日間**（送信成功・失敗ともに）
- Cloud Scheduler + Cloud Functions で定期削除

**定期削除の実装**:

```javascript
// 毎日深夜3時に実行
export const cleanupOldNotifications = onSchedule(
  { schedule: "0 3 * * *", region: "asia-northeast1" },
  async () => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    const snapshot = await db
      .collectionGroup("Notifications")
      .where("status", "==", "completed")
      .where("createdAt", "<", cutoffDate)
      .get();

    // バッチ削除（親ドキュメントとサブコレクションの両方）
    const batches = [];
    let batch = db.batch();
    let count = 0;

    for (const doc of snapshot.docs) {
      // サブコレクション削除
      const recipients = await doc.ref.collection("Recipients").get();
      recipients.forEach((recipient) => {
        batch.delete(recipient.ref);
        count++;
        if (count === 500) {
          batches.push(batch.commit());
          batch = db.batch();
          count = 0;
        }
      });

      // 親ドキュメント削除
      batch.delete(doc.ref);
      count++;
      if (count === 500) {
        batches.push(batch.commit());
        batch = db.batch();
        count = 0;
      }
    }

    if (count > 0) {
      batches.push(batch.commit());
    }

    await Promise.all(batches);
  },
);
```

### 4. ユーザーが通知を受け取るまでの設定

**通知権限の状態**:

- `default`: 未設定（初回アクセス時）
- `denied`: 拒否済み（ユーザーがブラウザ設定で変更する必要あり）
- `granted`: 許可済み

**UI/UX 要件**:

- ユーザーがアプリケーション上で「通知を受け取る」という設定を可能にする
- UI はトグルで実装する
- トグルを操作されるとブラウザからユーザーに対してポップアップが開かれる（ブラウザ規定動作）
- このポップアップに対してユーザーが最終的な許可設定を行う
- ポップアップに対してユーザーが「`denied`」を選択した場合、以降はアプリケーション側からこのポップアップを開くことができない。ユーザー自身がブラウザの設定から操作する必要がある
- **重要**: 通知権限が `default` 以外になっている場合、アプリケーションをトリガーにした設定更新は不可能であるため、トリガー自体を操作不可能にすること

**実装上の注意点**:

- 一度「拒否」されてしまうと、ユーザー自身がブラウザで設定する必要があるため、UI については丁寧に作るべき
- 通知許可リクエストのタイミングと文言は慎重に検討すること

---

## 実装ステップ（完了済み）

すべての実装ステップは完了しました。詳細は「実装完了状況」セクションを参照してください。

### フロントエンド（Nuxt アプリ）

**package.json に追加**:

```json
{
  "dependencies": {
    "@vite-pwa/nuxt": "^0.10.0"
  }
}
```

**インストールコマンド**:

```bash
npm install @vite-pwa/nuxt
```

### バックエンド（Cloud Functions）

**必要なパッケージ**:

```json
{
  "dependencies": {
    "firebase-admin": "^12.7.0" // 既にインストール済み
  }
}
```

**確認**:

- `firebase-admin` は既にインストールされているため、追加インストール不要
- FCM 機能は `firebase-admin/messaging` モジュールに含まれる

---

## PWA 設定

### アーキテクチャの変更（2026年5月13日）

**旧実装（Workbox使用）の問題点:**

1. NavigationRoute が precached index.html を返す → 古いJSチャンクハッシュ → 404エラー → 白画面
2. Service Worker の更新検出に時間がかかる
3. モバイル端末で変更反映にハードリロードやアプリ再起動が必要

**新実装（FCM専用 + Firebase Hosting）:**

```
[HTTP Request]
    ↓
[Firebase Hosting]
    ├─ Cache-Control ヘッダー設定
    │   ├─ /_nuxt/** → 長期キャッシュ（immutable）
    │   ├─ /sw.js → キャッシュ無効
    │   └─ ** → キャッシュ無効
    ├─ SPA Rewrites (** → /index.html)
    └─ [Response]
         ↓
    [Service Worker]
    ├─ FCM Push Notifications
    ├─ PWA Installability
    └─ Fetch events は処理しない（素通し）
```

**メリット:**

✅ 白画面問題の解決（10秒以上 → 2-3秒の通常起動時間）  
✅ 変更が即座に反映（リロード1回で完了）  
✅ Service Worker がシンプルで保守しやすい  
✅ HTTP キャッシュと Service Worker の責務が明確

---

### firebase.json の設定

**ファイル:** `firebase.json`

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "headers": [
      {
        "source": "/_nuxt/**",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        "source": "/sw.js",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "no-cache, no-store, must-revalidate"
          }
        ]
      },
      {
        "source": "**",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "no-cache, no-store, must-revalidate"
          }
        ]
      }
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

**headers の役割:**

- `/_nuxt/**`: ハッシュ付きアセット（JS/CSS）は immutable で長期キャッシュ
- `/sw.js`: Service Worker ファイルは常に最新を取得
- `**`: index.html など他のファイルはキャッシュ無効

**rewrites の役割:**

- すべてのリクエストを `/index.html` にリダイレクト（SPA フォールバック）
- Service Worker の NavigationRoute が不要になる

---

### nuxt.config.js の変更

```javascript
import vuetify, { transformAssetUrls } from "vite-plugin-vuetify";

export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  devtools: { enabled: true },
  ssr: false,

  modules: [
    "@vite-pwa/nuxt", // ← PWA モジュール
    (_options, nuxt) => {
      nuxt.hooks.hook("vite:extendConfig", (config) => {
        config.plugins.push(vuetify({ autoImport: true }));
      });
    },
    "@pinia/nuxt",
  ],

  // PWA 設定（FCM とインストール機能のみ）
  pwa: {
    strategies: "injectManifest",
    srcDir: "service-worker",
    filename: "sw.js",
    // registerType を削除（自動更新は不要）
    manifest: {
      name: "AirGuard",
      short_name: "AirGuard",
      description: "警備業務管理アプリケーション",
      theme_color: "#1976D2",
      background_color: "#ffffff",
      display: "standalone",
      start_url: "/",
      icons: [
        {
          src: "/icon-192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/icon-512.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
    },
    injectManifest: {
      // プリキャッシュを無効化（Workbox 不使用）
      globPatterns: [],
      globIgnores: [],
      rollupOptions: {
        output: {
          format: "es",
        },
      },
    },
    devOptions: {
      enabled: true,
      type: "module",
    },
  },

  vite: {
    vue: {
      template: {
        transformAssetUrls,
      },
    },
    // Service Worker に環境変数を注入する Vite プラグイン
    plugins: [
      {
        name: "inject-firebase-config-to-sw",
        transform(code, id) {
          if (
            id.includes("service-worker/sw.js") ||
            id.includes("service-worker\\sw.js")
          ) {
            return code
              .replace(
                "__FIREBASE_API_KEY__",
                process.env.NUXT_PUBLIC_FIREBASE_API_KEY || "",
              )
              .replace(
                "__FIREBASE_AUTH_DOMAIN__",
                process.env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
              )
              .replace(
                "__FIREBASE_PROJECT_ID__",
                process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID || "",
              )
              .replace(
                "__FIREBASE_STORAGE_BUCKET__",
                process.env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
              )
              .replace(
                "__FIREBASE_MESSAGING_SENDER_ID__",
                process.env.NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
              )
              .replace(
                "__FIREBASE_APP_ID__",
                process.env.NUXT_PUBLIC_FIREBASE_APP_ID || "",
              );
          }
          return code;
        },
      },
    ],
  },

  // 既存の設定...
});
```

**重要な変更点:**

- `strategies: "injectManifest"` - カスタム Service Worker を使用
- `srcDir: "service-worker"`, `filename: "sw.js"` - Service Worker のパス
- `registerType` を削除 - 自動更新機能は不要
- `globPatterns: []` - Workbox のプリキャッシュを無効化
- Vite プラグインで環境変数を Service Worker に注入

---

### Service Worker の実装

**ファイル:** `service-worker/sw.js`

```javascript
/**
 * Service Worker for Push Notifications Only
 * Nuxt3 SPA + Firebase Hosting 構成
 *
 * このSWの役割:
 * - Firebase Cloud Messaging (プッシュ通知)
 * - PWA installability
 *
 * やらないこと:
 * - fetch event の intercept (Firebase Hosting rewrites に任せる)
 * - navigation request のキャッシュ (白画面の原因)
 * - 静的アセットのキャッシュ (HTTP cache で十分)
 */

import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging/sw";

/**
 * Firebase の設定
 * プレースホルダーはビルド時に環境変数に置換されます
 */
const firebaseConfig = {
  apiKey: "__FIREBASE_API_KEY__",
  authDomain: "__FIREBASE_AUTH_DOMAIN__",
  projectId: "__FIREBASE_PROJECT_ID__",
  storageBucket: "__FIREBASE_STORAGE_BUCKET__",
  messagingSenderId: "__FIREBASE_MESSAGING_SENDER_ID__",
  appId: "__FIREBASE_APP_ID__",
};

// Firebase 初期化
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Push イベント（Firebase SDK が自動処理）
self.addEventListener("push", (event) => {
  console.log("[SW] Push event received:", event);
});

// Notification click イベント
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked:", event);
  event.notification.close();
  event.waitUntil(clients.openWindow("/"));
});

// Install イベント（即座にアクティブ化）
self.addEventListener("install", (event) => {
  console.log("[SW] Installing...");
  self.skipWaiting();
});

// Activate イベント
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating...");
  event.waitUntil(clients.claim());
});
```

**重要なポイント:**

- ✅ **Workbox を使用しない** - Firebase SDK のみ
- ✅ **fetch イベントを処理しない** - Firebase Hosting rewrites に任せる
- ✅ **NavigationRoute を使用しない** - 白画面の原因だったため削除
- ✅ **プリキャッシュを使用しない** - HTTP キャッシュで十分
- ✅ **環境変数はビルド時に注入** - Vite プラグインで置換

---

### 必要なアイコン画像

**配置場所**: `public/`

- `icon-192.png` (192x192 px)
- `icon-512.png` (512x512 px)

**作成方法**:

- 既存の `logo.png` または `logo.svg` をリサイズして作成
- 正方形にトリミングすること

---

## 実装ファイル構成

```
air-guard-v2/
├── service-worker/
│   └── sw.js                             # Service Worker (FCM専用)
├── stores/
│   └── useAuthStore.js                   # ログイン時のトークン登録
├── composables/
│   └── useNotification.js                # FCM初期化・トークン登録
├── schemas/
│   └── index.js                          # FcmToken エクスポート
├── firestore.rules                       # セキュリティルール
├── firebase.json                         # Hosting設定（headers, rewrites）
├── public/
│   ├── icon-192.png, icon-512.png       # PWA アイコン
├── functions/modules/
│   ├── ArrangementNotifications.js       # Notification ドキュメント作成トリガー
│   └── utils/notifications.js            # 汎用送信モジュール + onNotificationCreated
└── air-guard-v2-schemas/src/
    ├── FcmToken.js                       # グローバルトークン管理
    ├── User.js                           # fcmTokens削除済み
    ├── ArrangementNotification.js        # notificationSentAt/notificationError削除済み
    ├── Notification.js                   # 通知管理ドキュメント
    └── NotificationRecipient.js          # 送信履歴サブコレクション
```

---

## 実装完了状況

**最終更新**: 2026年6月4日  
**スキーマバージョン**: @shisyamo4131/air-guard-v2-schemas v2.4.2-dev.122

### 実装済み機能

#### 1. FcmToken グローバルコレクション

- User.fcmTokens 配列からグローバルコレクション（`FcmTokens/{token}`）へ移行
- ドキュメントID = トークンによる一意性保証
- 同一デバイスでの別ユーザーログイン時の uid 自動上書き
- Firestore セキュリティルール（自分の uid のみ作成可能）

#### 2. Notification コレクションを中心としたプッシュ通知アーキテクチャ（2026年6月4日）

- `onArrangementNotificationCreated` は `Notification` ドキュメントの作成のみを担当
- `onNotificationCreated` が FCM 送信・結果記録を一元処理
- `sourceType` / `sourceId` により送信元（arrangement / manual など）を識別
- `Recipients` サブコレクションでユーザーごとの送信結果を管理
- 新通知種別の追加は `Notification` ドキュメントを作成するだけ

#### 3. sendMulticastNotification の改修（2026年6月4日）

- FCM の 500 件制限を内部チャンク分割で吸収（呼び出し側は件数を意識不要）
- 戻り値に `responses: [{ token, success, messageId?, error?, errorCode? }]` を追加

#### 4. Service Worker 環境変数注入

- Vite プラグインによるビルド時の Firebase 設定置換
- 開発環境（Emulator/Dev）と本番環境の自動切り替え

#### 5. 無効トークン管理

- FCM エラーコード検出と自動削除
- バッチ処理による効率的な削除

### 実装ファイル

**Schemas** (v2.4.2-dev.122)

- `FcmToken.js` - グローバルトークン管理
- `ArrangementNotification.js` - notificationSentAt/notificationError 削除済み
- `User.js` - fcmTokens 削除済み
- `Notification.js` - 通知管理ドキュメント
- `NotificationRecipient.js` - 送信履歴サブコレクション

**Cloud Functions**

- `ArrangementNotifications.js` - Notification ドキュメント作成のみ
- `utils/notifications.js` - 汎用送信モジュール + `onNotificationCreated` トリガー

**Frontend**

- `composables/useNotification.js` - トークン登録
- `firestore.rules` - セキュリティルール
- `service-worker/sw.js` - 環境変数注入
- `nuxt.config.js` - Vite プラグイン

### テスト結果

**Dev 環境**: ✅ 通過（2026年6月4日）

- ArrangementNotification 作成 → Notification ドキュメント作成確認
- onNotificationCreated 起動 → プッシュ通知送信確認
- Recipients サブコレクション作成・更新確認
- セキュリティルール動作確認
- FcmToken グローバルコレクション動作確認
- 複数ユーザーログイン時の uid 上書き確認
- 無効トークン自動削除確認

### 既知の問題

開発環境で Vite の依存関係最適化時に一時的なエラーが発生する場合がありますが、自動的に解消されます：

```
Error: Service messaging-sw is not available
```

---

### 解決済みの問題（2026年5月13日）

#### 白画面問題とキャッシュ更新問題

**症状:**

- デプロイ後、PWA起動時に10秒以上白画面が表示される
- ブラウザやモバイル端末で変更が反映されない
- ハードリロードやアプリの再起動が必要

**根本原因:**

1. **NavigationRoute の問題**
   - Workbox の NavigationRoute が precached index.html を返す
   - index.html 内の JS チャンクハッシュが古い
   - 404 エラー → 白画面

2. **Service Worker のキャッシュ戦略**
   - プリキャッシュが「キャッシュファースト」で提供される
   - 新しい Service Worker が待機状態のまま即座にアクティブにならない

**解決策（実施済み）:**

1. **Service Worker を FCM 専用に簡素化**
   - Workbox を完全削除
   - NavigationRoute を削除
   - precacheAndRoute を削除
   - fetch イベントを処理しない

2. **Firebase Hosting による制御**
   - Cache-Control ヘッダーで HTTP キャッシュを制御
   - SPA rewrites でルーティングを Firebase Hosting に任せる

3. **PWA 設定の最適化**
   - registerType: "autoUpdate" を削除
   - globPatterns: [] でプリキャッシュを無効化

**結果:**

✅ 白画面時間: 10秒以上 → 2-3秒（通常のSPA起動時間）  
✅ 変更反映: ハードリロード必要 → リロード1回で完了  
✅ モバイル端末: 複数回再起動必要 → 1回で完了  
✅ プッシュ通知: 動作確認済み  
✅ PWA インストール: 動作確認済み

---

## 未実装機能（Notification コレクション周辺）

> `onNotificationCreated` トリガーは **2026年6月4日に実装済み**です。  
> 管理画面からの手動通知送信 UI と通知履歴 UI は未実装です。

### 残存未実装項目

1. **通知送信 UI** - 未実装（送信対象ユーザー選択、通知内容入力）
2. **通知履歴 UI** - 未実装（管理者視点、ユーザー視点）
3. **定期削除機能** - 未実装（90日以前の通知を削除）

---

## 実装ステップ（完了済み）

すべての実装ステップは完了しました。詳細は「実装完了状況」セクションを参照してください。
title: notification.title,
body: notification.body,
...(notification.imageUrl && { imageUrl: notification.imageUrl }),
},
...(Object.keys(data).length > 0 && { data }),
};

    const messageId = await getMessaging().send(message);
    return { success: true, messageId };

} catch (error) {
return { success: false, error: error.message };
}
}

/\*\*

- 複数ユーザーに同じ通知を送信（無制限 - 内部でチャンク分割）
- @param {string[]} tokens - FCMトークンの配列
- @param {Object} notification - 通知内容
- @param {Object} data - カスタムデータ
- @returns {Promise<Object>} { successCount, failureCount, invalidTokens, responses }
  \*/
  export async function sendMulticastNotification(
  tokens,
  notification,
  data = {},
  ) {
  if (!tokens || tokens.length === 0) {
  throw new Error("No tokens provided");
  }

const FCM_MULTICAST_LIMIT = 500; // Firebase の制限（将来の変更はここだけ修正）

// トークンを500件ずつに分割
const chunks = [];
for (let i = 0; i < tokens.length; i += FCM_MULTICAST_LIMIT) {
chunks.push(tokens.slice(i, i + FCM_MULTICAST_LIMIT));
}

// 各チャンクを送信して個別結果を収集
const allResponses = [];
for (const chunk of chunks) {
const message = {
tokens: chunk,
notification: {
title: notification.title,
body: notification.body,
...(notification.imageUrl && { imageUrl: notification.imageUrl }),
},
...(Object.keys(data).length > 0 && { data }),
};

    const response = await getMessaging().sendEachForMulticast(message);

    // 個別結果を保存（トークンとの対応を維持）
    chunk.forEach((token, idx) => {
      allResponses.push({
        token,
        success: response.responses[idx].success,
        messageId: response.responses[idx].messageId,
        error: response.responses[idx].error?.message,
      });
    });

}

// 無効なトークンを抽出
const invalidTokens = allResponses
.filter(
(r) =>
!r.success &&
(r.error?.includes("registration-token-not-registered") ||
r.error?.includes("invalid-registration-token")),
)
.map((r) => r.token);

return {
successCount: allResponses.filter((r) => r.success).length,
failureCount: allResponses.filter((r) => !r.success).length,
invalidTokens,
responses: allResponses, // トークンごとの詳細結果
};
}

/\*\*

- 複数ユーザーに異なる通知を送信（最大500件）
- @param {Array} messages - { token, notification, data } の配列
- @returns {Promise<Object>} { successCount, failureCount, invalidTokens }
  \*/
  export async function sendBatchNotifications(messages) {
  if (!messages || messages.length === 0) {
  throw new Error("No messages provided");
  }

const formattedMessages = messages.slice(0, 500).map((msg) => ({
token: msg.token,
notification: {
title: msg.notification.title,
body: msg.notification.body,
...(msg.notification.imageUrl && { imageUrl: msg.notification.imageUrl }),
},
...(msg.data && Object.keys(msg.data).length > 0 && { data: msg.data }),
}));

const response = await getMessaging().sendEach(formattedMessages);

// 無効なトークンを抽出
const invalidTokens = [];
response.responses.forEach((resp, idx) => {
if (!resp.success) {
const errorCode = resp.error?.code;
if (
errorCode === "messaging/registration-token-not-registered" ||
errorCode === "messaging/invalid-registration-token"
) {
invalidTokens.push(messages[idx].token);
}
}
});

return {
successCount: response.successCount,
failureCount: response.failureCount,
invalidTokens,
};
}

````

#### 使用例

##### 例1: ArrangementNotification 作成時（複数ユーザーに同一通知）

```javascript
import { sendMulticastNotification } from "./notifications.js";

// 対象従業員のFCMトークンを取得
const tokens = employees.flatMap((emp) => emp.fcmTokens);

const result = await sendMulticastNotification(
  tokens,
  {
    title: "配置通知",
    body: `4月30日 日勤 東京ビル に配置されました`,
  },
  {
    type: "arrangement",
    arrangementId: arrangementDoc.id,
  },
);

console.log(`成功: ${result.successCount}, 失敗: ${result.failureCount}`);

// 無効なトークンをユーザードキュメントから削除
if (result.invalidTokens.length > 0) {
  await removeInvalidTokens(result.invalidTokens);
}
````

##### 例2: 個別シフト変更通知（単一ユーザー）

```javascript
import { sendNotification } from "./notifications.js";

const result = await sendNotification(
  employee.fcmTokens[0],
  {
    title: "シフト変更",
    body: "4月30日のシフトが変更されました",
  },
  {
    type: "shift_change",
    shiftId: "xxx",
  },
);

if (result.success) {
  console.log(`メッセージID: ${result.messageId}`);
} else {
  console.error(`エラー: ${result.error}`);
}
```

##### 例3: 複数ユーザーに異なる内容の通知

```javascript
import { sendBatchNotifications } from "./notifications.js";

const messages = [
  {
    token: "token1",
    notification: {
      title: "配置通知",
      body: "4月30日 日勤 東京ビル",
    },
    data: { type: "arrangement", siteId: "site1" },
  },
  {
    token: "token2",
    notification: {
      title: "配置通知",
      body: "4月30日 夜勤 大阪ビル",
    },
    data: { type: "arrangement", siteId: "site2" },
  },
];

const result = await sendBatchNotifications(messages);
```

#### エラーハンドリング

**無効トークンの自動検出**:

- `messaging/registration-token-not-registered`: アプリをアンインストールしたユーザー
- `messaging/invalid-registration-token`: 不正なトークン形式

**推奨処理**:

```javascript
if (result.invalidTokens.length > 0) {
  // Userドキュメントから無効トークンを削除
  for (const token of result.invalidTokens) {
    await removeTokenFromUser(token);
  }
}
```

---

### Notification コレクション連携: functions/modules/utils/notifications.js

#### onNotificationCreated トリガー

**概要:**

- Notification ドキュメント作成をトリガーとして通知を自動送信
- Recipients サブコレクションを作成して送信結果を記録
- ユーザーごとの送信状態を管理

**実装:**

```javascript
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

export const onNotificationCreated = onDocumentCreated(
  {
    document: "Companies/{companyId}/Notifications/{notificationId}",
    region: "asia-northeast1",
  },
  async (event) => {
    const db = getFirestore();
    const companyId = event.params.companyId;
    const notificationData = event.data.data();
    const recipientUserIds = notificationData.recipientUserIds || [];

    if (recipientUserIds.length === 0) {
      await event.data.ref.update({
        status: "completed",
        successCount: 0,
        failureCount: 0,
      });
      return;
    }

    // 1. Recipients サブコレクション作成
    const batch = db.batch();
    recipientUserIds.forEach((userId) => {
      const recipientRef = event.data.ref.collection("Recipients").doc(userId);
      batch.set(recipientRef, { status: "pending" });
    });
    await batch.commit();

    // 2. 各ユーザーの fcmTokens を取得
    const userDocs = await Promise.all(
      recipientUserIds.map((id) =>
        db.doc(`Companies/${companyId}/Users/${id}`).get(),
      ),
    );

    // 3. ユーザーIDとトークンのマッピングを作成
    const userTokenMap = new Map(); // userId -> tokens[]
    const tokenUserMap = new Map(); // token -> userId

    recipientUserIds.forEach((userId, idx) => {
      const tokens = userDocs[idx].data()?.fcmTokens || [];
      userTokenMap.set(userId, tokens);
      tokens.forEach((token) => tokenUserMap.set(token, userId));
    });

    // 4. 全トークンを収集
    const allTokens = Array.from(userTokenMap.values()).flat();

    if (allTokens.length === 0) {
      // トークンが1つもない場合
      const updateBatch = db.batch();
      recipientUserIds.forEach((userId) => {
        const recipientRef = event.data.ref
          .collection("Recipients")
          .doc(userId);
        updateBatch.update(recipientRef, {
          status: "failed",
          error: "No FCM tokens",
        });
      });
      await updateBatch.commit();

      await event.data.ref.update({
        status: "completed",
        successCount: 0,
        failureCount: recipientUserIds.length,
      });
      return;
    }

    // 5. sendMulticastNotification を使って送信（チャンク分割は内部で実施）
    const result = await sendMulticastNotification(
      allTokens,
      {
        title: notificationData.title,
        body: notificationData.body,
        ...(notificationData.imageUrl && {
          imageUrl: notificationData.imageUrl,
        }),
      },
      {
        notificationId: event.data.id,
        ...(notificationData.data || {}),
      },
    );

    // 6. トークンごとの結果からユーザーごとの結果を集計
    const userResults = new Map(); // userId -> { success: boolean, error?: string }

    recipientUserIds.forEach((userId) => {
      const tokens = userTokenMap.get(userId);
      if (tokens.length === 0) {
        userResults.set(userId, { success: false, error: "No FCM tokens" });
      } else {
        // このユーザーのトークンの送信結果を確認
        const userResponses = result.responses.filter((r) =>
          tokens.includes(r.token),
        );
        const anySuccess = userResponses.some((r) => r.success);

        if (anySuccess) {
          userResults.set(userId, { success: true });
        } else {
          const errors = userResponses
            .map((r) => r.error)
            .filter(Boolean)
            .join(", ");
          userResults.set(userId, {
            success: false,
            error: errors || "Unknown error",
          });
        }
      }
    });

    // 7. Recipients ドキュメントを更新
    const updateBatch = db.batch();
    recipientUserIds.forEach((userId) => {
      const recipientRef = event.data.ref.collection("Recipients").doc(userId);
      const result = userResults.get(userId);

      if (result.success) {
        updateBatch.update(recipientRef, {
          status: "sent",
          sentAt: FieldValue.serverTimestamp(),
        });
      } else {
        updateBatch.update(recipientRef, {
          status: "failed",
          error: result.error,
        });
      }
    });
    await updateBatch.commit();

    // 8. Notification ドキュメントを更新
    const successCount = Array.from(userResults.values()).filter(
      (r) => r.success,
    ).length;
    const failureCount = recipientUserIds.length - successCount;

    await event.data.ref.update({
      status: "completed",
      successCount,
      failureCount,
    });
  },
);
```

**データフロー:**

```
1. UI で Notification ドキュメント作成
   ↓
2. onNotificationCreated トリガー起動
   ↓
3. Recipients サブコレクション作成（送信対象ユーザー分）
   ↓
4. 各ユーザーの fcmTokens を取得
   ↓
5. sendMulticastNotification で一括送信（500件ずつチャンク分割は内部処理）
   ↓
6. トークンごとの結果 → ユーザーごとに集計
   ↓
7. Recipients ドキュメントに送信結果を保存
   ↓
8. Notification ドキュメントに集計結果を保存
```

#### ArrangementNotification 連携実装（将来）

```javascript
// functions/modules/arrangementNotifications.js
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore } from "firebase-admin/firestore";

export const onArrangementNotificationCreated = onDocumentCreated(
  {
    document: "Companies/{companyId}/ArrangementNotifications/{notificationId}",
    region: "asia-northeast1",
  },
  async (event) => {
    const db = getFirestore();
    const companyId = event.params.companyId;
    const arrangementData = event.data.data();

    // 1. employeeId から該当する User を検索
    const usersSnapshot = await db
      .collection(`Companies/${companyId}/Users`)
      .where("employeeId", "==", arrangementData.employeeId)
      .get();

    if (usersSnapshot.empty) {
      console.log(
        `No user found for employeeId: ${arrangementData.employeeId}`,
      );
      return;
    }

    const userIds = usersSnapshot.docs.map((doc) => doc.id);

    // 2. Notification ドキュメントを作成
    await db.collection(`Companies/${companyId}/Notifications`).add({
      title: "配置通知",
      body: `${arrangementData.date} ${arrangementData.shift} ${arrangementData.siteName} に配置されました`,
      recipientUserIds: userIds,
      status: "pending",
      totalCount: userIds.length,
      sourceType: "arrangement",
      sourceId: event.data.id,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: "system",
    });

    // 3. Notification 作成トリガーで自動送信される
  },
);
```

---

## 実装ステップ

### ステップ 1: PWA 基盤の構築（✅完了）

#### 1.1 パッケージインストール

```bash
npm install @vite-pwa/nuxt
```

#### 1.2 PWA 設定追加（✅完了）

- `nuxt.config.js` に PWA モジュールと設定を追加

#### 1.3 アイコン画像の準備（✅完了）

- `public/icon-192.png` を作成
- `public/icon-512.png` を作成

#### 1.4 動作確認（✅完了）

```bash
npm run dev
```

- ブラウザで開発者ツールを開く
- Application タブ → Manifest を確認
- PWA としてインストール可能か確認

---

### ステップ 2: FCM トークン管理

#### 2.1 User スキーマ更新（✅完了）

- `air-guard-v2-schemas/src/User.js` に `fcmTokens` フィールド追加

#### 2.2 Service Worker 作成（✅完了）

- `service-worker/sw.js` を作成（FCM 専用、Workbox 不使用）
- Firebase Messaging の初期化コードを記述
- 環境変数はビルド時に Vite プラグインで注入

#### 2.3 通知許可 Composable 作成（✅完了）

- `composables/useNotification.js` を作成
- ユーザーに通知許可をリクエストする機能
- 通知権限の状態管理

#### 2.4 FCM トークン取得ロジック実装（✅完了）

- `useNotification.js` の `registFCMToken()` 関数を実装
  - Firebase Messaging の動的インポート
  - Service Worker の登録
  - FCMトークンの取得
  - Userドキュメントへの保存（重複チェック実施）
- `stores/useAuthStore.js` の `setUser` メソッドから呼び出し
- アプリ起動時（ログイン時）に自動的に FCM トークンを取得

#### 2.5 通知設定UI実装（✅完了）

- `components/User/Setting/index.vue` を作成
- トグルUIで通知設定を管理
- 通知権限が `default` の場合のみ許可ボタン表示
- 許可後に自動的にFCMトークンを登録

#### 2.6 動作確認（✅完了）

- アプリを起動してログイン
- 設定画面から通知許可をリクエスト
- Firestore で User ドキュメントに fcmTokens が保存されているか確認
- DevTools → Application → Service Workers で Service Worker 登録を確認

---

### ステップ 3: 通知送信ロジック

#### 3.1 汎用通知送信モジュール作成（✅完了）

- `functions/modules/utils/notifications.js` を作成
- **3つのメソッドを実装**:
  - `sendNotification()`: 単一ユーザーに送信
  - `sendMulticastNotification()`: 複数ユーザーに同じ通知を送信
  - `sendBatchNotifications()`: 複数ユーザーに異なる通知を送信
- **エラーハンドリング**:
  - try-catch でエラーをキャッチ
  - 無効トークンを自動検出（`invalidTokens` 配列で返す）
- **再利用性**:
  - ArrangementNotification 以外のユースケースでも使用可能
  - 将来の拡張に対応した汎用設計

#### 3.2 ArrangementNotification スキーマ更新（✅完了 → 2026年6月4日に削除）

- ~~通知関連フィールドを追加~~ → 2026年6月4日に `notificationSentAt` / `notificationError` を削除
- 送信結果は `Notifications` コレクションで一元管理

#### 3.3 ArrangementNotification トリガー実装（✅完了・2026年6月4日に改修）

- `functions/modules/ArrangementNotifications.js`
- **2026年6月4日改修後**: `onArrangementNotificationCreated` は Notification ドキュメントの作成のみを担当
- FCM 送信は `onNotificationCreated` が担当

**現在の処理フロー（2026年6月4日以降）:**

```javascript
export const onArrangementNotificationCreated = onDocumentCreated(
  {
    document: "Companies/{companyId}/ArrangementNotifications/{notificationId}",
    region: "asia-northeast1",
  },
  async (event) => {
    // 1. employeeId から User を検索して recipientUserIds を収集
    // 2. Notification ドキュメントを作成（onNotificationCreated がプッシュ通知を送信）
    await db.collection(`Companies/${companyId}/Notifications`).add({
      title: "配置通知",
      body: `${month}月${day}日の配置が更新されました。`,
      data: { type: "arrangement", arrangementNotificationId: notificationId, ... },
      recipientUserIds,
      status: "pending",
      sourceType: "arrangement",
      sourceId: notificationId,
    });
  },
);
```

#### 3.4 onNotificationCreated トリガー実装（✅完了 2026年6月4日）

- `functions/modules/utils/notifications.js` に実装済み
- `functions/index.js` でエクスポート済み
- 全通知種別で共通利用可能

**処理フロー:**

```
1. status を processing に更新
2. recipientUserIds → User → uid → FcmToken 検索
3. Recipients サブコレクション作成（pending）
4. sendMulticastNotification で送信（500件チャンク分割は内部処理）
5. トークンごとの結果をユーザーごとに集計（1件でも成功なら sent）
6. Recipients ドキュメントを更新（sent/failed）
7. 無効トークンを FcmTokens コレクションから削除
8. Notification ドキュメントに集計結果を保存（status: "completed"）
```

---

### ステップ 5: Notification コレクション実装（✅完了 2026年6月4日）

---

---

## 実装完了状況（2026年4月28日版：参考）

> この節は 2026年4月28日時点の実装完了状況の記録です。最新状況は前セクション「実装完了状況」を参照してください。

**スキーマバージョン**: @shisyamo4131/air-guard-v2-schemas v2.4.2-dev.78（当時）

### ステップ 5: Notification コレクション実装（✅ 2026年6月4日に完了）

#### 5.1 Notification スキーマ作成（✅ 完了）

#### 5.2 sendMulticastNotification 改修（✅ 完了 2026年6月4日）

- チャンク分割を内部実装（`FCM_MULTICAST_LIMIT = 500`）
- 戻り値に `responses: [{ token, success, messageId?, error?, errorCode? }]` を追加

#### 5.3 onNotificationCreated トリガー実装（✅ 完了 2026年6月4日）

- `functions/modules/utils/notifications.js` に実装済み
- `functions/index.js` でエクスポート済み

---

## ステップ 4: UI/UX 改善

#### 4.1 通知許可リクエスト UI

- ログイン後、初回起動時に通知許可をリクエスト
- わかりやすいメッセージとトグルボタンを表示
- 通知権限の現在の状態（`default`、`denied`、`granted`）を表示
- `denied` の場合は、ブラウザ設定での変更が必要な旨を明示
- トグルは `default` の場合のみ操作可能とする

#### 4.2 通知クリック時の画面遷移

- 通知をタップしたらダッシュボード（`/dashboard`）へ遷移
- URL パラメータから `notificationId` を取得して該当情報を表示

#### 4.3 エラーハンドリング

- トークン取得失敗時の処理
- 通知送信失敗時の無効トークン自動削除（Cloud Functionsで実装済み）
- 管理画面でエラーログを確認できるようにする

#### 4.4 設定画面

- ユーザーが通知の ON/OFF を切り替えられる画面（トグルUI）
- 現在の通知権限状態の表示
- 登録済みFCMトークンの数を表示（※トークン自体は表示しない）
- 通知権限が `denied` の場合は、ブラウザ設定へのガイダンス表示

---

## 注意事項

### セキュリティ

1. **FCM トークンの管理**
   - トークンは定期的に更新される可能性がある
   - 無効なトークンは Cloud Functions で自動削除（実装済み）
   - ログイン時に自動的にトークンを再取得するため、削除されても問題なし

2. **Firestore Security Rules**
   - `fcmTokens` は本人のみ読み書き可能にする
   ```javascript
   match /Companies/{companyId}/Users/{userId} {
     allow read, update: if request.auth.uid == userId;
   }
   ```

### パフォーマンス

1. **トークンの重複排除**
   - 同じトークンが複数回保存されないようにする
   - 配列に追加する前に存在チェック

2. **バッチ送信**
   - FCM は最大 500 件まで一度に送信可能
   - 大量送信時は分割して送信

3. **再通知の仕様**
   - ArrangementNotification ドキュメントが再作成されたら再通知
   - 配置管理機能によって再配置されると、同じドキュメントIDで再作成される
   - `onCreate` トリガーで対応可能

### テスト

1. **開発環境でのテスト**
   - エミュレーターでは FCM は動作しない
   - 開発環境は実際の Firebase プロジェクトを使用

2. **複数デバイスでのテスト**
   - スマートフォン、タブレット、PC で確認
   - 各デバイスで通知が届くか検証

---

## 参考資料

### 公式ドキュメント

- [Firebase Cloud Messaging (FCM)](https://firebase.google.com/docs/cloud-messaging)
- [Vite PWA Plugin](https://vite-pwa-org.netlify.app/)
- [Nuxt PWA Module](https://github.com/vite-pwa/nuxt)
- [Web Push Notifications](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)

### トラブルシューティング

- FCM トークンが取得できない → Service Worker の登録状況を確認
- 通知が届かない → ブラウザの通知設定を確認
- PWA がインストールできない → HTTPS 必須（localhost は例外）

---

## 今後の拡張案

### 機能拡張

1. **通知のカスタマイズ**
   - 通知内容に配置日時や現場名を含める
   - 重要度に応じて通知音を変える

2. **通知履歴**
   - 過去に送信された通知の一覧表示
   - 既読・未読の管理

3. **スケジュール通知**
   - 配置日の前日にリマインダー送信
   - 定期的な通知設定

4. **グループ通知**
   - 複数のユーザーに一斉送信
   - 現場ごと、部署ごとの通知

### パフォーマンス改善

1. **トークン管理の最適化**
   - 無効トークンの自動削除
   - トークンの有効期限管理

2. **送信の最適化**
   - 送信失敗時の自動リトライ
   - 優先度に応じた送信順序制御

3. **通知の最適化**
   - 同じ内容の重複送信防止
   - 通知の統合（複数の配置を1つの通知にまとめる）

---

## 📋 TODO リスト（実装優先順）

### 🔴 優先度：高（Notification コレクション実装）

#### 1. Notification スキーマ作成（✅ 完了）

- **ファイル**: `air-guard-v2-schemas/src/Notification.js`
- **内容**:
  - **FireModel を継承**
  - 親ドキュメント: title, body, imageUrl, data, recipientUserIds[], totalCount, successCount, failureCount, status, sourceType, sourceId, createdBy
- **作業**:
  1. ✅ スキーマファイル作成
  2. ✅ `air-guard-v2-schemas/index.js` に export 追加
  3. npm publish (`npm run dev:publish`)
  4. air-guard-v2 で更新 (`npm run update:schemas`)

#### 1-2. NotificationRecipient スキーマ作成（✅ 完了）

- **ファイル**: `air-guard-v2-schemas/src/NotificationRecipient.js`
- **内容**:
  - **BaseClass を継承**（FireModel ではない）
  - サブコレクション用: notificationId, userId, status, sentAt, error
  - Cloud Functions のみが作成・更新
- **作業**:
  1. ✅ スキーマファイル作成
  2. ✅ `air-guard-v2-schemas/index.js` に export 追加
  3. npm publish (`npm run dev:publish`)
  4. air-guard-v2 で更新 (`npm run update:schemas`)

#### 2. sendMulticastNotification 改修（✅ 完了 2026年6月4日）

- **ファイル**: `functions/modules/utils/notifications.js`
- `FCM_MULTICAST_LIMIT = 500` チャンク分割実装済み
- `responses: [{ token, success, messageId?, error?, errorCode? }]` 追加済み

#### 3. sendBatchNotifications 改修

- **ファイル**: `functions/modules/utils/notifications.js`
- **改修内容**: sendMulticastNotification と同様のパターンで改修（未実施）

#### 4. onNotificationCreated トリガー実装（✅ 完了 2026年6月4日）

- `functions/modules/utils/notifications.js` に実装済み
- `functions/index.js` でエクスポート済み

### 🟡 優先度：中（UI実装）

#### 5. 通知送信 UI 実装

- **機能**:
  - ユーザー選択（`isTemporary=false` && `disabled=false`）
  - 通知内容入力（title, body, imageUrl）
  - Notification ドキュメント作成（sourceType: "manual"）
- **注意**: fcmTokens が空のユーザーも選択可能（履歴に残す）

#### 6. 通知履歴 UI 実装

- **管理者視点**: Notifications コレクションの一覧表示
  - クリックで Recipients サブコレクション詳細表示
- **ユーザー視点**: `collectionGroup('Recipients').where(documentId(), '==', userId)` で取得
  - 自分宛の通知一覧表示

### 🟢 優先度：低（運用機能）

#### 7. 定期削除機能実装

- **ファイル**: `functions/modules/utils/notifications.js`
- **内容**:
  - Cloud Scheduler 設定（毎日3時実行）
  - `cleanupOldNotifications` 関数実装
  - 90日以前の通知を削除（status='completed'）
  - 親ドキュメント + サブコレクション両方削除

### ~~🔵 将来実装（ArrangementNotification 連携）~~（✅ 完了 2026年6月4日）

#### 8. ~~ArrangementNotification スキーマ更新~~ → notificationSentAt/notificationError を削除（✅ 完了）

#### 9. onArrangementNotificationCreated トリガー実装（✅ 完了）

- `functions/modules/ArrangementNotifications.js` — Notification ドキュメント作成のみ
- `functions/index.js` にエクスポート済み

---

## ✅ 完了済み（参考）

- ✅ PWA 基盤構築（@vite-pwa/nuxt）
- ✅ Service Worker 統合（Workbox + FCM）
- ✅ User スキーマに fcmTokens フィールド追加
- ✅ useNotification composable 実装
- ✅ Plugin で手動 SW 登録 + foreground notification handler
- ✅ 通知許可リクエスト UI（User/Setting/index.vue）
- ✅ 汎用通知送信モジュール（sendNotification, sendMulticastNotification, sendBatchNotifications）
- ✅ testNotification HTTP トリガー（開発時のみ export）
- ✅ エミュレーター環境でのモック送信対応
- ✅ 無限リロードループ問題解決
- ✅ 重複通知問題解決
- ✅ マルチデバイステスト完了
- ✅ sendMulticastNotification 500件チャンク分割対応（2026年6月4日）
- ✅ Notification/NotificationRecipient スキーマ実装（2026年6月4日）
- ✅ onNotificationCreated トリガー実装（2026年6月4日）
- ✅ ArrangementNotification → Notification 二段階アーキテクチャ移行（2026年6月4日）

---

## 📝 メモ

### エミュレーター環境の確認方法

```javascript
const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";
```

### testNotification の使い方

- **エミュレーター**: `http://127.0.0.1:5001/air-guard-v2-dev/asia-northeast1/testNotification?userId=xxx&companyId=xxx`
- **Dev環境**: `https://asia-northeast1-air-guard-v2-dev.cloudfunctions.net/testNotification?userId=xxx&companyId=xxx`
- **注意**: export のコメントアウト/解除で有効化切り替え

### 新しい通知種別を追加するには

`Notification` ドキュメントを `Companies/{companyId}/Notifications` に作成するだけで、`onNotificationCreated` が自動的にプッシュ通知を送信します。

```javascript
await db.collection(`Companies/${companyId}/Notifications`).add({
  title: "通知タイトル",
  body: "通知本文",
  data: { type: "xxx", ... },
  recipientUserIds: ["uid1", "uid2"],
  status: "pending",
  sourceType: "xxx",     // arrangement / manual / billing など
  sourceId: "sourceDocId",
});
```
