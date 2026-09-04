# project coordination runbook

- 状態: 運用中
- 最終確認日: 2026-09-04
- 役割: Git統合、event-driven task loop、session容量とhandoff

## Git統合

- 作業単位ごとにユーザーとbranch境界を相談し、原則として機能単位の `codex/<機能名>` ブランチを合意済み基準から作成する。開始時に現在ブランチ、基準コミット、作業ツリーを確認する。
- Codexはlocal branch作成・切替、review済みfileのstage・commit、差分確認を担当する。利用者または別taskの未コミット変更を独自判断で修正、破棄、stage、commitしない。
- 専門タスクは担当ファイルだけを編集・検証し、原則としてステージやコミットを行わない。
- 専門タスクはチェックポイントID、正確な変更ファイル、差分、テスト、未確認事項、承認境界、作業ツリー状態をコーディネーターへ報告する。
- コーディネーターは差分と仕様・ロードマップとの整合を確認し、承認済み作業単位のreview済みfileだけをステージ、コミット、統合する。利用者または別taskの変更をcommit対象に含める場合は対象差分と検証状態をユーザーと確認する。専門タスクが既にコミットを作成している場合は、確認後に再利用する。
- 並行書込みでは共通の基準コミットとチェックポイントIDを使用し、担当ファイルを重複させない。限定された一群を統合・検証してから次の共通基準へ昇格する。
- 未統合の変更を、別タスクの確定済み依存関係として扱わない。統合待ちがある場合は新規割当より統合を優先する。
- ユーザーは機能ブランチ上の動作を確認する。明示的な受入れ承認を得るまで `main` へマージしない。
- `main` へは原則としてマージコミットを作成し、機能単位の統合境界を残す。競合解消後に関連テストとガバナンス検証を再実行する。
- `main` への直接コミット、`main` へのマージ、Git push、履歴書換え、デプロイは、それぞれユーザーが対象操作を明示した場合だけ行う。
- 受入れ後に問題が判明した場合は、機能単位のマージコミットをrevert可能か、データ・契約互換性を確認する。安全にrevertできない場合は修正ブランチと移行・復旧手順を用意する。

## Git現在状態の報告

