# Documentation and verification rules

- 状態: Active
- 役割: 文書責務、checkpoint closeout、検証証拠に関するAirGuardV2固有規則
- 入口: [project rules index](../../governance/project-rules.md)

## 文書責務

- 変化する現在値は一つの正本だけに置き、索引はリンク中心にする。仕様、roadmap、ADR、implementation、runbook、verification receipt、CHANGELOGの役割は[document map](../README.md#文書の役割)を正とする。
- specificationには確認済み要件とacceptance criteriaを置き、local/Dev適用状態、commit、test件数など変化する実装状態を置かない。適用状態はroadmap、実装事実はimplementation、実測結果はverification receiptへ置く。
- 実行契約・途中記録・反省会・現行rollbackを一文書に混在させない。履歴を残す場合は日時またはcheckpoint時点を見出しで明示し、現在形の手順・残作業・rollbackは現行正本へlinkする。
- runbookは大きな再発防止効果があり、反復利用する手順だけを扱う。単発の失敗、日付固有の件数・結果、機能固有の受入れ条件は既存のverification receipt、roadmap、ADRへ置き、一般手順書を追加しない。
- 重要文書の追加・移動・廃止時は`docs/README.md`または該当indexとlinkを同じ変更で更新する。反省会用の一時メモは反省会と承認済み是正の完了後に残さない。

## Checkpoint closeout

- checkpoint開始時に`governance/verification-policy.json`とVerification Matrixから全change classを選ぶ。変更fileが増えた場合はclass unionと失効条件を更新する。
- 次checkpoint開始または完了主張の前に、承認済み目的・完了条件と成果・証拠の対応、および最終差分のclass union、必須gate・exit・失効を[checkpoint transition](../runbooks/project-coordination.md#checkpoint-transition)で確認する。gate成功だけで目的達成とせず、必須条件・証拠が欠ける場合は閉じない。
- milestoneやcheckpoint状態を変更した場合、影響した機能文書群だけをcheckpoint ID・旧状態語・rollback語で検索し、各hitをCurrentまたはHistoryへ分類する。全repositoryの意味検索や汎用semantic validatorを一律追加しない。
- roadmap、release、governance、長期再開の完了判断に使うreview結果は、checkpoint ID、baseline、対象file、findingと解消、test、未確認事項を既存のverification receiptまたはcompletion reportへ集約する。通常のcallbackごとに新文書を作らず、task内だけのcallbackを長期の完了証拠にしない。
- branch適合とGit統合は[Coordination and Git](coordination-and-git.md#checkpointとbranch境界)、実行順は[checkpoint transition](../runbooks/project-coordination.md#checkpoint-transition)を正とする。

## Verification

- 変更class、iteration・targeted・completion・release-only、gate ID・exact command・includes・invalidatedByは`governance/verification-policy.json`を機械可読正本とする。混合変更はunion、影響不明はcomprehensive fallbackを使う。
- 検証はcommand名や手段ではなく、今回証明する必要がある事項を単位に選ぶ。各checkpointまたは検証工程の開始前に、(1)今回証明する事項、(2)既に得られている有効な検証結果、(3)そのまま再利用できる結果、(4)新たな実行がなければ証明できない事項を内部照合し、追加実行は(4)へ限定する。
- 既存証拠は、今回の証明事項を既に直接覆い、成功結果を実行出力または信頼できるproject記録から確認でき、証拠取得後に結果へ影響するcode・設定・依存関係・環境・test条件の変更がなく、実行経路・権限・tenant・Rules・Functions・Firestore等の必要条件が同一または既存側の方が厳しい場合に限り再利用する。この全条件を満たす場合、自動test、Emulator、local server、browser UI、build、lint、静的検査など手段が異なるだけの同等検証を「既存検証でカバー済み」として重ねない。
- 後続変更が証拠を失効させた、新しい実行経路を追加した、または既存証拠が必要事項の一部を証明しない場合は、不足または失効した範囲だけを検証する。「念のため」、慣例、suite名、別手段であることだけを理由に、変更と無関係なtestやsuite全体を再実行しない。再利用した証拠と追加実行の選定理由はcheckpointのcompletion reportまたは指定された証拠先へ記録する。
- policy、project rules、release gateが明示的に必須とするgateは独断で省略しない。必須gateが既存検証と実質的に重複する場合は、重複する証明事項、既存証拠、非失効根拠を示し、必要なら別の承認済み変更でpolicy自体を見直すまで現行gateに従う。
- project governance、permission、agent policyの変更は`governance-permissions-agents`としてcomprehensive gateを省略しない。common governance、生成`AGENTS.md`、managed referencesは承認済みsync以外で編集しない。
- commandは記録済みの必須引数を省略せず実行し、exit status 0を独立確認した後だけ成功と記録する。後続編集が`invalidatedBy`に該当すれば該当gateを再実行する。
- repository-owned PowerShell gateはpolicy指定の`pwsh`を`-NoProfile`で実行し、`-ExecutionPolicy Bypass`、`-EncodedCommand`、検証文字列を復元するBase64 decode、legacy `powershell.exe`の子process起動を使用しない。fixtureは一意の隔離directoryに限定し、cleanup前に許可root内であることを検証する。
- 新規未追跡fileは`git diff --check`の対象外になり得るため、review済みfileだけをstageして`git diff --cached --check`でも確認する。policy上の`git diff --check`自体は別に実行する。
- 未承認のbuild、Emulator、Dev/Prod、network、remote/data、migration、release-only gateをpolicy記載だけから実行しない。省略可能なgateはpolicyの理由と証拠先に従い、既知失敗の回避目的では省略しない。
