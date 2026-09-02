# 0043 Dev試用中の既存documentと条件付き状態確認・移行

- 日付: 2026-09-03
- 状態: Accepted
- 関連仕様: 開発ガバナンスと進捗管理
- 関連判断: [0031](0031-proportional-data-boundary-and-change-safeguards.md)、[0040](0040-impact-based-staged-verification.md)、[0041](0041-single-source-documentation-and-final-validation.md)
- 運用規則の正本: [project rules](../../governance/project-rules.md#dev試用中の既存document)

## 背景

Customerの既存Dev documentに保存形式の不適合が見つかった後、原因別集計tool、ID別修復一覧、全件修復をDev反映前の先行作業にする提案へ広がった。しかし現在はProd未公開の試用期間であり、通常画面での編集や、実際に発生した保存不具合への対処で足りる問題まで、先に一括修復する必要はない。利用者は、変更箇所の検証後にDevで試用し、実際の不具合を直す進め方を採用した。

## 決定

- 機能改修時の既存Dev documentは、全件診断・一括修復を一律前提にしない。通常の作成・編集・保存で得られる不具合の再現と修正を優先する。
- 利用者が指定した、Schemaの明らかな変更、特定fieldの他機能への明確な影響、その他確実に必要な場合は、影響範囲の状態確認と必要なmigrationを必須とする。判断方法はproject rulesへ集約する。
- 全件走査や専用toolの追加は、確認が必要な目的・対象を特定した後に選ぶ。非該当の証明のために全件走査を要求しない。状態確認で変換不要が確認できた場合にまでmigrationを作らない。
- 既知の検査結果を成功・修復済みへ書き換えない。不適合の件数と、機能影響・必要な修正の判断を区別する。画面から直ること、未編集fieldが補完されることも、未検証のまま保証しない。
- 本判断はmigrationの必要性を選ぶ入口を変更する。必要と決めたmigrationの実行手順、ADR 0031のcutover方式、認証・認可・tenant分離、検証policy、Dev release・実data変更・Prodの承認は維持する。

## 理由と代替案

- 全件不適合を事前に解消する方式は、通常操作で対処できる問題にも診断・修復開発を必要とし、Devで不具合を発見するまでの時間を延ばすため既定にしない。
- Devであることを理由に状態確認・migrationをすべて省く方式は、明らかなSchema変更や他機能への影響を残すため採用しない。
- 変更差分・関連reader/writer・再現結果から必要性を判断し、必要な状態確認だけへ絞る方式を採用する。

## 影響と適用

- 対象は機能改修時の既存Dev document。Prodの完成・移行基準を変更しない。
- Customerの追加集計tool・ID別修復一覧・全件修復を次の必須作業とする提案は取り下げる。既存の検査toolとimmutable receiptは保持する。
- Customerの次工程は、変更差分・関連経路を3条件へ照合し、必要な状態確認・migrationの有無を示したbounded Dev release案の準備とする。今回の方針採用だけを実データ変更やdeployの承認にしない。
- 製品の保存field、validation、画面、Rules、package、data contractの実体は変更しない。仕様文書はproject rulesへの参照を整え、製品仕様versionは維持する。roadmapは次工程だけを更新し、進捗を加点しない。
- 利用者は本変更について「プロジェクト固有ルールの変更なのでタスクの交代は必要なし」と明示した。今回のGOV-DEV-DATA-001はこの指示を優先し、PM-15と現在の担当を継続する。一般のturnover規則を変更するものではない。文書反映・検証・commit後、Dev環境でのテストに入る直前まで準備を進める。

## 移行とrollback

project rules、開発workflow、Dev・migration runbook、文書案内、仕様の参照、ADR索引、changelog、Customer実装案内、roadmap、current handoffを整合させる。managed common contract、権限設定、agent定義は変更せず、既存versionのmanaged syncとvalidatorで整合を確認する。

本変更による実data migrationはない。方針を戻す場合は所有文書の安全なrevertまたはcorrective commitを行い、その時点の指示に従ってtask継続・交代を判断する。将来実施するdata修復のrollbackは、その対象と変更内容に応じて別に定める。

## 検証

- project rulesの3条件が揃い、非互換変更だけへ狭められていないこと。
- 不適合件数だけから全件修復を必須とするcurrent手順が残らず、必要な状態確認・migration・安全境界も維持されること。
- immutable receiptを改変せず、次工程の提案・承認・未実施状態が一致すること。
- verification policyのgovernanceおよびrelease手順変更のcomprehensive completion gatesを実行し、各commandとexit statusをcoordinatorの完了報告へ記録する。managed-governanceが内包するrendererを重複実行しない。
- 製品code変更・実releaseがないため、application test、Emulator、UI build、Dev/Prod generateは本変更のgateに追加しない。

## 再検討条件

通常操作では発見・修正できない既存dataの影響、他機能への波及、回復困難な事故が確認された場合は、そのfield・機能の対処を見直す。Prod公開、複数clientの継続併存等で前提が変わった場合は、適用環境ごとに再判断する。
