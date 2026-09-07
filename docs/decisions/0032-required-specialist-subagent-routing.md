# 0032 独立scopeへの専門subagent利用とCheckpoint限定禁止

- 日付: 2026-08-30
- 状態: Accepted
- 関連仕様: 開発ガバナンスと進捗管理
- 関連判断: [0005 マルチエージェント体制とEmulator検証](0005-multi-agent-and-emulator-testing.md)、[0011 ロードマップとCodexセッションライフサイクル](0011-roadmap-and-codex-session-lifecycle.md)、[0015 利用者主導実装とCodex assurance](0015-user-led-implementation-and-codex-assurance.md)、[0030 coordinator handoff効率化](0030-efficient-coordinator-handoff-activation.md)

## 背景

旧coordinatorから渡されたno-change、ownership activation、read-only rollback inventoryの各Checkpointには、そのCheckpoint内でsubagentを使わない制約があった。これらは交代経路や単一調査の境界を固定する一時的な制約だったが、後続のCompany改修でもsubagentが使われず、Checkpoint限定禁止と継続的なproject運用の区別が不明瞭になった。

AirGuardV2にはcode探索、security確認、test、review、利用者が明示した補助実装を独立scopeへ分けられる作業がある。必要な専門結果を並行して得られる場合は、既存のproject-scoped roleを実際に使用する必要がある。一方、task交代はrepository route、ownership、callback、最初のGit writeを一つのcoordinator経路で検証するため、subagentを混在させない。

## 決定

- task交代中を除き、調査、code探索、review、test、利用者承認済みcheckpointの実装等を独立した非重複scopeへ分割でき、専門roleの結果が必要な場合、coordinatorは適切なsubagentを使用する。
- 単一の小作業を形式的に分割せず、不要なroleを起動しない。並行書込みはfile ownershipを重複させず、application code、必要なFunctions・Firebase Rules・関連設定は承認済みboundary内で`developer`へ集中させる。
- checkpointでsubagent禁止を指定した場合、その禁止は当該checkpointの開始からterminal callbackとcoordinator reviewまでに限定する。後続checkpointまたはproject全体へ自動的に持ち越さない。
- task交代、no-change確認、ownership activation、callback・assignmentのretarget、replacement taskの最初のfile限定commitはcoordinator自身が行い、その交代手順内ではsubagentを使用しない。
- coordinatorは全依頼結果を待ち、差分、test、未確認事項、承認境界を統合してから完了を判断する。既存のcoordinator-owned Git統合とrole別権限は変更しない。

## 理由

独立した専門確認を一つのcoordinatorだけで直列処理する状態を避け、調査速度とreviewの独立性を高めるためである。同時に、必要性のないagent起動、重複調査、重複書込みを防ぎ、task交代ではownership検証経路を一つに保つ。

## 代替案

- subagent利用をcoordinatorの任意判断だけにする案: 独立分割可能な作業でも使用されない状態が続いたため採用しない。
- すべての作業で必ず複数agentを使う案: 小さな連続作業で調整負荷が結果を上回り、共通ガバナンスの「必要なroleだけを使う」規則にも反するため採用しない。
- task交代でもsubagentを使う案: repository route、ownership、callback、最初のGit writeの責任経路が分散するため採用しない。
- Checkpoint禁止を後続作業へ継続する案: 禁止scopeを利用者の意図より拡張するため採用しない。

## 影響

- 利用者: 独立分割できる作業では、coordinatorが必要な専門agentを選び、統合結果を日本語で分かりやすく報告する。
- 実装: ADR 0034に従い、利用者承認済みcheckpoint内ではCodexの`developer`を標準実装担当とする。承認scope、role別権限、coordinator-owned Git統合は維持する。
- Git: 専門taskは原則stage・commitせず、coordinatorがreview済みfileだけを統合する既存契約を維持する。
- data・外部作用: 権限拡張はない。Dev、Prod、remote/data操作、push、deployの承認境界を変更しない。
- task lifecycle: project-wide delegation方針のinstruction-chain変更であるため、反映commit後に利用者の明示承認を得てaffected coordinatorを完全新規taskへ交代する。

## 移行とrollback

`governance/project-rules.md`、現行仕様、project coordination runbook、開始prompt、current snapshotを同期し、project documentation validator、managed governance validator、renderer `-Check`、`git diff --check`を独立して実行する。変更commitに問題があればhistory rewriteを行わず、安全なrevertまたはcorrective commitで従来の任意routingへ戻す。

coordinator交代は利用者の別の明示承認後にADR 0030の手順で実施する。交代中は本ADRのsubagent利用義務を適用せず、replacement taskのownership activation完了後から通常作業へ適用する。

## 再検討条件

Codexのsubagent機能、concurrency、task間共有、権限継承、callback、Git ownershipの仕組みが変わった場合、または運用証拠から専門agent利用が品質・速度を悪化させる具体的な問題が確認された場合。
