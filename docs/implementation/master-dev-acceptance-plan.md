# 4マスター Dev受入れ計画

最終更新日: 2026-09-07

## 目的と停止点

この文書はCustomer、Site、Outsourcer、Employeeの初回Dev反映について、受入れに使うaccount、合成data、操作、外部作用、終了後の処置と担当を固定する。実company ID、名称、account、資格情報は記録しない。

No.8は受入れ準備であり、Dev build、remote read、deploy、実data変更、migration、IAM変更を許可しない。No.10の実行前に利用者だけが判断できる事前確認を終える。ただし、**新しいHosting／Functions／Rulesが反映されたDev画面そのものの利用者受入れはNo.10後でなければ実施できない**ため、次の順序とする。

1. No.8: 受入れ計画を確定し、利用者事前確認U8-1〜U8-6を終える。UIは4マスターを1つずつ横断確認する。
2. No.9: Codexが最終差分、再利用できる証拠、新たに必要なgateとbounded preflightを確定する。
3. No.10開始直前: 利用者がU8-5の短時間停止を通知する。
4. No.10: 別途提示するexact target／command／外部作用を利用者が明示承認した後だけ、bounded Dev反映とCodexの技術smokeを行う。
5. No.10後: 利用者が反映済みDevの見た目・使い勝手を受入れ、各roadmapのDev受入れ完了を判断する。

したがって「No.10は私しかできない検証が終わってから」は、No.10前に可能な主観判断と運用確認について正しい。反映済みDevを対象にする最終受入れまでNo.10前へ移すことはできない。

## 担当の分離

| 時点 | 利用者でなければ完了できないこと | Codexが作業・確認すること |
|---|---|---|
| No.10前 | 4マスター全体の見た目・操作感、既存test accountを利用できるか、合成data／geocoding／保持方針の許容 | 起動中Chromeと有効なLocal環境を再利用した画面提示、既存Local証拠の有効性確認、権限・操作・test data matrix、停止条件、技術smoke、cleanup案の作成 |
| No.10開始直前 | 区分1の保存を停止し、停止済みと通知 | remote preflight結果と計画の一致確認。区分3でのCodex操作を止め、反映を連続実行できる状態を確認 |
| No.10後 | 反映済みDevの表示・操作感を最終受入れ | deploy identity、権限、tenant分離、正常／拒否経路、保存結果、log、index、Rules、Functions、Hostingを技術確認 |

資格情報はchatまたはrepositoryへ記録しない。利用者のaccountでCodexに操作させる場合も、既に認証済みの利用者Chromeを使い、passwordやtokenの共有を求めない。

## 利用者事前確認

No.10へ進む前に次を確認する。UI確認は機能検証を再実行するためではなく、利用者が4マスターを横断して見た目と操作感を最終確認するために行う。既に起動しているChromeと有効なLocal環境を再利用し、各マスターを1つずつ確認して結果を記録する。U8-7だけはcutover開始直前に行い、それ以前の確認完了だけで停止済みとは扱わない。

- [ ] **U8-1 Customer UI**: `/customers`とCustomer詳細で、一覧構成、状態filter、状態表示、作成／編集、契約終了／復帰、archive導線の見た目と操作感を確認し、受入れまたは変更希望を示す。
- [ ] **U8-2 Site UI**: `/sites`、Site詳細、`/sites/terminated`で、一覧構成、検索、作成／編集、終了／再有効化、終了済み一覧、archive導線の見た目と操作感を確認し、受入れまたは変更希望を示す。
- [ ] **U8-3 Outsourcer UI**: `/outsourcers`で、一覧構成、検索、作成／編集、状態変更、選択操作、delete／archive入口がないことを確認し、受入れまたは変更希望を示す。
- [ ] **U8-4 Employee UI**: `/employees`、Employee詳細、`/employees/resigned`で、一覧構成、検索、作成／編集、国籍・security・資格・保険、終了／復帰、退職済み一覧、archive表示の見た目と操作感を確認し、受入れまたは変更希望を示す。
- [ ] **U8-5 account利用可否**: 区分3で、会社管理者相当のwrite actorとread-only actorを既存accountで利用できるかを確認する。accountが不足する場合、作成・role変更はremote data変更としてNo.10のexact対象へ追加し、別途承認する。
- [ ] **U8-6 合成dataと外部作用**: 区分3で明確にtestと分かる合成dataを作成し、住所確認時だけgeocodingを呼び出すこと、試験後は安全な製品操作で処置するかtest dataとして保持することを許容するか示す。
- [ ] **U8-7 cutover停止**: No.10開始直前に区分1の保存を停止し、「停止しました」と通知する。Rules反映開始からHosting反映・reload・技術smoke完了まで維持する。

## account最小構成

| account区分 | 用途 | 不足時の扱い |
|---|---|---|
| 区分3の会社管理者相当 | 4マスターの正常系、archive／終了／復帰のうち初回releaseに含む操作 | No.10へ無断で作成しない。exact user／role操作、復旧、影響を提示する |
| 区分3のread-only actor | 一覧／詳細の閲覧とwrite拒否、archive表示境界 | 既存actorがなければ、既存自動検証を再利用できる範囲とDevで不足する証明を分ける |
| 利用者自身のaccount | 区分1での反映済みDevの主観受入れ | 既存dataを変えないreadを基本とし、保存操作は利用者が対象を選んだ場合だけ行う |

