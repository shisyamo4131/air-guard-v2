# 変更履歴

このファイルは、利用者、仕様、セキュリティ、運用に見える変更を記録します。詳細な判断理由は `docs/decisions/` に記録します。

## Unreleased

### Added

- 利用者用`./saved-data`と通常local環境を変更せず、loopback限定demo project、合成Auth/Firestore seed、読込専用export、容量・指紋ガードを使うCodex専用localテスト基盤を追加した。
- 共通managed governance 1.0.0とAirGuardV2所有の`governance/project-rules.md`を分離し、lock、renderer、managed validator、生成`AGENTS.md`を再構築する方針を追加した。
- 作業目的別の文書案内、正式運用準備ロードマップ、証拠に基づく加重進捗管理を追加した。
- Codexのイベント駆動チェックポイント、300 MiBでのセッション引継ぎ、再起動後のコールバック検証手順を追加した。
- 文書リンク、索引、ADR状態、ロードマップ計算、TOMLを確認するローカルガバナンス検証を追加した。
- ガバナンス設定を再現可能に検証するため、TOMLパーサーを開発依存関係として明示した。
- 配置管理の作業員タグへ、配置人数に含まれない OJT 配置を識別できる表示を追加した。
- 配置管理の日付ヘッダーへ日別の稼働数・配置人数・過不足を、固定フッターへ仮配置・配置済・確認済・上番済・下番済・要確認の件数を表示する機能を追加した。
- 配置管理で従業員の同日の日勤・夜勤、および夜勤から翌日の日勤への連勤を判定し、関係する双方の配置タグへ理由付きの警告アイコンを表示する機能を追加した。
- プロジェクト管理文書一式を追加した。
- 現行仕様の正本、ADR、運用手順、将来タスク用プロンプト、一般技術知識の記録先を追加した。
- 主エージェント、リサーチャー、コーダー、テスターによるマルチエージェント体制を追加した。
- 外部作用を排除したFirebase Emulator環境で、Codexが単体・結合テストを行う手順と制約を追加した。
- `.codex/agents/` に実装、テスト、コード調査、外部文書調査、独立レビュー、UI検証、セキュリティレビューのプロジェクト専用エージェントを追加した。

### Changed

- スーパーユーザーの恒久的な全会社Firestore client accessを廃止する方針と、将来は明示的な手続きを経た一時的な他社support accessを提供する未実装構想を記録した。
- application codeの標準実装者を利用者へ変更し、Codexを設計、仕様整理、security・差分review、test計画・許可済み検証、document、local Git管理へ集中させた。Codex developerは明示された補助実装、testerのtest code編集は明示されたtest scopeに限定した。
- 認証・認可・tenant分離の改善を最優先とし、一括置換ではなく、現行挙動、攻撃・失敗経路、変更契約、互換性、rollback、陰性testを説明できる最小segmentごとに進める運用へ変更した。
- local Emulatorはtest用1社、Devは利用者の会社と協力会社の2社が試用するremote環境として、一般公開の有無にかかわらずtenant境界を必須とする環境条件を記録した。
- `OperationResult.isLocked`を請求確定や全体凍結ではなく管制側編集保護と定義し、`operation-results:write`と`operation-billings:write`の権限境界、理由入力・追加承認・新規履歴collectionを要求しない方針を仕様、ADR、実装調査、マニュアル、ロードマップへ反映した。
- 2026-08-12までの静的source reviewをFUT/CONF、coverage、正式運用準備roadmapへ再照合し、主repoのdeep-reviewed件数を310/531から519/531へ更新してB/Cを0とした。公式進捗は無部分加点規則により10%へ据え置いた。
- 認証・認可、請求・派生同期、共通UI、Admin backup/restoreの問題と要判断事項を、既存canonical groupと新規FUT-0177〜FUT-0183へ整理した。
- AirGuardV2固有の文書・ADR・roadmap・TOML検査を`check-project-docs.ps1`へ改名し、managed validatorと所有・ファイル名を分離した。
- Codexの起動経路を生成`AGENTS.md`、`governance/project-rules.md`、task-routedな`docs/README.md`の順へ変更した。
- 実装・修正・改修を機能単位ブランチで行い、利用者の動作確認と明示承認後にだけマージコミットで `main` へ統合する運用を採用した。
- 関連5リポジトリは事前承認なく読み取り可能とし、各役割と、変更時の影響確認・個別承認境界を明確化した。
- Codex専門タスクは差分と検証を報告し、コーディネーターが受入れたファイルだけをコミット・統合する運用へ明確化した。
- 新しい作業では `docs/README.md` から必要最小限の正本文書を選ぶ読取順序へ更新した。
- 配置管理の作業員タグで OJT 表示を資格者アイコンと作業員名の間へ配置し、表示幅が不足する場合は状態表示を維持したまま作業員名だけを省略表示するよう変更した。
- 配置管理では、配置予定と配置通知が共有する OJT などの業務プロパティについて配置通知を優先し、日別配置人数と現場稼働予定カードの過不足を同じ実効 OJT 状態で判定するよう変更した。
- 配置管理の現行画面責務と作業員タグの表示仕様、および連勤の定義と未決事項を現行仕様へ追記した。
- 配置管理の連勤判定を従業員だけに限定し、表示期間の前後1日を判定用に取得して、連勤関係を構成する双方の配置タグへ警告アイコンと理由ツールチップを表示する仕様を確定した。
- 管制業務マニュアル索引の配置管理リンクを、既存の配置管理説明へ修正した。
- 既存の Codex 作業指示を、承認制の仕様変更フローと文書同期ルールを含む `AGENTS.md` へ統合した。
- `README.md` を Nuxt 初期テンプレートから AirGuardV2 の案内へ更新した。
- 作業指示ごとに文書と実装を照合し、相違は変更前に確認し、実装から判明した未記載仕様を文書へ反映する運用を追加した。
- 影響範囲の大きい隣接リポジトリを、明示的な対象指定と影響確認なしに変更しない規則を追加した。
- 修正済みの `deploy:dev` を開発環境向けデプロイ手順へ反映した。
- CodexのインアプリブラウザからAuth Emulatorへ接続できない現在の制約と、認証済み画面の検証に必要な条件を運用文書へ追加した。
- Chrome拡張による検証では、拡張機能を有効にしたプロファイルでChromeを事前起動する必要があることを明記した。
- Chrome拡張による操作でもAuth Emulatorへの接続が遮断され、サインイン操作を自動化できない現在の制約を運用文書へ反映した。
- Codexの認証後UIテストについて、ユーザーがEmulator、ローカルサーバー、Chrome、サインイン済み画面を準備し、Codexが既存タブを引き継ぐ運用を採用した。
- 既存のリサーチャー・コーダー・テスター体制を、役割と書込み権限を分離した基本5エージェントと任意2エージェントへ具体化した。

