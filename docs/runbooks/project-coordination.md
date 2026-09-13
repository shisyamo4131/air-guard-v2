# project coordination runbook

- 状態: 運用中
- 最終確認日: 2026-09-12（文書整理）
- 役割: Git統合、event-driven task loop、session容量とhandoff

## Git統合

担当、所有範囲、並列化、未統合変更の扱いとGit承認は[Coordination and Git rules](../project-rules/coordination-and-git.md)、deploy承認は[Environment and approval rules](../project-rules/environment-and-approval.md)に従う。

1. [Git現在状態](#git現在状態の報告)を確認し、作業単位ごとにユーザーとbranch境界を相談する。原則は合意済み基準から機能単位の`codex/<機能名>`を作成する。
2. [Checkpoint transition](#checkpoint-transition)でreview・文書・検証を照合し、承認済みのreview済みfileだけをstage・commitする。利用者または別taskの差分を含める場合は対象と検証状態を利用者と確認する。専門taskの既存commitは確認後に再利用する。
3. `main`への承認済み統合は原則merge commitで機能単位の境界を残し、競合解消後に関連testとgovernance検証を再実行する。
4. 受入れ後の問題はdata・契約互換性を確認してmerge commitをrevert可能か判断する。安全に戻せなければ修正branchと移行・復旧手順を用意する。

## Git現在状態の報告

報告義務と承認境界は[Coordination and Git rules](../project-rules/coordination-and-git.md#gitと報告)を正とする。localとremoteを次の順序で照合する。

1. primary repositoryで`git status --short --branch`、`git rev-parse HEAD`とbranch/upstream設定を確認する。未コミット差分と、commit済みだが未共有の変更を分ける。
2. 設定済みremoteと対象branchを実targetから特定する。remoteの取得先とpush先が異なる場合は区別し、URL内の秘密値を出力しない。
3. 当該remoteへの読取りが承認済みなら、`git ls-remote --symref`でHEADと対象branchの先端を直接確認し、commandのexit statusと確認時刻を記録する。成功応答に対象branchがなければ不存在、接続・認証失敗なら未確認とする。認証更新や証明書検証の無効化で迂回しない。
4. 取得したremote先端のcommit objectがlocalにも存在する場合は、`git rev-list --left-right --count`で明示した2つのrevisionを比較する。object不足時は先行・遅延数を未確認とし、そのためだけに無断fetchしない。upstream未設定のbranchをmainと比較する場合は、upstreamとの差ではなくmainとの差であることを明記する。
5. localのremote-tracking refは最後に取得した記録であり、当該報告時のremote照合とは別の証拠として扱う。live確認不能でもremote欄を省略せず、未確認の理由とlocal記録から分かる範囲を分ける。

実測値は当該報告または実行証拠へ置く。読取り報告でcommit・製品dataを変更しない。手順の復元は承認済み文書変更を安全にrevertする。

## プロジェクト管理タスクループ

開始確認 → callback → transition → Git統合の順に進める。長期作業の割当単位と終了条件は[Task lifecycle](../project-rules/coordination-and-git.md#task-lifecycle)を正とする。

### 通常startup

[必須の読取り順](../../governance/project-rules.md#必須の読取り順)の後、[Git現在状態](#git現在状態の報告)と[製品再開案内](../implementation/current-coordinator-handoff.md)からscope・承認・次作業を照合する。手動作成・交代・旧task利用不能時も同じ手順を使い、旧ownerの協力・activationを前提にしない。

installed scaffold skillは明示されたgovernance作成・採用・移行・更新でだけ使用し、日常作業ではrepositoryの指示を使用する。[旧handoff効率化runbook](coordinator-handoff-efficient-activation.md)はHistoricalであり、通常startupに適用しない。

### 開始確認

1. coordinatorと専門taskのID・hostを記録し、全taskのcwdとGit top-levelを[primary repository](../../governance/project-rules.md#常時適用する境界)へ照合する。Codex専用worktreeは作成・使用しない。
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

1. 現行挙動、変更契約、影響、rollback、test条件を利用者が判断できる最小単位に整理する。
2. [担当と並列化](../project-rules/coordination-and-git.md#担当と並列化)に従い、専門task・ownership・callbackを固定して独立scopeだけを割り当てる。
3. 完了・失敗・仕様質問・承認境界のcallbackを受け、coordinatorが全報告と差分を照合し、矛盾を解消する。専門taskは一度通知して待機する。
4. 次の[Checkpoint transition](#checkpoint-transition)を満たして[Git統合](#git統合)へ進む。release・外部受入れ後の追加記録はverification policyの失効条件に従う。
5. 終了条件に達していなければ次checkpointへ進む。

### Checkpoint transition

document同期・独立review・選択済みcompletion gate（後続変更で失効したgateの再実行を含む）を終え、commit・次checkpoint開始・完了主張の前に次の4点を一度確認する。不足があれば次を開始せず、現在checkpointへ戻す。

1. 承認済み目的・完了条件ごとに成果と検証証拠を対応づけ、未達・未検証・合意した途中追加・独立問題の後続送りを区別する。[scope規則](../project-rules/development-and-data.md#フェーズごとのテスト範囲の合意)に反する後続送りは認めない。開始baselineから最終差分までのfileで`governance/verification-policy.json`のclass unionとcompletion gateを確定する。
2. 各必須gateのexact command、結果、独立exit status、後続編集による失効有無、verification receiptまたはcompletion reportの保存先を確認する。task内の一時出力だけを永続証拠にしない。
3. milestoneやcheckpoint状態を変えた場合は、影響した機能文書群に限定して前後checkpoint ID、旧状態語、rollback記述を検索し、各hitをCurrentまたはHistoryへ分類する。履歴は時点を明記し、現行手順・残作業・rollbackは一つの正本へ寄せる。
4. current branch、開始commit、branchが表すscope、今回scopeが名称・宣言内かを再確認する。狭いtrial/checkpoint branchへ後続scopeを追加する場合は、write前にbranch境界を利用者と決める。

このtransitionは既存gateと正本確認を閉じる手順であり、新しいstatus registry、branch manifest、全doc semantic validator、checkpointごとのADRを要求しない。

環境検証は[環境規則](../project-rules/environment-and-approval.md#local-emulatorとlocal-ui)から該当runbookへ進み、このtask loopへ個別手順を複写しない。

通常の割当・通知は終了・早期停止時に統合報告する。承認・安全・外部作用・破壊操作の境界、test失敗、仕様競合、進捗低下、task・worktree消失、状態取得・callback障害、容量閾値は即時報告する。突然終了した場合は再開後最初の確認で未報告期間をまとめる。

callback失敗時は[担当と並列化](../project-rules/coordination-and-git.md#担当と並列化)に従い専門taskを停止する。coordinatorは安全に1回だけ状態を再取得し、最新指示と照合できなければ再送しない。callback利用不能または利用者の明示選択時だけ差分型pollingへ切り替え、対象・間隔・停止条件を記録する。変更なしは通知せず、間隔を期限とみなさない。

checkpoint固有のsubagent禁止の有効範囲は[担当と並列化](../project-rules/coordination-and-git.md#担当と並列化)に従う。継続禁止には利用者による別の明示指示を必要とする。利用者要求の交代はcoordinator自身が[task交代手順](#利用者が要求したtask交代)を実施する。

### Critical identifierの確認

- 確認根拠とcoordinator・委譲先の独立照合は[共通契約](../../governance/common-governance.md#evidence-bound-critical-identifiers)に従います。矛盾時はfile write、Git mutation、test、install、networkを開始せずcallbackします。
- repository・branch・commitは[Git現在状態の報告](#git現在状態の報告)、package・version・integrityは[package release runbook](package-release.md)の`PreAdoption` / `PostAdoption`、環境・data対象は[project rule routing](../../governance/project-rules.md#project-rule-routing)から該当手順を選びます。

## Codexセッションのライフサイクル

### 容量確認

`容量チェック`、`タスク容量確認`、`セッション容量確認`、`session size / handoff threshold確認`は同じtask容量確認指示として、この節へrouteしてから回答します。これらはmodelのtoken数やcontext windowではなく、現在taskの永続Codex session JSONL容量を意味します。

依頼時にtrusted task metadataから現在task IDを特定する。最新・最終更新sessionやtimestampから推測せず、交代専用測定・定期測定をstartup条件にしない。

```powershell
pwsh -NoProfile -File scripts/check-codex-session-size.ps1 -SessionId <current-task-id>
```

指定IDのsessionが正確に1件であること、command結果と独立exit statusを確認する。

標準報告は次をすべて含めます。

- target task IDとresolved session file。
- session size MiB、handoff threshold MiB、usage percentage、`handoff_required`。
- Codex全体の参考容量と10 GiB warning threshold。
- total scanのcomplete/error count。
- session測定時刻、Codex全体の測定時刻・source。
- command resultと独立して観測したexit status。

coordinator・専門taskとも閾値は300 MiB。`handoff_required=true`の場合だけ交代を提案し、falseなら経過時間・会話長・token/context推測で勧めない。Codex全体の10 GiBは参考警告であり、交代・削除の自動実行基準ではない。

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

governance編集だけで交代を強制しない。[Task Replacement](../../references/task-turnover-contract.md)に従い、registry・owner状態・交代履歴/cache・generation・handshake・交代専用validator/profileを追加しない。製品factsは既存正本、旧本文はGit、判断理由は[ADR 0045](../decisions/0045-governance-3-normal-startup.md)を参照する。

Codexは旧taskのarchive/deleteを実行・依頼しない。archiveは利用者の操作であり、保存容量の縮小を保証しない。Codex所有のSQLite、WAL、session記録の直接削除や定常的な`VACUUM`は通常運用に含めない。
