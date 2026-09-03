# 現在の製品作業と再開案内

この文書は現在の製品作業・未決事項・次の操作から正本へ進むための案内です。taskのowner、交代状態、Git先端、過去の検証結果は保存しません。通常startupは[文書案内](../README.md)と[project coordination](../runbooks/project-coordination.md)に従います。

## 現在の作業

- 製品は試験運用中。Customer状態改修のlocal限定再試験・crash後cleanup・High最終reviewを完了し、CS-04を延期しています。
- 仕様・実装・進捗・実行証拠をこの案内へ複製せず、以下の各正本を参照します。remoteのlive状態は別承認の直接照合がない限り未確認です。
- governance移行の実行範囲・未検証事項は[移行記録](../migrations/2026-09-03-governance-3.0.0.md)、通常startupへの変更判断は[ADR 0045](../decisions/0045-governance-3-normal-startup.md)を参照します。

## 未決事項と承認

- 次の製品checkpointは`CUSTOMER-02-STATUS`。[確認済み仕様](../specification.md)、[ADR 0044](../decisions/0044-customer-status-as-descriptive-flag.md)、[工程・進捗](../roadmaps/customer-status.md)、[検証記録](../verification/customer-02-status-local.md)から再開する。状態は現在状況flagで、選択・関連現場/予定を制限せず、日時・原因等は追加しない。
- local実装・検証・review・文書・local統合は承認範囲内。Dev反映・受入れは延期。archive/restore、code一意性/検索拡張、請求/PDF全体、他マスタ・関連package変更、remote data/migrationは対象外。
- [CONF-0145](pending-confirmations.md#conf-0145-codex専用uiの外部郵便番号通信を遮断する追加checkpoint): 専用UIの郵便番号通信遮断と限定再試験は承認済み。通常利用・Dev・Schemas・保存形式を変えない。
- [CONF-0146](pending-confirmations.md#conf-0146-再試験の合成認証準備を親タスクで担当する例外): 今回に限り、親による専用合成Authの一時設定と通常ログイン入力を承認済み。認証情報をprompt・文書・logでagent間に受け渡さない。snapshotを変更せず、Emulator停止で失効させる。
- Customerの設計/reviewはHigh、開発/修正はMedium、test/環境準備/cleanupはLow。今回だけ親が合成認証準備と画面テストを担当し、専用build・process管理・backend assertion・cleanupはLow testerを維持する。
- 「Functions Developer」別task利用案は取り下げ済み。割当しない。Norton申告の関連package内scriptは今回の実行対象ではなく原因未確定。検知回避・除外設定・再実行は行わない。
- 反省会一時メモは`.codex-test/customer-status-retrospective.md`、設計補助メモは`.codex-test/customer-status-security-design.md`。反省会と改善作業の両方が終了するまで削除しない。

## 次の作業

1. 新しい状態filterの見た目・使い勝手を利用者が判断する。残ったローカルerror tabは専用server停止済みで、利用者が手動で閉じられる。
2. 利用者がDev工程を再開する場合は、別承認で反映範囲・対象commit・権限別受入れを確定する。停止済み専用Auth/Emulator/serverを再利用せず、承認前にDev・remote・実dataへ進まない。

## 参照

- [確認済み仕様](../specification.md)
- [Customer取引状態roadmap](../roadmaps/customer-status.md)
- [Customer状態のlocal検証記録](../verification/customer-02-status-local.md)
- [確認事項台帳](pending-confirmations.md)
- [local UI手順](../runbooks/local-ui-testing.md)
