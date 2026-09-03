# 現在の製品作業と再開案内

この文書は現在の製品作業・未決事項・次の操作から正本へ進むための案内です。taskのowner、交代状態、Git先端、過去の検証結果は保存しません。通常startupは[文書案内](../README.md)と[project coordination](../runbooks/project-coordination.md)に従います。

## 現在の作業

- 製品は試験運用中。Customer状態改修のlocal限定再試験を再開しましたが、合成認証準備の担当例外について回答待ちです。
- 仕様・実装・進捗・実行証拠をこの案内へ複製せず、以下の各正本を参照します。remoteのlive状態は別承認の直接照合がない限り未確認です。
- governance移行の実行範囲・未検証事項は[移行記録](../migrations/2026-09-03-governance-3.0.0.md)、通常startupへの変更判断は[ADR 0045](../decisions/0045-governance-3-normal-startup.md)を参照します。

## 未決事項と承認

- 次の製品checkpointは`CUSTOMER-02-STATUS`。[確認済み仕様](../specification.md)、[ADR 0044](../decisions/0044-customer-status-as-descriptive-flag.md)、[工程・進捗](../roadmaps/customer-status.md)、[検証記録](../verification/customer-02-status-local.md)から再開する。状態は現在状況flagで、選択・関連現場/予定を制限せず、日時・原因等は追加しない。
- local実装・検証・review・文書・local統合は承認範囲内。Dev反映・受入れは延期。archive/restore、code一意性/検索拡張、請求/PDF全体、他マスタ・関連package変更、remote data/migrationは対象外。
- [CONF-0145](pending-confirmations.md#conf-0145-codex専用uiの外部郵便番号通信を遮断する追加checkpoint): 専用UIの郵便番号通信遮断と限定再試験は承認済み。通常利用・Dev・Schemas・保存形式を変えない。
- [CONF-0146](pending-confirmations.md#conf-0146-再試験の合成認証準備を親タスクで担当する例外): 親による合成Authの一時設定まで含める担当例外は未回答。Low UI担当の実操作接続が失敗し、親の画面にも保存済み合成sessionがなかったため、この回答を得てから認証準備へ進む。認証情報をprompt・文書・logでagent間に受け渡さない。
- Customerの設計/reviewはHigh、開発/修正はMedium、test/環境準備/cleanupはLow。親の既存例外は画面テストだけであり、合成Authの一時設定まで広げない。次回の専用build・process管理・cleanupはLow testerを維持する。
- 「Functions Developer」別task利用案は取り下げ済み。割当しない。Norton申告の関連package内scriptは今回の実行対象ではなく原因未確定。検知回避・除外設定・再実行は行わない。
- 反省会一時メモは`.codex-test/customer-status-retrospective.md`、設計補助メモは`.codex-test/customer-status-security-design.md`。反省会と改善作業の両方が終了するまで削除しない。

## 次の作業

1. 未回答のCONF-0146を確認する。承認後は同じ親担当の一時memory内で専用Authの一時設定と通常UI入力を行い、限定再試験へ進む。build前のbrowser接続確認は一覧取得だけで成功とせず、実操作可否も確認する。別taskのbrowser handle・保存sessionが使えるとは仮定しない。
2. UI再試験は合成Customer 1件の7桁手入力・手動住所・保存/reload・状態取消/終了/復帰/filterに限定する。[local UI手順](../runbooks/local-ui-testing.md)でclean HEADの専用buildを行い、自身のprocess/生成物をcleanupする。旧taskのtab・専用process・生成物・log-backupはcleanup済み、反省会メモは保持済み。

## 参照

- [確認済み仕様](../specification.md)
- [Customer取引状態roadmap](../roadmaps/customer-status.md)
- [Customer状態のlocal検証記録](../verification/customer-02-status-local.md)
- [確認事項台帳](pending-confirmations.md)
- [local UI手順](../runbooks/local-ui-testing.md)
