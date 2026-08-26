# 0023 認証状態変更の局所的な競合制御

- 状態: Accepted
- 日付: 2026-08-26
- 関連仕様: `docs/specification.md` の「テナントと認証」
- 関連計画: `docs/implementation/user-write-boundary.md` の UWB-10

## 背景

UWB-06は通常UIの二重送信を抑止したが、clientのpending状態は複数tab・端末・actor、古い画面、未対応clientからの要求を直列化しない。Firestore transactionはdocument競合を再試行できる一方、古いclientが送った完全なrole配列や有効状態の意図まで更新しない。全collectionへ共通version、lock、operation ledgerを導入すると、通常CRUD、将来機能、復旧手順まで複雑化する。

## 決定

- 追加の競合制御は、Authenticationと認可へ直接影響するUserのrole更新と有効・無効変更だけへ限定する。
- role更新requestは、変更後`roles`に加えて画面が編集前に読んだ`expectedRoles`を送る。serverはtransaction内の現在`roles`を順序を含めて比較し、不一致、現在値の型・未知preset・重複をfail closedで拒否する。
- 有効・無効変更requestは、変更対象UIDに加えて画面が読んだ`expectedDisabled`を送る。serverはtransaction内の現在`disabled`と一致しない要求を拒否する。
- role更新と有効・無効変更は、対象Userの`UserLifecycleLocks`が存在する間は拒否する。退職・本登録User削除のaccess revoke、Auth削除、Firestore finalize、cleanupと競合させない。
- 競合は安全な`aborted`応答とし、UID、role、operation ID、内部状態を応答へ含めない。clientは最新状態を再取得して利用者が改めて判断する。
- 会社管理者移譲は、唯一の現管理者、移譲元・先のUser/Auth状態を同じtransactionで再確認する既存境界を維持する。仮User作成はemail・Employee予約transaction、仮User削除は対象・予約transaction、UWB-07 lifecycleはoperation ID・fingerprint・lock・head・reconcileを既存の競合制御とする。
- 通知設定、本人プロフィール、通常の業務document CRUDにはこのpreconditionを要求しない。通知設定の同時編集はlast-write-winsを残存riskとして受容する。
- 全document共通のrevision field、汎用lock、汎用operation ledger、汎用single-flight frameworkを導入しない。この決定を他collectionへ自動適用しない。
- Schemas packageはrole catalogを提供するだけで、runtime concurrency、actor・tenant認可、allow/deny engineを所有しない。

## 理由

roleの古い完全配列による権限再付与と、古い画面からの有効化によるaccess revokeの打消しは、認証・認可へ直接影響する。保存schemaを増やさずrequestの期待値とtransaction内現在値を比較すれば、この2経路だけを小さく保護できる。一方、通常の編集競合まで同じ仕組みで扱うと、機能価値に対して実装・運用負担が大きい。

## 代替案

- 全documentへrevisionとoptimistic concurrencyを追加する案: migration、全client変更、競合UX、将来CRUDへの強制を招くため採用しない。
- User documentへ永続revisionを追加する案: role・通知・プロフィール等の無関係な更新まで競合させ、既存data移行も必要になるため採用しない。
- client pendingだけに依存する案: 複数tab・端末・actorと未対応clientを保護できないため、roleと有効状態には採用しない。
- UWB-07のoperation ledgerを全User更新へ転用する案: 不可逆なAuth削除用の復旧機構を通常更新へ広げるため採用しない。

## 影響

- role更新と有効・無効変更のCallable inputは後方互換ではない。AirGuardV2のclientとFunctionsを同じ変更として導入し、旧payloadをfail closedで拒否する。
- Firestore document schema、Rules、Schemas package、既存dataのmigrationは変更しない。
- 競合時は自動上書きや自動mergeをせず、最新状態の再確認が必要になる。
- 他collectionの作成・更新・削除はこのADRだけを理由に変更しない。

## 移行とrollback

client payload、Functions policy/use-case/error mapper、単体・Emulator test、仕様・roadmap・changelogを同一feature単位で変更する。rollbackは同feature commitを通常のGit revertで戻し、data migration、Rules rollback、Schemas rollbackを行わない。main統合、push、deployはそれぞれ別承認とする。

## 再検討条件

同じ重大な認証事故を防げない具体的な再現、外部作用の重複、復旧不能なdata損失、tenant境界違反が確認された場合だけ、対象操作を限定して追加対策を再検討する。一般的な編集競合や「完全な防御」を理由に全collectionへ拡張しない。
