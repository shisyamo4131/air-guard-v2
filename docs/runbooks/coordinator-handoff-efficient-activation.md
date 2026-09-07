# coordinator handoff効率化の次回発効runbook

- 状態: Historical / superseded by [ADR 0045](../decisions/0045-governance-3-normal-startup.md)
- 承認日: 2026-08-30
- 発効条件: 次回、利用者が明示承認したAirGuardV2 coordinator交代のactivation baseline commit
- 現在の正本: [project coordination runbook](project-coordination.md)と[current coordinator snapshot](../implementation/current-coordinator-handoff.md)
- 判断: [ADR 0030](../decisions/0030-efficient-coordinator-handoff-activation.md)

このrunbookは2026-08-30の利用者承認済みPM-09からPM-10への交代activation baselineから発効した。以後のhandoffは本書とproject coordination runbookを使用する。

task交代、no-change確認、ownership activation、callback・assignmentのretarget、replacement taskの最初のfile限定commitはretiring/replacement coordinator自身が実施し、このrunbookの開始からownership確定までsubagentを使用しない。交代前checkpointのsubagent禁止はそのcheckpointだけに限定し、交代完了後のproduct checkpointへ持ち越さない。

> 以下は当時の手順を保存した履歴です。現在の起動・交代へ適用しません。現行手順は[project coordination](project-coordination.md#通常startup)を使用します。

## 発効前の停止条件

- 利用者が次回coordinator交代を明示承認していない。
- retiring coordinatorがsafe checkpointにいない、worktreeがdirty、未統合作業がある、またはbaselineを確定できない。
- current handoff snapshot、task IDs/hosts、callback destination、permission/review/network境界に不足または矛盾がある。
- activation対象外のapplication、Rules、test、managed common artifact、data、deploy、network、remote操作が混在する。

いずれかに該当した場合は未発効のまま現行手順を維持する。

## Activation baseline checkpoint

retiring coordinatorは次の一つのcheckpointで発効準備を行う。

1. `docs/implementation/current-coordinator-handoff.md`を最新baseline、現在状態、次工程、未統合作業、検証、承認境界、former/new task routingで置換更新する。
2. `governance/project-rules.md`のtask lifecycleをADR 0030の最小restart source、compact callback、validator再利用、bounded snapshotへ切り替える。
3. `docs/runbooks/project-coordination.md`の安全な引継ぎを本runbookの発効後手順へ同期する。
4. `INITIAL_PROMPT.md`を最小restart sourceとcompact callbackへ同期する。
5. `docs/README.md`と`docs/runbooks/README.md`で本runbookをConfirmed/activeへ変更し、旧append-only handoffをHistoricalへ変更する。
6. ADR 0030の発効状態とsnapshotの状態をactive baselineへ更新する。
7. project documentation validator、managed governance validator、renderer `-Check`、`git diff --check`を各独立commandで実行し、review済み対象だけを一つのlocal activation baseline commitにする。
8. branch、full HEAD、upstream none、clean、primary-only worktreeとexact committed pathsを確認する。失敗時はreplacement taskを作成しない。

このbaselineは、すでに利用者が承認した次回交代の一部である。効率化発効だけを目的とする中間coordinatorを作成しない。

## Replacement taskへの最小入力

初期messageは次だけを直接含め、product state本文を複製しない。

- former/new coordinator名、task IDs、host、callback destination。
- activation baselineのbranchとfull commit。
- common governance version/hash、specification version。
- checkpoint IDと`docs/implementation/current-coordinator-handoff.md`。
- primary repository direct接続、no fork/worktree、許可・禁止操作。
- no-change receiptの形式と、成功後に待機する指示。

replacement taskの必読集合は`AGENTS.md`、`governance/project-rules.md`、`docs/README.md`、`docs/runbooks/project-coordination.md`、current snapshot、snapshotが指定する次checkpoint固有文書だけとする。不足・競合があれば必要な履歴へ拡張する。

## No-change receipt

```text
<checkpoint> COMPLETE|FAILED
task: <id> host <host>
repo: <cwd> / top-level <path>
git: <branch> <full-head> upstream <none|name> clean <true|false> worktrees <count>
governance: <version> <hash> specification <version>
permissions: <sandbox> / <review> / network <state>
sources: <exact paths>
files: none
diff: none
tests: not run
unverified: <none or exact items>
approval-boundaries: <summary>
```

成功receiptをformer coordinatorが受領するまでfile write・Git mutation・product作業を行わない。失敗時はformer coordinatorを維持する。

## 最初のreal file-scoped commit

no-change成功後、replacement taskは`docs/implementation/current-coordinator-handoff.md`だけをactive ownerへ更新する。

1. exact owned pathと他path 0件を確認する。
2. project documentation validator、managed governance validator、renderer `-Check`、`git diff --check`を各1回実行する。
3. exact pathだけをstageし、`git diff --cached --check`、exact staged path、no unstaged/untrackedを確認する。
4. `git rev-parse :docs/implementation/current-coordinator-handoff.md`でstaged blob IDを記録する。
5. 指定messageでlocal commitする。
6. `git diff --check HEAD^ HEAD`、exact committed path、`git rev-parse HEAD:docs/implementation/current-coordinator-handoff.md`とstaged blob IDの一致、branch/full HEAD/upstream、clean、primary-only worktreeを確認する。
7. snapshot 1件だけ、blob一致、cleanが成立した場合、手順2で成功した三validatorをcommit後に再実行しない。不一致時はownershipを移管せず停止する。

## Activation receiptとformer coordinator確認

```text
<checkpoint> COMPLETE|FAILED
task: <id> host <host>
baseline/new-head: <commit> / <commit>
committed: docs/implementation/current-coordinator-handoff.md
diff: <summary>
validators: project-docs <exit>; governance <exit>; renderer <exit>; diff <exit>
blob: staged <id> committed <id> match <true|false>
git: <branch> upstream <none|name> clean <true|false> worktrees <count>
unverified: <none or exact items>
prohibited-actions: 0
```

former coordinatorはHEAD、exact committed path、clean、upstream、worktree registryだけを独立確認する。一致すればassignment/callbackをreplacementへretargetし、ownershipをretireする。不一致時だけ詳細確認へ拡張し、former coordinatorを維持する。

## 完了とrollback

- 完了: replacement taskがactive ownerとしてsnapshotをcommitし、receiptとformer coordinatorの最小確認が一致した時点。
- former task: Codexはarchive/deleteせず、利用者が手動削除できる状態として報告する。
- rollback: ownership確定前の失敗ではformer coordinatorを維持する。activation baseline自体に問題があればhistory rewriteせずcorrective commitまたは安全なrevertを使う。
