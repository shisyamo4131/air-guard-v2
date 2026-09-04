# Coordination and Git rules

- 状態: Active
- 役割: coordinator、subagent、checkpoint、branch、Git統合、task lifecycleに関するAirGuardV2固有規則
- 入口: [project rules index](../../governance/project-rules.md)

## 担当と並列化

- primary taskをcoordinatorとし、別のcoordinator subagentを作らない。coordinatorは仕様・scope・checkpoint・ownershipを整理し、報告を照合して差分・検証・文書・Git・完了判断へ統合する。
- 設計、調査、code探索、review、development、testに実作業があり、独立した非重複scopeへ分割でき、専門結果が必要な場合は適切なsubagentを使う。単一の小作業を形式的に分割せず、最終reviewまたは障害対応に必要な実行枠を残す。
- 相互非依存workstreamは、同じ確認済みbaseline、重複しないownership、個別のcompletion contract・callback先を固定して原則並列に進める。依存・ownership重複・枠不足時は直列化し、全結果を統合する前に次checkpointへ進まない。
- application code、必要なFunctions・Firebase Rules・関連設定のwriterは承認済みcheckpointの`developer`へ集中させる。`tester`は明示されたtest scopeだけを書ける。explorer、researcher、reviewer、UI tester、security reviewerはread-onlyとする。
- 基本roleは`developer`、`tester`、`code_explorer`、`docs_researcher`、`reviewer`とする。専用local UIを実操作するときだけ`ui_tester`、security境界を独立確認するときは`security_reviewer`を選ぶ。権限とtoolの正本は`.codex/agents/*.toml`とし、promptで拡張しない。
- 利用者のChrome・profile・session、desktop app、Dev・Prod・remote UI、外部account・session・stateは、必要な承認後もcoordinatorが直接操作する。Codex専用demo・loopback・合成data・in-app browserのlocal UIだけは`ui_tester`へ委譲できる。
- 専門taskは原則stage・commitせず、checkpoint ID、変更file、diff、testとexit、未確認事項、承認境界、worktreeを一度だけ報告する。callback失敗時は再送を繰り返さず、完全な結果をtaskへ残して停止する。
- checkpoint固有のsubagent禁止は、そのcheckpointのterminal callbackとcoordinator reviewまでに限り、後続checkpointへ持ち越さない。

## Checkpointとbranch境界

- checkpoint開始時に、current branch、開始commit、branchが表す作業単位、今回scopeがその名称・宣言内かを確認する。狭いtrial・checkpoint名のbranchへ後続scopeを黙って追加しない。
- scopeがbranch境界外なら、write前に新branch、既存branchの明示継続、その他の統合方法を利用者と決める。task交代だけではbranchを変更しない。別worktree、history rewrite、無断renameは行わない。
- 変更済みcheckpointから次へ進む前に、[checkpoint transition](../runbooks/project-coordination.md#checkpoint-transition)を完了する。未統合差分、必須gate、review、証拠、staleな現行記述が残る間は次checkpointを開始しない。
- coordinatorはcritical identifier、承認・scope、最終diff・worktree、必須gateのexit、stage・commit、completion claimを自分で確認する。他者の未コミット変更を独自に修正・破棄・stage・commitしない。

## Gitと報告

- 機能branch上の動作を利用者が確認し明示承認するまで`main`へmergeしない。`main`への直接commit・merge、push、history rewriteはそれぞれ別の明示指示を必要とする。
- review済みfileだけを意味のある単位でlocal commitする。branch名だけで含有scopeを推測せず、統合前にbase..HEADのcommitとfileを確認する。
- 現在地報告は[project coordination](../runbooks/project-coordination.md#git現在状態の報告)に従いlocalとremoteを区別する。live remoteを取得していない場合はremote未確認とする。
- 公式進捗は`docs/roadmaps/airguard-v2.md`を正とし、実測証拠のない進捗を加点しない。完了報告は変更挙動・file、文書整合、検証、未検証、risk、設定・移行、利用者の次操作を示す。

## Task lifecycle

- 長期作業はreview可能なcheckpointを1件ずつ割り当て、完了・失敗・仕様質問・承認境界でcallbackし、coordinator review後に次へ進む。標準終了条件は安全に独立実行できる作業が尽きた時点である。
- 容量確認は[project coordination](../runbooks/project-coordination.md#容量確認)へrouteし、現在task IDのsessionだけを測る。時間や推測token量を交代理由にしない。`handoff_required=true`なら新規割当を止め、baseline、進捗、checkpoint、未統合差分、test、承認事項、次の指示をrepositoryへ記録してから交代を提案する。
- 利用者がtask交代を要求した場合、現行factsと次作業を正本へ反映し、関連変更をcommitしてprimaryをcleanにした後、同じ基本名の次連番をfresh non-fork taskとして作る。交代専用の空commit、registry、cache、handshakeを追加しない。
- 新taskは通常startupを使う。旧taskのarchive・deleteは利用者の操作であり、Codexは実行・依頼しない。
