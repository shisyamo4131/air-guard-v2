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
- 次checkpoint開始または完了主張の前に、base..最終差分からclass union、completion gate、各exit、後続編集による失効、証拠保存先を確認する。必須gateの実行または証拠が欠ける場合はcheckpointを閉じない。
- milestoneやcheckpoint状態を変更した場合、影響した機能文書群だけをcheckpoint ID・旧状態語・rollback語で検索し、各hitをCurrentまたはHistoryへ分類する。全repositoryの意味検索や汎用semantic validatorを一律追加しない。
- roadmap、release、governance、長期再開の完了判断に使うreview結果は、checkpoint ID、baseline、対象file、findingと解消、test、未確認事項を既存のverification receiptまたはcompletion reportへ集約する。通常のcallbackごとに新文書を作らず、task内だけのcallbackを長期の完了証拠にしない。
- branch適合とGit統合は[Coordination and Git](coordination-and-git.md#checkpointとbranch境界)、実行順は[checkpoint transition](../runbooks/project-coordination.md#checkpoint-transition)を正とする。

## Verification

- 変更class、iteration・targeted・completion・release-only、gate ID・exact command・includes・invalidatedByは`governance/verification-policy.json`を機械可読正本とする。混合変更はunion、影響不明はcomprehensive fallbackを使う。
- project governance、permission、agent policyの変更は`governance-permissions-agents`としてcomprehensive gateを省略しない。common governance、生成`AGENTS.md`、managed referencesは承認済みsync以外で編集しない。
- commandは記録済みの必須引数を省略せず実行し、exit status 0を独立確認した後だけ成功と記録する。後続編集が`invalidatedBy`に該当すれば該当gateを再実行する。
- 新規未追跡fileは`git diff --check`の対象外になり得るため、review済みfileだけをstageして`git diff --cached --check`でも確認する。policy上の`git diff --check`自体は別に実行する。
- 未承認のbuild、Emulator、Dev/Prod、network、remote/data、migration、release-only gateをpolicy記載だけから実行しない。省略可能なgateはpolicyの理由と証拠先に従い、既知失敗の回避目的では省略しない。