### Fixed

- 一般Userのメール確認後画面で認証Callable composableの明示importがなく、クリーンなclientで本登録を開始できない問題を修正した。
- メール確認済みでも会社claim未設定の一般Userをglobal middlewareがdashboardへ早期転送し、本登録Callableを実行できない問題を修正した。
- 管制業務マニュアルの上下番確定処理リンクが存在しない文書を参照していた問題を修正した。
- 上下番確認画面で確定処理中のダイアログが表示されず、処理対象の現場稼働予定を再選択できる問題を修正した。

### Removed

### Security

- FirestoreのCompanies配下を、確認済みメール、正常な会社claim、同一tenant path、対応する有効な本登録Userがすべて整合する場合だけ許可するよう変更した。恒久的なsuper-user全会社bypassを廃止し、SecurityReportIndexesとStripeDataの個別操作制約を汎用ルールで迂回できないようにした。専用loopback Emulator 32件で検証した。
- 一般User本登録について、確認済みAuthenticationメールに完全一致する一意の仮登録だけを選択し、会社ID・仮User IDをクライアント入力として信頼しないpolicy、use-case、安全なCallable error mappingを既存Callableへ接続した。clientはAuthentication account作成と確認メール送信で一度停止し、メール確認後に更新したID tokenで本登録してからsessionを初期化する。
- Auth accountが有効でも、確認済みメール、正常な会社claim、tenant path、対応する有効な本登録Userの整合が確認できなければFirestore、Storage、Callableを拒否する方針を確定した。この認可整合性は次の最優先改修であり、実装・Rules test完了まで一般User本登録client接続はdeploy不可とする。
- 仮登録UserのFirestore削除では、対応するglobal Authentication Userを削除しないようUser削除triggerを変更した。本登録済み状態を明示的に確認できる場合だけAuth削除へ進む。
- 会社管理者移譲Callableを、認証済みactor自身が同社の唯一の有効な本登録管理者である場合だけ実行できるtransactionへ変更した。移譲元・移譲先のUser/Auth UID・company・登録・管理者・disabled状態を検証し、管理者0人・複数人、別人による移譲、内部識別子を含むerror応答を拒否する。
- User有効化・無効化Callableを、認証済みactorの会社内transactionへ変更した。有効な本登録会社管理者だけが同社別の本登録非管理者Userを操作でき、自己操作、会社・UID・Auth claim不一致、仮登録、管理者targetを更新前に拒否する。
- User更新triggerのAuth同期を独立モジュールへ分離し、Auth更新前にFirestore path・User document・Auth UID・Auth company claimの整合性を検証するよう変更した。会社不一致、claim欠損、UID不一致、登録状態不正ではAuthを更新しない。
- invitation本人確認前のaccount setup、global Auth target、管理Callable、同一tenant Rules、SecurityReport Storage、`admin_users`、FcmToken、Admin operator境界の静的調査結果をsecurity backlogへ反映した。
- 秘密情報、個人情報、本番データ、外部操作に関する文書化・承認境界を明文化した。
