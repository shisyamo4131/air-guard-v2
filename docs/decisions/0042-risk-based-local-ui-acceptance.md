# 0042 generated UIと変更riskに応じたlocal受入れ分担

- 日付: 2026-09-02
- 状態: Accepted
- 関連仕様: 開発ガバナンスと進捗管理
- 関連判断: [0021](0021-codex-in-app-browser-ui-testing.md)、[0034](0034-codex-bounded-implementation-and-user-ui-acceptance.md)、[0040](0040-impact-based-staged-verification.md)
- 一部置換: ADR 0034の「UIへ影響する全featureで利用者の実環境受入れを必須とする」部分。承認済み実装境界、Dev・Prod・remote data、正式運用開始の別承認は維持する。

## 背景

Codex専用local環境で、実際のAirGuard生成物、専用Emulator、合成会社管理者、通常のpointer・keyboard操作を使い、Customerの作成・更新・再表示まで確認できた。既存画面の内部改修まで利用者が同じlocal操作を繰り返すと開発を直列化する一方、合成dataと専用browserでは判断できない新しい操作感や実環境差は残る。

## 決定

- Codex専用local UI受入れは、承認済み専用buildから生成した同一HEAD・clean worktree・専用設定identity確認済みgenerated serverを標準とする。Nuxt開発サーバーの位置付けは途中確認・診断用だが、実際の提供可否と通信隔離条件は[現行runbook](../runbooks/local-ui-testing.md#専用uiの郵便番号隔離)に従う。2026-09-03の追加修正では、隔離未検証の専用診断launcherを起動前に停止する契約とした。
- 既存画面・既存操作の内部改修は、対象操作、保存、再表示、自動検証、必要なreview、後処理が成功した場合、利用者によるlocal受入れを原則として重ねない。
- 新しい画面・新しい操作、見た目や使い勝手の判断、利用者用data、利用者Chrome固有条件、Dev固有設定、外部service、Codexが通常操作できない箇所、未解決error、利用者が明示した確認は省略しない。必要な範囲だけ利用者確認を行う。
- Dev・Prod・remote dataの受入れ、release完了、正式運用開始の承認はlocal省略と分離し、各checkpointの完了契約に従う。

## 理由

実画面と正規処理をCodexが再現できる範囲は自動化された受入れへ寄せ、利用者の時間を新規性、業務判断、実環境差へ集中する。省略条件を明示することで、速さだけを理由に未確認箇所まで完了扱いすることを防ぐ。

## 代替案

- 全UI変更で利用者local受入れを必須とする案: 既存操作の重複確認が開発速度を下げるため採用しない。
- 全UI変更をCodexだけで完了する案: 新規操作、使い勝手、実環境差を判断できないため採用しない。
- Nuxt開発サーバーを受入れ標準にする案: readyとHTTP 200後も起動templateから進まない実測があり、安定したgenerated serverを採用する。

## 影響

- 利用者: 既存機能の内部改修では原則としてlocal操作を繰り返さず、新規性または実環境差がある確認へ集中する。
- Codex: 省略条件と除外条件をcompletion reportまたはreceiptへ明記し、通常操作できなかった箇所や未解決errorを隠さない。
- product/data: 本判断だけではapplication、Rules、Firebase data、Dev、Prodを変更しない。
- task: 本判断はPM-14の権限、担当範囲、callback、Git統合、安全境界を変更せず、変更時にactiveなUI tester taskもないため、現在のtask交代を要求しない。今後作成するUI tester taskは更新済みproject設定を最初から読み込む。

## 移行とrollback

project rules、仕様、開発・coordination・local UI runbook、開始prompt、UI tester、document map、handoffを同期する。問題があれば安全なcorrective commitで旧来の利用者local受入れ必須へ戻す。将来の変更がcommon contract、active taskの権限・担当・承認・callback・安全境界へ及ぶ場合だけ、その時点のturnover規則を適用する。

## 検証

- current文書に全UI変更を無条件で利用者受入れ待ちとする記述が残らないこと。
- generated server標準、開発サーバーの用途、再build条件がrunbookと一致すること。
- 利用者確認の省略条件と除外条件、Dev・Prod・remote data・正式運用の別境界が一致すること。
- managed governance、project文書、陰性fixture、task容量回帰、TOML、差分形式が成功すること。

## 再検討条件

Codex専用UIで実画面との差、保存・再表示漏れ、利用者Chrome固有不具合、UI判断の取りこぼしが確認された場合、またはbuild・browser基盤が変わった場合。
