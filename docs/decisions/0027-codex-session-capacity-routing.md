# 0027 Codex task/session容量の明示routingと測定境界

- 日付: 2026-08-28
- 状態: Accepted
- 関連仕様: 開発ガバナンスと進捗管理
- 関連判断: [0011 ロードマップとCodexセッションライフサイクル](0011-roadmap-and-codex-session-lifecycle.md)、[0013 Managed governance再構築](0013-managed-governance-reconstruction.md)

## 背景

AirGuardV2はtask sessionを300 MiBで交代検討する運用とproject-local測定scriptを既に持っていた。しかし、文書案内では「長期作業・引継ぎ」とだけ表記され、利用者が通常使う「容量チェック」から正規runbookへの対応が明示されていなかった。このため、Codexがtask session JSONL容量とmodel token/context windowを混同し、実測せずに交代を推奨する事象が発生した。

## 決定

- `容量チェック`、`タスク容量確認`、`セッション容量確認`、`session size / handoff threshold確認`を、現在taskの永続Codex session JSONL容量を測定する同義の指示として扱う。
- `docs/README.md`からproject coordination runbookとproject-local scriptへ明示routeする。
- trusted task metadataのcurrent task IDを必須とし、最新・最終更新sessionやtimestampから対象を推測しない。指定IDは正確に1件のsession fileへ解決する。
- task handoff閾値は300 MiB、Codex全体は10 GiBの参考警告とする。task閾値未到達時に会話の長さ、経過時間、token/context推測を理由として交代を提案しない。
- task ID、session file、size、threshold、usage percentage、handoff state、Codex全体の参考容量、scan complete/error count、測定時刻・source、command result、独立exit statusを標準報告する。
- ID不明、0件・複数一致、script失敗時はhandoff判断を停止する。全体scan不完全時はtask単体測定だけを報告できるが、Codex全体のcleanup・threshold判断を行わない。
- session本文、prompt、credential、秘密情報、業務dataを出力せず、Codex所有SQLite・WALを操作しない。

## 理由

短い利用者指示から決定的なrepository手順へ到達させ、異なる容量概念の混同、並行taskの誤選択、閾値未到達の不要なtask交代を防ぐため。

## 代替案

- 会話contextから意味を推測する案: model容量とtask保存容量を混同した実績があるため採用しない。
- 最新session fileを測定する案: 並行taskで誤対象を選ぶため採用しない。
- Codex全体容量をtask handoffに使う案: task lifecycleと保存領域全体の警告は目的が異なるため採用しない。

## 影響

- 利用者: 4表現のどれでも同じ実測結果を受け取れる。
- application・data: 製品code、Firebase、業務dataへの影響はない。
- governance: common governance 1.4.0、生成`AGENTS.md`、project routing、runbook、script、validator/testを同期するinstruction-chain変更であり、全active AirGuardV2 taskを完全新規taskへ交代する。
- privacy: session bodyを読まずfile metadataだけを測定する。

## 移行とrollback

installed `scaffold-project-governance`の正規sync commandでmanaged artifactsを1.4.0へ更新し、project-owned文書とscriptをmergeする。検証・local commit後に全active taskを新規taskへ交代し、primary repository、permissions、no-change callback、最初のfile限定commitを確認する。push、deploy、data操作を含めない。

公開・外部作用前のlocal変更であるため、問題時はhistory rewriteを行わず、別の承認済みcorrective commitで1.3.0相当の既知手順または修正版へ進める。旧taskをCodexがarchive・deleteしない。

## 再検討条件

Codexのsession保存形式、task metadata、容量測定API、既定threshold、全体容量scan方式、task handoff機能が変更された場合。
