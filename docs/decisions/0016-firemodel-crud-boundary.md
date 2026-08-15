# 0016 FireModel CRUDの利用境界

- 日付: 2026-08-15
- 状態: Accepted
- 関連仕様: テナントと認証
- 置換対象: なし

## 背景

AirGuardV2は`air-guard-v2-schemas`のmodelと、`air-firebase-v2`のadapter注入を使い、client/serverでschema、validation、timestamp、自動採番、従属document削除防止などを共有している。一方、FireModelのCRUDはtransaction、`set`、全体更新、部分更新、preconditionなどの永続化詳細を呼出し側から判別しづらい。

## 決定

- schema、model、validation、serialization、adapter注入は継続利用する。
- 単一documentの作成・更新・削除は、対象path、transaction、処理順序をuse-case側が明示している範囲でFireModelを利用できる。
- 複数document、Authentication、custom claimsをまたぐ不変条件、検索、transaction境界、失敗時の処理順序はuse-case側で明示する。FireModelへ業務全体の調停を隠蔽しない。
- `create`と`set`の区別、部分更新、precondition、冪等性などをFireModelで安全に表現できない高risk処理は、schema/modelの検証を残したうえでAdmin SDKの明示的な永続化を選択できる。
- 既存CRUDを一括置換しない。最小segmentごとに陰性testと失敗経路を確認する。

一般User本登録では、Firestore transactionとcustom claims設定の順序を`setupUserAccount` use-caseが所有し、transaction内の本登録User作成と仮User削除という各単一document操作にFireModelを利用する。

## 理由

共有schemaと共通metadata処理の利点を維持しながら、高riskな複数resource処理の制御点と失敗経路をコード上で追跡可能にするため。

## 代替案

- 全CRUDを直ちにAdmin SDKへ置換する案: 共有validation、timestamp、自動採番、従属document保護の再実装範囲が大きく、段階改修の原則に反するため採用しない。
- 複数resourceの調停もmodelへ集約する案: transactionと部分成功の境界がさらに見えにくくなるため採用しない。
- FireModelだけを永続化の唯一手段とする案: `create`、部分更新、preconditionなどを安全に表現できない処理の選択肢を失うため採用しない。

## 影響

- 実装: use-caseがquery、transaction、resource間の処理順序を所有する。
- test: schema validationだけでなく、書込み対象path、処理順序、retry、部分失敗を検証する。
- 互換性: 既存modelとadapterを維持し、既存CRUDの一括migrationは行わない。
- 残存risk: ServerAdapterのprocess-global state、`set`/full-write、serialization、client/server差は解消していない。

## 移行

新規または改修する高risk use-caseからこの境界を適用する。既存処理は問題とtest範囲を確認した最小segmentだけを置換する。

## ロールバック

Callableへ接続前の新規use-caseは参照を追加せずに削除できる。接続後は直前の既存Callable実装へ戻し、Firestore/Auth/claimsの部分状態がないことを確認する。

## 再検討条件

FireModelが明示的なcreate/replace/patch、precondition、request-scope adapter、transaction契約を提供した場合、または既存adapter利用に起因するdata loss・tenant boundary違反が確認された場合。
