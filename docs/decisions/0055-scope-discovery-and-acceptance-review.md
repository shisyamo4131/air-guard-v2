# 0055 発見事項の対応時期と初期・完了レビューの精度

- 日付: 2026-09-06
- 状態: Accepted
- 関連規則: [開発・data](../project-rules/development-and-data.md)、[文書・検証](../project-rules/documentation-and-verification.md)
- 関連判断: [0049 Project rule routingとcloseout](0049-project-rule-routing-and-checkpoint-closeout.md)

## 背景

Site改修の反省会で、当初目的からの範囲拡大、発見の都度の再設計・再review、初期検証とphase完了条件の粗さが指摘された。既存規則には範囲合意・独立review・検証選択がある一方、修正義務と対応時期、review材料、目的達成の判定を具体化する必要がある。個々の過去の追加作業を一律に未承認と判定するものではない。

## 決定と理由

利用者が採用した次の5点を既存の正本へ反映する。

1. [開発・data規則](../project-rules/development-and-data.md#フェーズごとのテスト範囲の合意)で独立問題の後続送りと、回帰・必須条件未達・安全上の阻害を区別する。修正義務から即時の範囲拡大を導かない。
2. [開発workflow](../runbooks/development-workflow.md#試行段階の高速な開発loop)で既存FUTを使い、予定した修正phaseの冒頭に対象・設計・reviewの共有時点を置く。発見のたびに全体工程を組み直す負担を抑える。
3. 同workflowの既存segment contractへ目的・依存・具体的な受入条件・未確認事項を加え、初期独立reviewで範囲の過不足と条件の十分性を判断する。
4. [checkpoint transition](../runbooks/project-coordination.md#checkpoint-transition)で目的・条件と成果・証拠を対応づける。test件数やgate成功だけでは完了としない。
5. [Local UI手順](../runbooks/local-ui-testing.md)の既存UI-READYで必要な実行構成・初期data・cleanup範囲を先に照合し、終了時の実行結果まで確認する。

## 代替案

発見事項をすべて即時修正すると範囲とreview負担が拡大する。一律に後続へ送ると回帰や未達を隠すため、いずれも採用しない。新しい一律gate・台帳・runbookの追加も、既存手順と重複するため採用しない。

## 影響・互換性・移行

今後の改修で既存の設計・roadmap・FUTに必要事項を記録する。完了済みphaseの機械的な書換えや、関係のない文書への履歴追加は行わない。製品仕様・data契約・既存進捗・managed common contract・検証policyは変更せず、合意済み範囲内の通常修正に再承認を追加しない。

## Rollback・検証・再検討条件

戻す場合はこの判断を再検討し、影響するproject-owned規則・手順とindex・changelogだけを整合させる。適用時は既存policyのgovernance classに従う包括検証と独立reviewを行う。肥大化は規則・手順の増分とADR等の履歴を分け、重複・参照・常時読取量を確認する。初期見落としや無計画な範囲拡大が続く場合、または手順が確認効果に対して過重になった場合に再検討する。
