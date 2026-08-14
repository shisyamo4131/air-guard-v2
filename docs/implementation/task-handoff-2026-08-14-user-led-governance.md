# 2026-08-14 利用者主導開発ガバナンス交代引継ぎ

- 状態: coordinator交代承認済み・新task作成前
- current coordinator task: `019ffe2d-ae4c-7420-a52c-b9279ced3f75`
- branch: `codex/user-led-development-governance`
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

- 新規coordinator taskの作成は利用者承認済み。旧taskのarchiveは新taskのrepository再開、変更なしcallback、識別子更新、最初の実ファイル限定stage・commitの成功後に行う。
- `main` merge、push、deploy、migration、remote data操作、外部service変更は未承認・未実施。
- 認証問題の最初のsegment、branch、変更契約は新coordinatorで利用者と相談して決める。交代完了までは新規application作業を開始しない。

## 新coordinatorの開始確認

1. `AGENTS.md`、`governance/project-rules.md`、`docs/README.md`、[ADR 0015](../decisions/0015-user-led-implementation-and-codex-assurance.md)、`docs/operations.md`、`docs/roadmaps/airguard-v2.md`、本記録を読む。
2. common governance 1.0.0、branch、HEAD、clean worktree、進捗10%、承認境界を報告する。
3. application codeを書き込まず、変更なしcallbackを旧coordinatorへ返す。
4. task・callback識別子を新coordinatorへ更新する。
5. 最初の実ファイル限定stage・commitが新しい役割・権限で成功した後に、旧coordinatorをarchive可能とする。失敗時は旧taskを維持し、重複割当を行わない。

この記録にsecret、credential、private production data、Codex session本文は含めない。
