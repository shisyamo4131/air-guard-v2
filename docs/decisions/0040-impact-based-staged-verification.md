# 0040 影響分類に基づく段階的検証

- 日付: 2026-09-01
- 状態: Accepted
- 関連仕様: 開発ガバナンスと進捗管理
- 関連判断: [0013](0013-managed-governance-reconstruction.md)、[0027](0027-codex-session-capacity-routing.md)、[0039](0039-evidence-bound-critical-identifiers.md)

## 背景

従来のガバナンスは、必須検証ごとの結果とexit statusを独立して観測することを要求した一方、変更内容から必須検証を選ぶ規則を定めていなかった。AirGuardV2では安全側として文書、managed governance、renderer、容量回帰、application syntax、対象test、全domain testを広く実行してきたが、aggregateに含まれるrendererの重複や、影響しないgateの反復が発生していた。

common governance 1.4.1で保存したpre-migration benchmarkでは、governance scenarioがroot 6回、既知のscript-level物理実行21回、warm-median合計11,072.895msだった。これは比較用の保存済み実測であり、1.5.0反映後の性能改善、coverage equivalence、failure-detection equivalenceはまだ確認していない。

## 決定

- common governance `1.5.0`を採用し、`governance/verification-policy.json`を検証選択の機械可読正本、`docs/operations.md`のVerification Matrixを人向けの正本とする。
- 変更をdocumentation-only、UI/CSS/layout、application logic、data contract/schema/migration、governance/permissions/agents、build/release/deployへ分類する。混合変更はunion、影響不明はcomprehensive fallbackを選ぶ。
- 各classはiteration、targeted regression、completion、release-only、通常省略可能なgate、結果記録先を定義する。対象fileや仕様上の影響を確認せず、実行時間だけを理由にgateを省略しない。
- aggregateが子gateのnamed resultとexit statusを保持し、子の失敗でnonzeroとなる場合だけ、宣言済み`includes`を重複実行せず充足できる。AirGuardV2では`managed-governance`が`renderer-check`を含む。
- 成功証拠はexit status 0を独立確認した後だけ記録する。後続編集が`invalidatedBy`へ該当した証拠はstaleとし、失敗gateと失効gateを先に再実行する。
- scaffold、governance migration、managed sync、common contract、project-wide permissionまたはagent policy、release/deployはcomprehensive検証を維持する。release-only gateと外部作用は、policyへの記載だけでは承認されない。
- 文書は実際の影響だけを更新する。仕様、ADR、roadmap、manual、operations、CHANGELOGを無関係なgate通過のためだけに変更しない。

## 理由

狭いiteration feedbackと変更に対応したtargeted regressionを使いつつ、ガバナンス移行やreleaseのcomprehensive boundaryを維持できる。gate ID、exact command、包含、失効条件をJSONへ固定し、syncがmarker-bounded summaryを生成することで、Markdownと実行契約のdriftも検出できる。

## 代替案

- 既存の全gateを毎回実行する案: 安全目的は維持できるが、既知の重複と無関係な回帰を残すため採用しない。
- 実行時間だけでgateを削る案: coverageとfailure detectionを失う可能性があり採用しない。
- Markdown表だけを正本にする案: command、stage、包含、失効条件の機械検証が不安定になるため採用しない。

## 影響

- governance、project rules、operations、文書索引、開始prompt、project document validator、negative test、current handoff、CHANGELOG、managed artifactsを更新する。
- 本判断はapplication、Functions、Rules、dependency、build artifact、Emulator、Dev、Prod、network、remote/data、Schemas consumer、STRIPE-02を変更または実行しない。
- common contractと生成`AGENTS.md`が変わるため、commit後にaffected active taskを安全checkpointで完全新規taskへ交代する。coordinator交代は利用者の別途明示承認を必要とする。

## 移行

既存commandを安全目的ごとにinventoryし、policyのclass、stage、includes、invalidatedBy、evidence destinationへ配置する。project-owned文書とvalidatorを整合させてから、commit `de5b39e90ecf8c4f94d89dbc514c982b1652ba04`の正規`sync-project-governance.ps1 -Apply`で1.5.0のcommon contract、lock、renderer、governance validator、生成`AGENTS.md`を同期する。

このmigrationのcomprehensive gateは`project-docs`、`project-docs-negative`、`capacity-regression`、`managed-governance`、`diff-check`とする。`managed-governance`が含むrendererをstandalone completion gateとして重複実行しない。保存済みpre値からstandalone rendererを除いたwarm-median単純合計は10,632.048msだが、これはpost実測ではなく比較計画上の算術値に限る。

## Rollback

問題があればhistory rewriteを使わず、review済みrevertまたはcorrective commitでproject-owned policyとmanaged 1.5.0 artifactsを戻す。common governanceまたは生成`AGENTS.md`を戻す場合もinstruction-chain変更としてaffected taskを交代する。失敗したgateは成功と記録せず、対象外のbuild・environment・dataへ検証範囲を拡張しない。

## 検証

- project document validatorがpolicy、operations marker、索引、開始promptのroutingを確認する。
- negative testがmissing route、invalid JSON、missing Verification Matrixをnonzeroで拒否する。
- managed governance validatorがschema、6 class、gate stage、包含の非循環性、unknown fallback、governance/build classのcomprehensive closure、生成summaryを確認する。
- migration comprehensive gateを個別に実行し、各commandのresultとexit statusを独立確認する。
- post benchmarkは別checkpointでpreと同じ比較契約を使い、coverageとfailure detectionを確認するまで改善を主張しない。

## 再検討条件

aggregate runnerを追加する場合、gate commandや対象test構成が変わる場合、release boundaryが変わる場合、またはpost benchmarkで重複・coverage不足・failure-detection不足が判明した場合。
