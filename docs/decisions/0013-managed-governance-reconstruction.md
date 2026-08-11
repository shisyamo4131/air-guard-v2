# 0013 Managed governance再構築

- 日付: 2026-08-11
- 状態: Accepted
- 関連仕様: 開発ガバナンスとCodex作業手順
- 関連判断: [0001](0001-governance-and-specification-source.md)、[0007](0007-project-scoped-specialist-agents.md)、[0011](0011-roadmap-and-codex-session-lifecycle.md)、[0012](0012-feature-branch-acceptance-and-related-repositories.md)

## 背景

旧`AGENTS.md`と周辺設定をclause単位で分類する無欠損移行は、分類粒度と承認根拠の反復監査に過大な費用を要した。利用者はこの方式を中止し、実装調査成果を含む`b19fc323d2603a5ef3845a09afbce809ccf1147e`を固定基準として、ガバナンスを新しい所有分離構成へ再構築するよう指示した。

## 決定

- `scaffold-project-governance` common governance 1.0.0、lock、renderer、managed validator、生成root `AGENTS.md`をmanaged artifactsとして同期する。
- AirGuardV2固有のscope、approval、Firebase、関連repository、verification、progress、task lifecycleはproject-owned `governance/project-rules.md`で管理する。
- `INITIAL_PROMPT.md`と`.codex/**`はproject-owned hybridとして具体値・role境界を保持する。
- current specification、ADR、operations、roadmap、manual、`docs/implementation/**`をproject-ownedのまま保持する。
- 基準`b19fc32`より後の旧移行準備commitは取り込まず、旧規則のclause単位無欠損移行を完了したとは主張しない。旧`AGENTS.md`はGit履歴から参照できる。
- 既存project validatorはmanaged validatorと名前を分離し、両方を実行する。
- 再構築はinstruction-chain変更であるため、検証とcommit後に既存AirGuardV2 taskを必ず新規taskへ交代する。

## 理由

全project共通の必須契約とAirGuardV2固有の詳細を別所有にし、common更新時にproject固有規則を上書きせず、生成`AGENTS.md`の直接編集も防止するため。実装・仕様・調査成果の保持と、ガバナンス移行方法の完全性主張を分離することで、再構築費用を限定する。

## 代替案

- 旧規則を原子clauseへ分割して全件逆引きする案: 監査反復の費用が高すぎるため中止した。
- 旧`AGENTS.md`をそのままmanaged artifactとして扱う案: common contractとproject固有規則の所有が混在するため採用しない。
- 実装調査前の`main`から再開する案: `b19fc32`の調査成果を失うため採用しない。

## 影響

- 利用者: 再構築後にtask交代を指示し、新taskへ検証指示を送る。
- 製品・data: application、Functions、Rules、schema、Firebase設定、実dataを変更しない。
- 文書: managedとproject-ownedの所有境界、validator名、startup routeを更新する。仕様、FUT、CONF、deep-review、roadmap進捗は保持する。
- task: 新ガバナンスと権限を新規taskで読み込み、変更なしcallback成功後に旧taskをarchiveする。

## 移行

専用branch`codex/governance-reconstruction-restart-preparation`上で同期・検証・commitする。`main`統合、push、deploy、外部環境・実data操作は別途明示承認まで行わない。

## 再検討条件

common governanceのversion更新、project-wide permissionまたはapproval policyの変更、AirGuardV2固有規則の大幅な再編が必要になった場合。
