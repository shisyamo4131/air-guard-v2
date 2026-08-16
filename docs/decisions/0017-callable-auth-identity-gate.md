# 0017 Callableの共通Auth identity gate

- 日付: 2026-08-16
- 状態: Accepted
- 関連仕様: テナントと認証
- 置換対象: なし

## 背景

認証必須Callableはそれぞれ必要な入力、会社、User、role、対象dataを検査していたが、ID tokenと現在のAuthentication UserにあるUID、email、email確認、company claim、`isSuperUser`、有効状態の検査が入口ごとに散在していた。新しいCallableで検査を欠落させる危険と、個別use-caseに入口identity検査が混在する保守性の問題がある。

## 決定

- 会社所属が確立した認証必須Callableは、最初に共通Auth identity gateを通す。
- 共通gateはID tokenのUID、email、email確認、company claim、`isSuperUser`のboolean型を検査し、現在のAuthentication Userを取得して同じ値、有効状態、所属会社を照合する。
- 共通gateが返す確認済みidentityだけを、後段のAPI固有のUser、管理者・スーパーユーザー、tenant path、対象data、入力検査へ渡す。
- 未認証で利用できる事前確認Callableは共通gateの対象外とする。
- `createAdminAccount`と`setupUserAccount`は会社所属claimまたは本登録Userがまだ確立していないbootstrap処理であるため、各lifecycleに対応した専用identity検査を維持する。
- 共通Auth errorは内部の存在・不整合理由を公開せず、安全なCallable errorへ共通変換する。
- 既存Callableを一括置換せず、1つの最小segmentごとに重複検査を除去して陰性testとEmulator testを行う。

最初の適用対象は`disableUser`と`enableUser`とし、Auth identity検査後に同社の有効な本登録会社管理者、対象User/Auth、状態変更policyを検査する。

## 理由

公開APIの入口で同一のidentity schemaを強制し、新しいCallableでの検査漏れを防ぎながら、API固有policyの責務を明確にするため。現在Authを毎回照合することで、既発行tokenだけに依存せず、無効化やclaim不整合をfail closedにできる。

## 代替案

- 各Callableで個別に検査を続ける案: 重複と検査差が増え、追加時の欠落を防ぎにくいため採用しない。
- 共通gateでFirestore Userと全roleも検査する案: 匿名・bootstrap・管理者・スーパーユーザーなどAPIごとのlifecycleとpolicyが異なり、共通責務が過大になるため採用しない。
- ID tokenだけを信頼する案: claim更新やAuth無効化後の陳腐化を現在状態と照合できないため採用しない。

## 影響

- 実装: 保護対象Callableは共通resolverと共通error mapperを入口で利用し、API固有policyはその後に実行する。
- test: token欠損・型不正、現在Auth不在・無効、UID・email・company・`isSuperUser`不一致と正常経路を共通testで検証する。各Callableでは共通gateが固有処理より先に実行されることを確認する。
- runtime: 各保護対象CallableはAuthentication Userの参照権限を必要とする。
- 互換性: 正常なidentityの応答と業務処理は維持する。不整合identityと陳腐化したtokenは拒否され、利用者はtoken更新または再認証が必要になる場合がある。
- 残存risk: Firestore User・role・対象dataは各API固有検査に依存する。App Check、rate limit、token失効、部分状態、Users Rulesのfield/actor制約は別途対応する。

## 移行

既存の会社所属済みCallableを最小segment単位で共通gateへ移し、重複したtoken/current Auth検査だけを除去する。匿名・bootstrap分類を変更する場合は、先に仕様とlifecycleを再確認する。

## ロールバック

対象Callableを直前の個別identity検査へ戻す。共通gateはdataを書き換えないためdata migrationは不要だが、ロールバック後も同等のfail-closed検査が維持されることを陰性testで確認する。

## 再検討条件

Firebaseの認証token・失効・App Check運用が変わる場合、共通gateにFirestore Userを含める必要が生じた場合、またはbootstrap処理が所属済みCallableと同じidentity lifecycleへ統合された場合。