報告義務と承認境界は[project rules](../../governance/project-rules.md#project-specific-progress-and-reporting)を正とする。localとremoteを次の順序で照合する。

1. primary repositoryで`git status --short --branch`、`git rev-parse HEAD`とbranch/upstream設定を確認する。未コミット差分と、commit済みだが未共有の変更を分ける。
2. 設定済みremoteと対象branchを実targetから特定する。remoteの取得先とpush先が異なる場合は区別し、URL内の秘密値を出力しない。
3. 当該remoteへの読取りが承認済みなら、`git ls-remote --symref`でHEADと対象branchの先端を直接確認し、commandのexit statusと確認時刻を記録する。成功応答に対象branchがなければ不存在、接続・認証失敗なら未確認とする。認証更新や証明書検証の無効化で迂回しない。
4. 取得したremote先端のcommit objectがlocalにも存在する場合は、`git rev-list --left-right --count`で明示した2つのrevisionを比較する。object不足時は先行・遅延数を未確認とし、そのためだけに無断fetchしない。upstream未設定のbranchをmainと比較する場合は、upstreamとの差ではなくmainとの差であることを明記する。
5. localのremote-tracking refは最後に取得した記録であり、当該報告時のremote照合とは別の証拠として扱う。live確認不能でもremote欄を省略せず、未確認の理由とlocal記録から分かる範囲を分ける。

現在のcommitやremote実測値を本runbookへ蓄積せず、当該報告または必要な実行証拠に置く。既存のcommit・製品dataは変更せず、この報告手順のrollbackは承認済み文書変更の安全なrevertで行う。

## プロジェクト管理タスクループ

長期作業は、定時確認ではなくタスク間通知を用いたイベント駆動型を標準とします。

### 通常startup

すべてのtaskは`AGENTS.md`、`governance/project-rules.md`、`docs/README.md`から依頼に必要な正本を読み、primary repositoryのGit状態・scope・承認・次作業を照合する。製品再開の案内は[現在の製品作業](../implementation/current-coordinator-handoff.md)。手動作成、利用者要求の交代、旧task利用不能時も同じ経路とし、旧ownerの協力やactivationを前提にしない。

installed scaffold skillは明示されたgovernance作成・採用・移行・更新でだけ使用し、日常作業ではrepositoryの指示を使用する。[旧handoff効率化runbook](coordinator-handoff-efficient-activation.md)はHistoricalであり、通常startupに適用しない。
### 開始確認

1. コーディネーターと専門タスクのID・ホストを記録し、全taskのcwdとGit top-levelが利用者repository `C:\Users\seven\projects\AirGuard\air-guard-v2`そのものであることを確認する。Codex専用worktreeは作成・使用しない。
2. 現在のロードマップ、基準コミット、チェックポイントID、担当・禁止ファイル、承認境界を確認する。
3. 終了条件を記録する。標準は「安全に独立実行できる作業が尽きた時点」とする。
4. コールバック先を記録する。
5. 通常の委譲task作成またはCodexアプリ再起動後は、ファイルを変更しない確認用チェックポイントを送り、次の形式のコールバックが1回到達することを確認する。

```text
<checkpoint-id> <completed|failed|question|approval-boundary>
files: <exact paths or none>
diff: <summary or none>
tests: <commands and results or not run>
unverified: <items or none>
approval-boundaries: <items or none>
worktree: <clean or exact dirty paths>
```

### 通常ループ

1. Codexが現行挙動、変更契約、影響、rollback、test条件を、利用者が理解・判断できる最小単位に整理する。
2. task交代中を除き、設計・調査・code探索・review・development・testに実作業があり、独立した非重複scopeへ分割でき、専門roleの結果が必要な場合は、Codexが原則として適切な専門タスクへ割り当てる。単一の小作業を形式分割しない。同一checkpoint内で相互に依存しない複数workstreamは、同じ確認済みbaseline、重複しないownership、個別のcompletion contract・callback先、利用可能な実行枠を固定して原則同時に割り当てる。application code、必要なFunctions・Firebase Rules・関連設定は承認済みboundary内で`developer`へ集中させる。
3. 専門タスクは完了、失敗、仕様質問、承認境界で一度だけ通知し、待機する。
4. コーディネーターはprimary taskの司令塔として、ユーザーまたは全専門タスクの報告、差分、テスト、未確認事項、承認境界、作業ツリー、仕様・ロードマップとの整合を照合し、矛盾を解消して統合する。critical identifier、approval・scope、最終diff・worktree、必須検証のexit status、Git統合、completion claimは自身で確認する。全結果を統合する前に次checkpointへ進まない。
5. 合意済み変更をコミットし、必要な統合検証とdocument同期を行う。
6. 終了条件に達していなければ次のチェックポイントへ進む。

local UI受入れの担当は[project rules](../../governance/project-rules.md)と[local UI検証runbook](local-ui-testing.md)で決める。条件を満たす既存画面・既存操作の内部改修はCodex専用local UIで完了し、省略除外条件がある範囲だけ利用者受入れ待ちとする。application fileの利用者確認を1 fileずつ要求するのはcheckpointが明示した場合だけとし、通常は承認済みsegment単位で連続実装・検証・報告する。

利用者のChrome・profile・session、desktop app、Dev・Prod・remote UI、外部account・session・stateを扱う操作は、必要な承認後もコーディネーターが直接行い、専門タスクへ委譲しない。Codex専用demo project、loopback、合成data、in-app browserに限定したlocal UIは`ui_tester`へ委譲できる。公式情報のread-only Web調査と承認済みlocal CLI・Emulator検証はこの直轄範囲に含めない。この担当分離はnetwork、外部write、remote/data、deploy権限を追加しない。

通常の割当・通知は利用者へ逐次報告せず、終了時または早期停止時に統合して報告します。承認、安全・外部作用・破壊的操作の境界、テスト失敗、仕様競合、進捗低下、タスク・作業ツリー消失、状態取得・コールバック障害、容量閾値は直ちに報告します。突然の終了で統合報告できなかった場合は、再開後最初の確認で未報告期間をまとめます。

通知に失敗した専門タスクは再送を繰り返さず、完全な最終結果をそのタスクに残して停止します。コーディネーターは状態を安全に1回だけ再取得し、最新指示と照合できなければ同じ割当を再送しません。コールバックを利用できない場合、またはユーザーが明示した場合だけ差分型ポーリングへ切り替え、対象、間隔、停止条件を記録します。変更なしの確認は通知せず、確認間隔を作業期限とみなしません。

checkpoint固有のsubagent禁止は、そのcheckpointの開始からterminal callbackとcoordinator reviewまでに限ります。完了後のcheckpointへ自動的に持ち越さず、継続禁止には利用者による別の明示指示を必要とします。利用者要求の交代作成はcoordinator自身が行います。交代専用のno-change、activation、最初のfile限定commitは設けず、通常startupを使用します。

### Critical identifierの確認

- package名・version・integrity、repository・branch・commit・tag、Firebase project・database、deploy先、data対象は、当該turnにtask-routed正本または実targetから取得するまで未確認です。chat、要約、memory、親prompt、agent reportは手掛かりに限定します。
- coordinatorは確認したsource/location/command/valueだけをdelegationへ記載し、委譲先にもstate change前の独立照合を要求します。矛盾時はfile write、Git mutation、test、install、networkを開始せずcallbackします。
- Schemas consumer変更では[package release runbook](package-release.md)の`PreAdoption`を変更前、`PostAdoption`を変更後に実行します。source tag manifest、release evidence、root/Functions manifest・lockのname、version、resolved、integrityが一つのchainとして一致しなければ停止します。
- network未承認時はremote registryの現在状態を推測せず、local source/tagと記録済み公開証拠までを確認済みとして報告します。

## Codexセッションのライフサイクル

### 容量確認

`容量チェック`、`タスク容量確認`、`セッション容量確認`、`session size / handoff threshold確認`は同じtask容量確認指示として、この節へrouteしてから回答します。これらはmodelのtoken数やcontext windowではなく、現在taskの永続Codex session JSONL容量を意味します。

容量確認が依頼されたときにtrusted task metadataから現在のtask IDを特定して測定します。交代専用の測定や定期測定をstartup条件にしません。並行taskの有無にかかわらず、最新・最終更新sessionやtimestampから対象を推測しません。

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-codex-session-size.ps1 -SessionId <current-task-id>
```

commandの結果とexit statusを独立して確認します。scriptは指定IDに一致するsession fileを正確に1件だけ解決しなければなりません。

標準報告は次をすべて含めます。

- target task IDとresolved session file。
- session size MiB、handoff threshold MiB、usage percentage、`handoff_required`。
- Codex全体の参考容量と10 GiB warning threshold。
- total scanのcomplete/error count。
- session測定時刻、Codex全体の測定時刻・source。
- command resultと独立して観測したexit status。

コーディネーターと専門taskのhandoff閾値は300 MiBです。`handoff_required`が`true`の場合だけtask交代を提案します。`false`の場合、taskの経過時間、会話の長さ、token/context推測を根拠に交代を勧めません。Codex全体の10 GiBは参考警告であり、task handoffや削除を自動実行する基準ではありません。

停止・error契約は次のとおりです。

- 現在task IDを特定できない場合はIDを確認し、推測しません。
- ID一致が0件または複数件なら件数とnonzero exitを報告して停止します。
- script失敗時は簡潔なerrorとnonzero exitを報告し、handoff結論を出しません。
- `codex_scan_complete`が`false`なら`codex_scan_error_count`を報告します。task単体測定は報告できますが、Codex全体を完全な容量、cleanup、threshold判断の証拠にしません。
- `.codex/sessions`の本文、prompt、credential、秘密情報、業務dataを読み上げたり出力したりしません。Codex所有SQLite・WALを照会・変更しません。

### 利用者が要求したtask交代

1. 現在の製品事実・未決事項・次作業を既存の正本に反映し、必要な検証・reviewを行う。他者差分を保持し、未完了の製品割当を停止する。
2. review済みの関連変更を意味のある単位でlocal commitし、primary repositoryをcleanにする。変更がなければ交代専用のcommitを作らない。
3. 保存済みprimaryへ同じ基本名と次の連番でfresh non-fork taskを作成する。新taskは上記の通常startupで作業を始める。

governance編集だけで交代を強制しない。task registry、owner状態、交代履歴/cache、generation、handshake、交代専用validatorやprofileを追加しない。必要な製品factsは既存正本、旧本文はGitに残す。判断は[ADR 0045](../decisions/0045-governance-3-normal-startup.md)、共通契約は[Task Replacement](../../references/task-turnover-contract.md)を参照する。

Codexは旧taskのarchive/deleteを実行・依頼しない。archiveは利用者の操作であり、保存容量の縮小を保証しない。Codex所有のSQLite、WAL、session記録の直接削除や定常的な`VACUUM`は通常運用に含めない。