manager等の追加actorは、既存accountが安全に利用でき、今回の必要事項を会社管理者／read-onlyで証明できない場合だけ候補にする。権限手段が異なるという理由だけで同等検証を増やさない。

## 合成dataと操作表

初回受入れは区分3を基本とする。exact document IDは実行時のreceiptにだけ記録し、開始時不存在を確認してから作成する。実company、実Employee、実User／Auth、実請求dataを試験対象にしない。

| マスター | CodexのDev技術smoke | 利用者の主観受入れ | 初回releaseで行わないこと |
|---|---|---|---|
| Customer | 作成、編集、状態変更、filter結果、終了／復帰、権限別archive表示、参照ありarchive拒否と参照なしarchive | 新状態filter、状態表示、終了／復帰導線の見た目・使い勝手 | 実Customer全件scan、自動変換、実data archive |
| Site | 作成、編集、検索、終了／再有効化、終了済み一覧、権限拒否、参照なしarchive | 反映済み画面で既存受入れ結果との違和感がないこと | `runDailySiteTermination`公開・実行、既存Siteの一括更新 |
| Outsourcer | 作成、編集、検索、状態変更、一覧選択、権限拒否。delete／archive入口がないこと | 反映済み画面で既存受入れ結果との違和感がないこと | delete／archive、配置・通知・実績・請求の新規作成。重複配置は既存Local証拠が有効な限り再実行しない |
| Employee | 作成、基本情報・国籍・security・資格・保険の編集、在籍／退職表示、終了／復帰、権限拒否。archiveはallowlist空により利用不可であること | 反映済み画面で既存受入れ結果との違和感がないこと | archive成功、allowlist開放、実User／Auth削除、予約・通知・請求dataの生成 |

Customerの参照ありarchive拒否を確認するための参照は、既存の合成dataを安全に利用できる場合は再利用する。新しい予定・実績・請求を作ること自体を受入れ目的にしない。不足する証明がある場合だけ、No.10計画で作成対象と外部作用を明示する。

## 外部作用と終了後の処置

- 住所入力でgeocodingを確認する場合は合成住所だけを用いる。provider接続と関連logが発生し得るため、U8-6の許容がない状態では実行しない。
- FCM、email、Stripe、PDF、実通知、課金、User／Authentication削除は初回受入れの対象外とする。
- 区分3はtest用であるため、合成dataを残すことを失敗としない。明確なtest labelを付け、作成IDと処置をreceiptへ記録する。
- cleanupは製品が提供する終了／復帰／archive等の安全な経路に限定する。OutsourcerやEmployeeを直接削除しない。追加のremote削除・repairが必要なら別承認とする。

## 停止条件と完了条件

次のいずれかがあればNo.10へ進めない、または進行中のreleaseを停止する。

- U8-1〜U8-6が未確認、またはUI変更希望が実装へ未反映である。
- 必要account、actor、tenantが特定できない、または資格情報共有を必要とする。
- 合成data作成やgeocoding等の外部作用が承認範囲を超える。
- No.9で差分、検証証拠、target、required gate、rollback境界を確定できない。
- No.10のactual target、remote revision、index、Functions、Rules、Hostingが承認計画と一致しない。

No.8のCodex担当部分は、この計画、操作表、担当分離、停止条件を文書gateで確認した時点で完了する。No.8全体はU8-1〜U8-6への利用者回答後に完了とし、U8-7はNo.10開始条件、反映済みDevの主観受入れはNo.10後の受入れgateとして追跡する。

## 検証選定

今回証明する事項は受入れ手順と担当境界の具体化、および利用者が指定した4マスター全体のUI確認である。UI確認は機能検証の再実行ではないため、既存Local domain、Emulator、buildを再実行しない。各画面の既存環境とdataを使い、利用者の見た目・操作感の判断に必要な画面遷移だけを行う。UI確認中に保存を伴う機能再確認が必要になった場合は、既存証拠で未証明または変更で失効した事項だけを追加する。

`build-release-deploy`として扱い、最終worktreeで文書変更により失効する`project-docs`と`diff-check`を実行する。`managed-governance`、`project-docs-negative`、`capacity-regression`は各gateの`invalidatedBy`に該当する変更がないため、No.6・No.7で確認した既存成功証拠を再利用する。remote read、Dev build、deploy、data変更、migration、IAM変更は未実行である。

## 根拠

- [4マスター release surface inventory](master-dev-release-surfaces.md)
- [Customer状態Local検証](../verification/customer-02-status-local.md)
- [Customer状態roadmap](../roadmaps/customer-status.md)
- [Customer archive safety roadmap](../roadmaps/customer-archive-safety.md)
- [Site roadmap](../roadmaps/site.md)
- [Outsourcer roadmap](../roadmaps/outsourcer.md)
- [Employee roadmap](../roadmaps/employee.md)
- [Dev deployment runbook](../runbooks/dev-deployment.md)
- [Local UI runbook](../runbooks/local-ui-testing.md)
