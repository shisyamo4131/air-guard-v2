# 自分では対処できない不具合情報

## feature/triggered-on-arrangement-notification-created

- SiteOperationSchedule.workersから「配置通知未作成」である作業員を削除すると、`onArrangementNotificationCreated` が反応してしまう。
- 詳細は `functions/modules/ArrangementNotifications.js` を参照のこと。

# 開発フロー

## feature/bug

- 画面高さを指定しているコンポーネントについては、v-container を拡張し、スマホでは pa-0 が指定できると綺麗。なんなら「これ以上スクロールしないことを表現している、スクロールさせても元の位置に戻る機能」を制限しても良いかもしれない。
- AirDataTable の hide-search プロパティを削除
- 画面（特に一覧画面）のスクロール制御を確認。

## 警備日報管理

- `SecurityReportManager` を改修 → `ArrangementsManager` をリファクタリング
  - VCardをルートとしたコンポーネントに作り替えるべき？`SecurityReportCard` としてラッパーを作るべき？

## 配置管理

1. **警備日報管理**

- 課題: 警備日報を配置管理画面で登録できるようにできないか。
- 障害: UI 構成および通信量 / 警備日報の存在有無確認方法

## 勤怠管理

- 給与計算は外部サービス（`freee勤怠管理`）に依存させる。
- `AirGuardV2` からは勤怠実績（従業員別の日ごと勤怠）をエクスポートするのみ。

### feature/remove-use-doc-manager

#### SiteOperationScheduleDuplicator

- `SiteOperationScheduleManager` を拡張するべき
- 選択日付のステート、日付選択を可能とする UI を含めたカスタムインプットが必要
- 要は作り直しになる。

## feature/air-data-table-toolbar

- `AirArrayManager` の `table` スロットでは、ツールバーは個別に実装し、`AirDataTable` の `top` スロットは追加検索用に使用すること。

# bugs

- `User` クラスに定義されている `updateProperties` メソッドは複数のプロパティを一度に更新するためのヘルパーメソッドだが、`User` クラス特有のメソッドとして用意する必要はなく、`BaseClass` に移設していいかもしれない。なお、`useAuthStore` で使用しているので削除は不可能。

- `Operation` クラスで実装している `employees` プロパティに対するメソッドだが、どうやら配列インスタンスに直接メソッドを追加するのは一般的ではないようだ。`User` クラスの `addFcmToken` メソッドなどを参考に、リファクタリングした方がいいかも？

# 機能

- 従業員一括登録機能実装
- 稼働実績管理で、請求情報の単価設定が完全に取極めに依存している。取極めがない場合に請求単価を操作できないのは問題。
