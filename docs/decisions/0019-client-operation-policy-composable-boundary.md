# 0019 Client操作policyとcomposable境界

- 日付: 2026-08-17
- 状態: Accepted
- 関連仕様: システム境界、セキュリティ
- 関連実装計画: [User Write Boundary](../implementation/user-write-boundary.md)

## 背景

操作の表示可否や実行可否をcomponent内で直接判定すると、同じ機能を提供する画面ごとに条件が重複し、新しい画面で事前検査を適用し忘れる可能性がある。一方、clientが確認できる状態は保持中のUserや画面dataに限られ、現在のAuthentication User、最新のserver data、custom claims整合性を確定できないため、client判定だけを認可境界にはできない。

## 決定

- 機能の操作可否にドメイン上の事前検証が必要な場合、判定をVue、component、Firebase transportへ依存しない純粋policyとして実装する。
- application composableがpolicyへreactiveな入力を渡し、操作可否、安定した拒否理由、実行処理をcomponentへ提供する。
- componentはrole、権限、対象状態などのpolicyを再実装せず、composableが提供する結果を表示と操作へ反映する。
- composableは表示制御だけに依存せず、request送信直前にもpolicyを再評価し、拒否状態では送信しない。
- client policyはUX上の事前判定であり、serverのidentity、actor、tenant、対象、入力、最新状態の最終検証を代替しない。
- 必須入力、文字数、書式など画面field単体の一般的なvalidationは本決定の対象外とし、既存のvalidatorまたはcomponent ruleを使用できる。

## 理由

純粋policyをcomposableやcomponentから分離すると、同じ判定を複数画面で再利用し、境界値をVueなしで単体testできる。composableを機能入口とすることで、componentが個別に認証store、permission展開、Callableを組み合わせる責務を減らせる。同時にserver最終認可を維持することで、clientの古い状態、改変、適用漏れをsecurity境界へ持ち込まない。

## 代替案

- 親componentが算出したbooleanを子へ渡す案: 親でのpolicy適用漏れと画面間の重複を防げないため採用しない。
- policyをcomposable内へ直接実装する案: Vue依存なしの単体testとserver共通条件の比較が難しくなるため採用しない。
- componentが認証storeを直接参照して判定する案: 表示責務とドメインpolicyが混在するため採用しない。
- client判定を設けずserver errorだけを表示する案: securityは保てるが、明らかに実行不能な操作を表示するUXになるため採用しない。

## 影響

- client: domain policy、application composable、component表示・操作を分離する。
- server: 現行の最終認可を維持し、clientから送られた許可結果を入力として信頼しない。
- test: policy境界、composableの送信抑止、component接続、client／server共通条件のparityを確認する。
- 互換性: 既存機能を一括移行せず、新規機能と改修対象機能から段階的に適用する。

## 移行

UWB-03の仮登録User削除を最初の適用例とし、client専用policy、`useTemporaryUserDeletion`、User一覧、Employee詳細の順に小さいsegmentで接続する。既存component内判定は同じcomposableへの接続後に削除する。

## ロールバック

policy、composable、各component接続を独立commitに分け、問題があるsegmentだけを直前のserver認可済みCallable接続へ戻す。server最終認可はrollback対象にしない。

## 再検討条件

client／serverで共有可能なpolicy packageを導入するとき、Vue以外のclientを追加するとき、またはcomposableがUI framework固有属性を持つ必要が生じたときに責務境界を再検討する。
