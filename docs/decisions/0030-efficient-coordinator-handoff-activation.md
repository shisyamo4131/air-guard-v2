# 0030 次回コーディネーター交代で発効する効率化手順

- 日付: 2026-08-30
- 状態: Accepted
- 発効状態: 承認済み・未発効。次回の利用者承認済みコーディネーター交代baselineで発効する。
- 関連仕様: 開発ガバナンスと進捗管理
- 関連判断: [0011 ロードマップとCodexセッションライフサイクル](0011-roadmap-and-codex-session-lifecycle.md)、[0013 Managed governance再構築](0013-managed-governance-reconstruction.md)、[0027 Codex task/session容量の明示routing](0027-codex-session-capacity-routing.md)

## 背景

PM（AirGuardV2）-08からPM（AirGuardV2）-09への交代では、安全確認に必要な新規task、primary repository、no-change callback、権限、最初のfile限定commitを維持した一方、次の重複があった。

- no-change checkpointで18文書の全文読了を指定し、common governanceが求めるtask-routed最小文書集合を超えた。
- no-change callback、activation callback、former coordinatorの再確認で同じrepository・governance・product状態を長文で反復した。
- handoff履歴だけを追記する専用commitで、同じdocumentation・managed governance・renderer検証をcommit前後に全件再実行した。
- append-onlyの旧handoff文書がcurrent restart stateと履歴を併せ持ち、交代ごとに読取量が増えた。

確認を省略するのではなく、durable sourceとGit object identityを使って重複だけを除く必要がある。

## 決定

### 発効境界

- 本ADRと準備文書のcommitは、現在のtask lifecycle、callback、所有権、承認、検証規則を変更しない。PM（AirGuardV2）-09を直ちに交代しない。
- 次回、利用者がコーディネーター交代を明示承認した後、retiring coordinatorがsafe checkpointとclean worktreeを確認し、一つのactivation baseline commitで`governance/project-rules.md`、`docs/runbooks/project-coordination.md`、`INITIAL_PROMPT.md`、文書索引およびcurrent handoff snapshotを同期する。
- そのactivation baseline commitは既に必要となった交代の一部として扱い、手順変更だけを理由とする追加の中間コーディネーター交代を挟まない。
- activation baselineのvalidatorまたはdiff reviewが失敗した場合は発効せず、現行手順とretiring coordinatorを維持する。

### 維持する安全確認

- 利用者によるコーディネーター交代承認。
- forkしない連番の完全新規task。
- 保存済みprimary repositoryへの直接接続と、Codex/linked/task-specific/alternate worktree不使用。
- exact baseline、branch、full HEAD、upstream、clean状態、worktree registry。
- managed permission profile、approval review policy、network境界、task ID・host、callback経路。
- file変更前のno-change callback 1回。
- replacement task自身による最初のreal file-scoped write、stage、local commit。
- callback retarget、former taskの重複所有防止、利用者だけがarchive/deleteする境界。

### 最小restart source set

replacement coordinatorは、次を最小必読集合とする。

1. `AGENTS.md`
2. `governance/project-rules.md`
3. `docs/README.md`
4. `docs/runbooks/project-coordination.md`
5. `docs/implementation/current-coordinator-handoff.md`
6. snapshotが明示する次checkpoint固有の仕様・ADR・roadmap・implementation文書

旧handoff履歴、CHANGELOG全体、全ADR、全roadmap、全implementation文書は、矛盾・不足・履歴照合が必要な場合だけ読む。初期promptへ文書本文や長いproduct stateを複製せず、baseline、task IDs、checkpoint ID、snapshot path、禁止範囲、callback destinationを渡す。

### compact callbackとverification

