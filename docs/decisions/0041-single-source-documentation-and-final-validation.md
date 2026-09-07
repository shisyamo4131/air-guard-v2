# ADR 0041: 文書の単一正本と最終状態検証

- 日付: 2026-09-02
- 状態: Accepted
- 部分更新: [ADR 0045](0045-governance-3-normal-startup.md)により、節1のcurrent handoffの担当・基準と節4のactive owner/callback/repository baseline必須条件を廃止した。既存pathは製品作業・未決事項・承認・次作業への案内に使う。単一正本、索引、履歴・実行証拠の分離、最終状態検証は継続する。以下の当時の本文は履歴として保持する。
- 対象: project全体の文書責務、開発・検証順序
- 関連: [文書案内](../README.md)、[開発workflow](../runbooks/development-workflow.md)、[検証policy](../../governance/verification-policy.json)

## 背景

同じ現在値を仕様、roadmap、handoff、runbook、索引、CHANGELOGへ重ねて書く運用は、更新範囲を広げ、表現差や更新漏れを生む。STRIPE作業では、実行結果がrunbook、handoff、roadmap、CHANGELOGへ重複し、実際のmigrationより文書同期と再検証へ長い時間を使った。

一方、重複を単に削るだけでは、参照先が不明になったり、残った複製が古いままになる危険がある。利用者が認めた「要約」は、事実を再記述する短縮版ではなく、その事実の正本へ到達するための索引でなければならない。

## 変更前の規則

- 影響したと判断した各文書へ、現在値と実行証拠をそれぞれ同期していた。
- ADR索引とroadmap索引が、リンクに加えて状態、日付、進捗を複写していた。
- current handoffが現在の再開情報だけでなく、完了済みcheckpointと検証履歴を蓄積していた。
- runbookが再利用可能な手順と特定releaseの実行結果を同じ場所に保持していた。
- 実装、受入れ、文書更新の途中ごとに広い検証を繰り返しやすかった。

## 決定

### 1. 変化する事実は一つの正本だけに置く

