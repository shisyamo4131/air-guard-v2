# ADR 0045: Governance 3と通常startupへの移行

- 日付: 2026-09-03
- 状態: Accepted
- 対象: 共通governance、task起動、文書route、検証互換
- 関連: [旧交代判断](0030-efficient-coordinator-handoff-activation.md)、[単一正本](0041-single-source-documentation-and-final-validation.md)、[移行記録](../migrations/2026-09-03-governance-3.0.0.md)

## 背景と変更前

Common 1.5.0とADR 0030は、交代専用のno-change、activation、最初のfile限定commit、former owner照合を要求していた。current snapshotにtask owner・baselineを保持するため、手動作成や旧taskが利用不能な場合の再開経路も交代手順へ依存していた。

## 決定と理由

利用者承認済みのCommon 3.0.0、文書移行契約1.0.1、Task Replacement 2.0.0を採用する。すべてのtaskはAGENTS.md、governance/project-rules.md、docs/README.mdから必要な正本を読む。手動作成・復旧も同じ経路とし、旧task ID・旧owner協力・activation・交代専用validatorを要求しない。

利用者が交代を要求した場合、既存正本の製品事実・未決事項・次作業を整え、関連差分を意味のある単位で検証・commitし、primaryをcleanにしてから、同じ基本名と次の連番のfresh non-fork taskを作る。governance変更だけで交代を強制しない。Codexは旧taskのarchive/deleteを実行・依頼しない。

通常の専門role、application writer集中、checkpoint、委譲task作成・アプリ再起動時のno-change確認、一度だけのterminal callback、review後のGit統合、承認・安全境界は維持する。現在の製品作業は既存の[再開案内](../implementation/current-coordinator-handoff.md)から正本へrouteし、task状態や実行証拠を複写しない。日常作業ではinstalled scaffold skillを読み込まない。

## 互換性と影響

- [ADR 0011](0011-roadmap-and-codex-session-lifecycle.md)と[ADR 0032](0032-required-specialist-subagent-routing.md)の旧交代条件（専門taskの自動交代、最初の限定commit、activation/旧owner照合、旧task archive、governance変更による強制交代）は本判断に置き換え、当時の履歴として参照する。通常delegation・role・容量測定・roadmap・Git統合の規則は維持する。
- ADR 0030全体をsupersedeする。ADR 0041のcurrent handoffにowner/callback/baselineを必須とする部分だけを更新し、単一正本と最終状態検証は維持する。
- 確認済み製品仕様、data、API、Customer再試験、Dev延期、未回答事項、local memo保持、環境・外部作用承認は変えない。製品仕様versionとdata versionをcommon versionへ連動させない。
- 既存の文書pathと有用な履歴を保持し、索引と通常起動promptを更新する。common/生成物はmanaged syncだけで更新する。
- 当時はWindows PowerShell 5.1の既存comprehensive 5 gateを維持し、project-guidance-metadata classとruntime宣言を追加した。このruntime判断は2026-09-07に[ADR 0061](0061-powershell-verification-runtime-hardening.md)で置換した。

## 代替案

旧activation手順の存続は通常startupとの二重運用になる。全履歴削除は当時の判断を失う。巨大な単一文書への統合は既存の責務と読取り経路を壊すため採用しない。

## 移行・検証・rollback

source hashに結び付いた文書planと段落mappingを使い、意味保存を独立reviewする。managed Plan/Apply/Check、文書ValidateResult、project-docs、project-docs-negative、capacity-regression、managed-governance、diff-checkで確認する。詳細と実測結果は[移行記録](../migrations/2026-09-03-governance-3.0.0.md)に置く。

問題時は記録済みGit baselineを参照し、owned scopeだけを一つの整合した単位として修正する。commit後の復旧は履歴を書き換えずcorrective commitを用い、nested repositoryやignored dataを触らない。

## 再検討条件

通常startupで製品の次作業や承認境界を復元できない、文書責務が競合する、または対応runtimeで検証できなくなった場合。
