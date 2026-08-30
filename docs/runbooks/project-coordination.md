# project coordination runbook

- 状態: 運用中
- 最終確認日: 2026-08-30
- 役割: Git統合、event-driven task loop、session容量とhandoff

## Git統合

- 作業単位ごとにユーザーとbranch境界を相談し、原則として機能単位の `codex/<機能名>` ブランチを合意済み基準から作成する。開始時に現在ブランチ、基準コミット、作業ツリーを確認する。
- Codexはlocal branch作成・切替、review済みfileのstage・commit、差分確認を担当する。ユーザーの未コミットapplication codeを独自判断で修正、破棄、stage、commitしない。
- 専門タスクは担当ファイルだけを編集・検証し、原則としてステージやコミットを行わない。
- 専門タスクはチェックポイントID、正確な変更ファイル、差分、テスト、未確認事項、承認境界、作業ツリー状態をコーディネーターへ報告する。
- コーディネーターは差分と仕様・ロードマップとの整合を確認し、合意済み作業単位のreview済みfileだけをステージ、コミット、統合する。ユーザー実装をcommit対象に含める場合は対象差分と検証状態をユーザーと確認する。専門タスクが既にコミットを作成している場合は、確認後に再利用する。
- 並行書込みでは共通の基準コミットとチェックポイントIDを使用し、担当ファイルを重複させない。限定された一群を統合・検証してから次の共通基準へ昇格する。
- 未統合の変更を、別タスクの確定済み依存関係として扱わない。統合待ちがある場合は新規割当より統合を優先する。
- ユーザーは機能ブランチ上の動作を確認する。明示的な受入れ承認を得るまで `main` へマージしない。
- `main` へは原則としてマージコミットを作成し、機能単位の統合境界を残す。競合解消後に関連テストとガバナンス検証を再実行する。
- `main` への直接コミット、`main` へのマージ、Git push、履歴書換え、デプロイは、それぞれユーザーが対象操作を明示した場合だけ行う。
- 受入れ後に問題が判明した場合は、機能単位のマージコミットをrevert可能か、データ・契約互換性を確認する。安全にrevertできない場合は修正ブランチと移行・復旧手順を用意する。

## プロジェクト管理タスクループ

長期作業は、定時確認ではなくタスク間通知を用いたイベント駆動型を標準とします。

### 再開正本とbounded callback

2026-08-30以後のcoordinator交代は[ADR 0030](../decisions/0030-efficient-coordinator-handoff-activation.md)と[効率化runbook](coordinator-handoff-efficient-activation.md)を適用する。replacement taskの最小restart集合は`AGENTS.md`、`governance/project-rules.md`、`docs/README.md`、本runbook、[current coordinator snapshot](../implementation/current-coordinator-handoff.md)、snapshotが指定する次checkpoint固有文書である。不足・矛盾がある場合だけ履歴文書へ拡張し、旧append-only handoffを毎回全文再読しない。

no-change callbackとactivation callbackは効率化runbookのbounded形式を使う。callback本文へproduct stateや履歴を再掲せず、snapshot path、Git identity、権限、変更file、validator exit、未確認事項を記録する。staged blobとcommitted blobが一致し、exact committed path、clean、primary-only worktreeをformer coordinatorが確認できた場合、同じvalidatorをcommit後に重複実行しない。

### 開始確認

1. コーディネーターと専門タスクのID・ホストを記録し、全taskのcwdとGit top-levelが利用者repository `C:\Users\seven\projects\AirGuard\air-guard-v2`そのものであることを確認する。Codex専用worktreeは作成・使用しない。
2. 現在のロードマップ、基準コミット、チェックポイントID、担当・禁止ファイル、承認境界を確認する。
3. 終了条件を記録する。標準は「安全に独立実行できる作業が尽きた時点」とする。
4. コールバック先を記録する。
5. タスク作成、交代、Codexアプリ再起動後は、ファイルを変更しない確認用チェックポイントを送り、次の形式のコールバックが1回到達することを確認する。

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
2. task交代中を除き、調査、code探索、review、test、利用者が明示承認した補助実装等を独立した非重複scopeへ分割でき、専門roleの結果が必要な場合は、Codexが適切な専門タスクへ割り当てる。application codeの標準実装者はユーザーとし、Codexの補助実装は利用者が明示した範囲だけを`developer`へ集中させる。
3. 専門タスクは完了、失敗、仕様質問、承認境界で一度だけ通知し、待機する。
4. コーディネーターはユーザーまたは専門タスクの差分、テスト、未確認事項、作業ツリー、仕様・ロードマップとの整合を確認する。
5. 合意済み変更をコミットし、必要な統合検証とdocument同期を行う。
6. 終了条件に達していなければ次のチェックポイントへ進む。