| 事実 | 正本 |
|---|---|
| 現在の確認済み要件 | docs/specification.md |
| 作業単位の目標、残作業、完了条件、進捗 | 対応する docs/roadmaps/*.md |
| 継続して適用する判断と理由 | 対応する docs/decisions/*.md |
| 再利用する実行・復旧手順 | docs/runbooks/*.md または docs/operations.md |
| 特定実行の詳細結果 | 対応する docs/verification/*.md または機械可読証拠 |
| 現在の担当、基準、未決事項、次のcheckpoint | docs/implementation/current-coordinator-handoff.md |
| 利用者・仕様・安全・運用に見える過去の変更 | CHANGELOG.md |

同じ事実を別文書へ書く必要がある場合は、値を複写せず正本へのリンクを書く。詳細な理由はADR、実測値は検証証拠、現在の進捗はroadmapへ残す。

### 2. 索引はリンク中心の案内にする

docs/README.md、ADR索引、roadmap索引、検証証拠索引は、必要な正本へ到達するための案内とする。リンク先の進捗、状態、件数、commit、現在の受入れ結果を索引へ複写しない。分類が必要な場合も、文書種別や読む目的など、リンク先の現在値と競合しない説明だけを書く。

### 3. 古い複製を残さない

単一正本への移行時は、正本を選ぶだけでなく、既存の複製を検索して削除またはリンクへ置換する。後続変更では正本だけを更新し、索引到達性と禁止された複製をvalidatorで確認する。validatorが扱えない意味上の重複は、最終reviewで確認する。

この規則により、「同じ事実を書かない」結果として別文書に古い記述が残ることを防ぐ。履歴として保持する必要がある記述は、日付付きのCHANGELOG、roadmap履歴、Accepted ADR、immutable verification receiptのいずれかへ明確に分類する。

### 4. current handoffを現在の再開情報へ限定する

current handoffは、active ownerとcallback、現在のrepository baseline、未決事項・承認、active/next checkpoint、正本へのリンクだけを持つ。完了済み作業の詳細、過去の検証件数、長い承認履歴は保持せず、Git、roadmap、ADR、verification receiptへ参照する。

### 5. runbookと実行証拠を分ける

runbookには再利用できる準備、実行、停止、復旧、確認手順だけを書く。特定日、特定commit、実測件数、digest、acceptance結果はimmutable verification receiptへ記録する。Dev接続・deploy・migrationには既存runbookを使い、新しい小規模migration用の「高速経路」は作成しない。

### 6. 最終状態に対して必要な検証を一度行う

標準順序は次とする。

1. 影響範囲、設計、必要なtestを決める。
2. 独立reviewを行う。
3. 指摘を修正する。
4. 最終状態に対する選択済みcompletion gateを一度実行する。
5. 必要なreleaseまたはmigrationを行う。
6. 必要な利用者acceptanceを行う。
7. 実行結果を正本へ一括記録する。
8. 記録変更で失効したgateだけを再実行する。

実装中は直接影響する確認だけを行う。release前後に必要な別目的の確認を省略せず、同じ目的の検証を文書同期のたびに繰り返さない。

## 理由

- 一つの事実を一度だけ更新すればよくなり、文書同期の時間と不一致を減らせる。
- 索引から正本へ直接到達できるため、重複をなくしても探しにくくならない。
- 手順と実行結果を分離すると、runbookの再利用性と証拠の追跡性を両立できる。
- 最終状態へ検証をまとめることで、安全目的を維持したまま無効になる途中証拠を減らせる。

## 影響

- 既存の索引から状態、日付、進捗等の複写を取り除く。
- STRIPE-05の詳細実行結果を一つのverification receiptへ移し、runbook、roadmap、handoff、CHANGELOGからリンクする。
- 今後の文書変更では、影響した事実の正本と索引到達性を確認し、関係がない文書を同期対象にしない。
- 本決定は承認境界、外部作用、security、data保護、release gateを緩和しない。

## 互換性

既存の仕様、製品挙動、API、data、Dev/Prod環境、承認境界は変更しない。文書pathを維持し、詳細の移動先へリンクを設ける。Git履歴と既存Accepted ADRは過去の判断確認に引き続き使用できる。

## 代替案

- 従来どおり全関連文書へ同じ現在値を同期する案は、更新量と不一致を増やすため採用しない。
- 文書を一つへ統合する案は、仕様、判断、進捗、手順、実行証拠という異なる寿命と用途を混在させるため採用しない。
- 重複を人手reviewだけで防ぐ案は、古い記述の見落としを繰り返すため採用しない。機械検出できる構造違反はvalidatorでも確認する。

## 移行

1. STRIPE-05の詳細結果をdocs/verification/stripe-05-dev-release.mdへ集約する。
2. current handoffを現在情報だけへ縮小する。
3. runbookから特定実行結果を除き、receiptへリンクする。
4. ADR・roadmap・verification索引をリンク中心へ変更する。
5. 今後、文書を変更するcheckpointごとに、触れた範囲の残存複製をリンクへ段階的に置換する。

## rollback

文書責務の分離で必要情報へ到達できない場合は、このADRをSupersededにする新ADRを作り、Git履歴から必要な案内を復元する。複数文書へ同じ現在値を無条件に戻さず、到達できなかった事実種別と正本・索引を個別に再設計する。

## 検証

- project文書validatorで、重要文書の索引到達性、ADR番号とstatus、roadmap構造、相対linkを確認する。
- validatorの陰性fixtureで、indexへの現在値複写、handoffの旧構造、runbookへのrelease receipt残存を検出する。
- git diff --checkで文書差分の形式を確認する。
- 最終reviewで、事実の正本が一つであること、古い複製が残っていないこと、必要な履歴が失われていないことを確認する。

## 再検討条件

- 一つの正本だけでは必要な監査・規制上の保存を満たせないと判明した場合。
- 索引から正本へ機械的または実務上到達できない場合。
- 文書形式の変更によりvalidatorが古い複製を十分に検出できなくなった場合。
