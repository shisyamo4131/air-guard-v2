# 2026-08-14 利用者主導開発ガバナンス交代引継ぎ

- 状態: 新coordinator有効化済み・旧coordinator archive可能
- new coordinator task: `019ffe53-4eb9-7922-9012-34a526ebbbd4` host `local`
- old coordinator task: `019ffe2d-ae4c-7420-a52c-b9279ced3f75` host `local`
- callback destination: 新しいcheckpointはnew coordinator `019ffe53-4eb9-7922-9012-34a526ebbbd4` host `local`
- branch: `codex/user-led-development-governance`
- coordinator有効化基準: `185e1728a4520ba7adedd5ae411c100046b33990`
- main基準: `30c037ed618fab5a5958b4ced9a33302a17044c9`
- 統治変更commit: `0c8e79d`
- common governance version: `1.0.0`
- 公式進捗: 10%（変更なし）

## 完了した変更

- application codeの標準実装者を利用者へ変更した。
- Codexを設計、仕様整理、脅威・失敗経路、差分review、test計画・許可済み検証、document、roadmap、ADR、local Git管理へ集中させた。
- Codex developerを明示された補助実装だけに限定し、testerのtest code編集を明示されたtest scopeで許可した。
- 認証・認可・tenant分離を最優先とし、利用者が理解、実装、review、rollbackできる最小segmentを1件ずつ扱う契約とsegment templateを追加した。
- local Emulatorはtest用1社、Devは利用者の会社と協力会社の2社が試用するremote環境であることを記録した。
- ADR 0007をSupersededとし、ADR 0015をAcceptedにした。
- 2026-08-13 handoffをHistoricalへ変更し、local test harness未mergeという古い指示がmain merge `36ace65`で履行済みであることを記録した。
- 2026-08-11 managed governance再構築後の一回限りのtask交代条件を、履歴上完了済みとして整理した。

application code、Functions、Firebase Rules、Firebase設定、test code、実data、remote環境、外部serviceは変更していない。

## 検証

- `scripts/check-project-docs.ps1`: pass。153 Markdown、15 ADR、1 roadmap、8 TOML。
- `scripts/check-governance.ps1 -ProjectPath .`: pass。common governance 1.0.0、managed hash current、generated AGENTS current、project rules present。
- `scripts/test-project-docs-check.ps1`: pass。valid baseline、invalid TOML、broken anchor、unindexed document、roadmap over-creditの期待結果を確認した。
- `git diff --check`: pass。
- application、Emulator、browser、remote、external、実data test: 今回は製品変更がないため未実施。

## 未確認・承認境界

- 新規coordinator taskの作成と有効化は完了した。旧coordinatorのarchiveは本記録だけを対象とする最初の実ファイル限定commitと`GOV-HANDOFF-002` callbackの成功後に、旧coordinatorが行う。
- `main` merge、push、deploy、migration、remote data操作、外部service変更は未承認・未実施。
- 認証問題の最初のsegmentは開始していない。branchと変更契約を含め、次の利用者指示を待つ。

## 新coordinatorの有効化結果

- `GOV-HANDOFF-001`はcompleted。最初の試行でdetached HEADを検出し、`recovery-1`で`codex/user-led-development-governance`へ接続した。
- recovery後のHEADは`185e1728a4520ba7adedd5ae411c100046b33990`、worktreeはcleanだった。
- common governance 1.0.0、active instruction sources、利用者主導のapplication実装、Codexの設計・review・検証・document・local Git管理、developerとtesterの境界、未承認操作をrepositoryから復元した。
- taskとcallback destinationをnew coordinatorへ更新した。
- 本記録だけを新coordinatorによる最初の実ファイル限定commitとして作成する。commit hashはGit履歴を正本とする。
- `GOV-HANDOFF-002`完了後、旧coordinatorはarchive可能である。archive操作自体は旧coordinatorが行う。

この記録にsecret、credential、private production data、Codex session本文は含めない。