通常の割当・通知は利用者へ逐次報告せず、終了時または早期停止時に統合して報告します。承認、安全・外部作用・破壊的操作の境界、テスト失敗、仕様競合、進捗低下、タスク・作業ツリー消失、状態取得・コールバック障害、容量閾値は直ちに報告します。突然の終了で統合報告できなかった場合は、再開後最初の確認で未報告期間をまとめます。

通知に失敗した専門タスクは再送を繰り返さず、完全な最終結果をそのタスクに残して停止します。コーディネーターは状態を安全に1回だけ再取得し、最新指示と照合できなければ同じ割当を再送しません。コールバックを利用できない場合、またはユーザーが明示した場合だけ差分型ポーリングへ切り替え、対象、間隔、停止条件を記録します。変更なしの確認は通知せず、確認間隔を作業期限とみなしません。

checkpoint固有のsubagent禁止は、そのcheckpointの開始からterminal callbackとcoordinator reviewまでに限ります。完了後のcheckpointへ自動的に持ち越さず、継続禁止には利用者による別の明示指示を必要とします。task交代、no-change確認、ownership activation、callback・assignmentのretarget、replacement taskの最初のfile限定commitはcoordinator自身が行い、この交代手順内ではsubagentを使用しません。

## Codexセッションのライフサイクル

### 容量確認

`容量チェック`、`タスク容量確認`、`セッション容量確認`、`session size / handoff threshold確認`は同じtask容量確認指示として、この節へrouteしてから回答します。これらはmodelのtoken数やcontext windowではなく、現在taskの永続Codex session JSONL容量を意味します。

trusted task metadataから現在のtask IDを特定し、作業開始、コールバックによる状態変更後、終了時に確認します。状態変化がない場合は1時間に1回を上限とします。並行taskの有無にかかわらず、最新・最終更新sessionやtimestampから対象を推測しません。

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

### 安全な引継ぎ

以下の安全境界を維持し、具体的なactivation順序、replacement taskへの最小入力、callback、最初のfile限定commitは[効率化runbook](coordinator-handoff-efficient-activation.md)に従う。

1. 300 MiB到達時は新規割当と自動レビューを停止する。
2. 基準コミット、ロードマップ進捗、実行中・待機中チェックポイント、未統合ブランチ、テスト、承認事項、承認境界、次の指示をリポジトリの正本へ記録する。
3. 旧コーディネーターは自身の完了変更を検証・コミットする。専門タスクは担当ファイル、差分、テスト、未確認事項、作業ツリー状態を報告し、コーディネーターが受入れた変更をコミット・統合する。
4. 文書検証と必要なテストを実施し、作業ツリーがクリーンであることを確認する。
5. 未コミット例外が不可避な場合は、ファイル、目的、検証状態、コミットできない理由、所有者、再開手順を正本へ記録する。同じ差分を旧新タスクへ重複所有させない。
6. コーディネーター交代についてユーザーの明示承認を得る。専門タスクは、安全なチェックポイントで差分統合済みの場合だけ自動交代できる。
7. 履歴をforkせず、同じ基本名に次の連番を付けた新規タスクを作成する。
8. 旧・新タスクID、基準コミット、checkpoint、common governance、specification、current snapshot path、direct repository、許可・禁止操作、callback先だけをreplacement taskへ送る。product state、進捗、結果、次工程はsnapshotを参照させる。
9. 新タスクが利用者repositoryへ直接接続し、repositoryから状態を復元し、割当先とコールバックIDを更新できたことを確認する。プロジェクトの承認方針、権限プロファイル、自動レビュー設定を使用する場合は、それらも確認する。
10. 変更なしコールバックと、新タスクによる最初の実ファイル限定ステージ・コミットを確認する。失敗時は旧タスクを維持し、重複割当を行わない。
11. Codexは旧taskのarchiveを実行・依頼せず、交代検証結果を利用者へ報告して待機する。利用者が旧taskをarchiveした後、必要に応じてアクティブ・アーカイブ済みを含む容量を再測定する。

アーカイブは利用者が行う状態またはUI上の操作であり、物理削除や保存容量の縮小を保証しません。Codexが所有するSQLite、WAL、セッション記録の直接削除や定常的な `VACUUM` は通常運用に含めません。
