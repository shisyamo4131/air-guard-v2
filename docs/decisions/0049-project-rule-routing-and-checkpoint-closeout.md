# 0049 Project ruleの小型routingとcheckpoint closeout

- 日付: 2026-09-04
- 状態: Accepted
- 関連仕様: 開発ガバナンスと進捗管理
- 関連判断: [0040 影響分類に基づく段階的検証](0040-impact-based-staged-verification.md)、[0041 文書の単一正本](0041-single-source-documentation-and-final-validation.md)、[0045 通常startup](0045-governance-3-normal-startup.md)、[0047 専門subagentとcoordinator直轄操作](0047-subagent-parallel-coordinator-external-ui.md)

## 背景

2026-09-04の反省会で、Customer改修の安全性とlocal成果は確認できた一方、project ruleの入口が35,757 bytes・142行へ増え、coordination、実装、UI、Dev、検証、task交代が一文書に混在していたことを確認した。同じ規則が複数runbookへ複写され、必要なbranch規則とcompletion gate規則が詳細なUI・data規則の間へ埋もれていた。

既存ruleはgovernance変更のcomprehensive gateと単一正本を既に要求していたが、機能作業中のgovernance checkpointを閉じず、永続証拠を残さないまま次checkpointへ進んだ。またCAS-02の実行契約は途中記録、将来案、current rollbackを同居させたため、CAS-03/04完了後も未着手表現と単独revert案が現在形で残った。branchもCAS-02 trial名のまま後続scopeを含んだ。

## 決定

- `governance/project-rules.md`を常時境界と必読routingだけの小さなindexにする。詳細なproject固有規則は`docs/project-rules/`のcoordination、development/data、environment/approval、documentation/verificationへ分割する。
- 複数routeに該当する作業はsegmentの和集合を読み、delegation promptにもexact segmentを列挙する。入口やpromptへ本文を複写しない。
- 再利用可能な実行順は既存runbookを正とし、単発の失敗ごとに新runbookを作らない。実際にbuild・起動・cleanupの手戻りが大きかったlocal UIだけ、既存runbookへ`UI-READY` preflightを追加する。
- checkpointから次へ進む前に、差分からchange class union、必須gateとexit、失効、証拠保存先、影響文書のCurrent/History、branch適合を確認する`Checkpoint transition`を既存project coordination runbookへ置く。
- historicalな実行契約には時点を明示し、現行手順・残作業・rollbackを保持しない。specificationには要件を置き、local/Devの適用状態はroadmapへ分離する。
- narrowなtrial/checkpoint branchへ後続scopeを黙って追加しない。scope外ならwrite前に新branchまたは明示的な継続境界を利用者と決める。task交代だけではbranchを変更しない。

## 肥大化を防ぐ境界

- 新しいverification gate、status registry、branch manifest、task cache、全document semantic validator、一般的な「手戻り防止runbook」は追加しない。
- rules segmentには日付、進捗、commit、test件数を置かない。実測はverification receipt、現在進捗はroadmap、判断履歴はADR、旧本文はGitで保持する。
- `governance/common-governance.md`、生成`AGENTS.md`、governance lockに記録されたmanaged referenceは変更しない。project固有整理をmanaged commonの変更へ広げない。

## 影響と互換性

- application、Functions、Firebase Rules、data、package、local UI runtime、Dev/Prod/remote状態は変更しない。
- 実質的な承認、安全、role、test、environment境界は維持し、配置と必読routeを整理する。既存文書のanchorは新正本へ更新する。
- current Customer local実装の進捗は変更しない。CAS-02の古い現在形と仕様内の適用状態だけを正本の役割へ戻す。

## 移行とrollback

旧`project-rules.md`の段落を常時入口、4 segment、既存runbook参照、履歴廃止へ分類し、独立reviewで意味保存を確認する。問題時は本変更commitを一単位で安全にrevertし、共通ガバナンスや製品codeへ触れない。revert後は旧入口の肥大とstale防止不足が戻るため、原因を解消せず一部fileだけを戻さない。

## 検証

- change classは`governance-permissions-agents`とし、現行policyのcomprehensive 5 gateを省略しない。
- project documentation validatorで新segment、index、anchor、ADR index、相対linkを確認する。
- independent reviewで旧project ruleの安全条件の意味保存、重複削減、CAS-02のCurrent/History分離、branch/checkpoint transitionを確認する。
- common governance、生成AGENTS、lock記録済みmanaged reference、verification policy、application codeが変更されていないことをexact diffで確認する。

## 再検討条件

task-routed segmentが反復して読まれない、route選択が曖昧で停止が増える、同じ規則の複写が再発する、またはcheckpoint transitionが無関係な検証を常態化させる場合に、実測した失敗だけを対象として見直す。