- no-change callbackはcheckpoint/state、task ID・host、cwd/top-level、branch/full HEAD/upstream、clean/worktree count、governance/specification、permission/review/network、active source paths、files/diff/tests、unverified、approval boundaryだけを固定順で報告する。snapshotにあるproduct stateを再掲しない。
- activation callbackはnew HEAD、exact committed path、diff、validator名とexit、staged/committed blob identity、clean/upstream/worktree、unverified、禁止操作0件だけを報告する。command全文と通常出力はtask logへ残し、失敗・警告だけをcallbackへ展開する。
- replacement taskの最初のcommitは`docs/implementation/current-coordinator-handoff.md`だけをactive ownerへ更新する。append-only履歴への長文追記は行わない。
- project documentation validator、managed governance validator、renderer `-Check`、`git diff --check`はcommit前に各1回実行する。exact staged path、no unstaged/untracked、staged blob IDを確認してからcommitする。
- commit後は`git diff --check HEAD^ HEAD`、exact committed path、committed blob IDとpre-commit staged blob IDの一致、branch/full HEAD/upstream、clean、primary-only worktreeを確認する。対象がsnapshot 1件だけでblob一致・cleanを証明できた場合、commit前に成功した三つのvalidatorを同じtaskで全件再実行しない。
- former coordinatorはcallback受領後、HEAD、exact committed path、clean、upstream、worktree registryだけを独立確認する。callbackとの不一致またはGit状態異常がある場合だけ詳細再検証へ拡張する。

### current snapshot

- `docs/implementation/current-coordinator-handoff.md`を、最新の再開状態だけを持つbounded documentとする。交代履歴はGitとhistorical handoff文書で保持する。
- snapshotはcoordinator/task/host、baseline、governance/specification、roadmap進捗、current checkpoint、完了済み境界、次工程、未統合作業、検証、承認・禁止範囲、callback destinationだけを記録する。
- retiring coordinatorが交代直前にsnapshotを置換更新し、replacement coordinatorの最初のcommitがowner・new HEAD・activation evidenceを確定する。

## 理由

完全新規task、direct repository、callback route、権限、最初のGit writeという故障検出能力は維持したまま、全文再読、長文再掲、重複validator、肥大化するappend-only restart文書を除ける。Git blob identityにより、commit前に検証した内容とcommitされた内容が同一であることを再検証できる。

## 代替案

- no-change callbackまたは最初のfile commitを廃止する案: repository route・権限・Git writeの故障を検出できないため採用しない。
- empty commitだけで権限確認する案: workspace file writeとexact staging scopeを検証できないため採用しない。
- 次のapplication変更を最初のcommitに使う案: ownership確定前にproduct変更へ進み、失敗時の旧新重複所有を招くため採用しない。
- 本ADRのcommit直後に効率化を発効する案: instruction-chain変更だけのために再度交代が必要となるため採用しない。

## 影響

- 現在: 文書準備だけで、PM（AirGuardV2）-09、active callback、permission、Git統合、product scopeは変わらない。即時task turnoverは不要である。
- 次回交代: activation baseline commit以降にだけ新手順を使う。no-changeと最初のreal file commitは維持する。
- application・data・Firebase: 影響なし。application code、Rules、deploy、network、remote/data操作を含まない。
- 検証: 文書準備ではproject documentation、managed governance、renderer、diffを確認する。次回発効時はactive instruction sourcesの同期とvalidatorを別途確認する。

## 移行とrollback

次回交代時は[準備済みrunbook](../runbooks/coordinator-handoff-efficient-activation.md)のactivation checklistを一つのbaseline checkpointとして実行する。発効前は現行の`docs/runbooks/project-coordination.md`を正とする。発効commit前の問題は変更をcommitせず停止し、発効commit後かつreplacement ownership確定前の問題は別のcorrective commitまたは安全なrevertで現行手順へ戻し、retiring coordinatorを維持する。history rewriteは行わない。

## 再検討条件

Codexがreplacement taskのrepository・permission・callback・Git writeを単一のproduct primitiveとして検証できるようになった場合、またはvalidatorがcommit treeを直接検証できるようになった場合。
