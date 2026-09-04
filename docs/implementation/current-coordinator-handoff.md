# 現在の製品作業と再開案内

この文書は現在の製品作業・未決事項・次の操作から正本へ進むための案内です。taskのowner、交代状態、Git先端、過去の検証結果は保存しません。通常startupは[文書案内](../README.md)と[project coordination](../runbooks/project-coordination.md)に従います。

## 現在の作業

- 製品は試験運用中。Customer状態改修のCS-03までを完了し、CS-04のDev反映・受入れをマスタデータ管理改修後まで延期しています。Customer archive safetyはCAS-01設計を完了し、CAS-02を通常サブエージェント運用で継続しています。
- 仕様・実装・進捗・実行証拠をこの案内へ複製せず、以下の各正本を参照します。remoteのlive状態は別承認の直接照合がない限り未確認です。
- governance移行の実行範囲・未検証事項は[移行記録](../migrations/2026-09-03-governance-3.0.0.md)、通常startupへの変更判断は[ADR 0045](../decisions/0045-governance-3-normal-startup.md)を参照します。

## 未決事項と承認

- 現在の製品checkpointはCustomer archive safetyのCAS-02。[実行契約とSpark試験記録](customer-archive-cas02-developer-trial.md)、[確認済み仕様](../specification.md)、[ADR 0046](../decisions/0046-customer-archive-reference-barrier.md)、[工程・進捗](../roadmaps/customer-archive-safety.md)、[実装設計](customer-archive-safety.md)から再開する。
- Spark用standalone Developer taskはcontext window不足とSpark固有usage limitにより実装前に中止し、再利用しない。CAS-02は製品差分0、実装未着手、得点0のまま、primary coordinator配下の通常`developer`サブエージェントで再開する。CAS-03/04、Rules、client/UI、参照writer、build、Dev/Prod、remote data/migration、package、restore、retention/purge、code一意性/検索拡張、他マスタは対象外。
- [CONF-0145](pending-confirmations.md#conf-0145-codex専用uiの外部郵便番号通信を遮断する追加checkpoint): 専用UIの郵便番号通信遮断と限定再試験は承認済み。通常利用・Dev・Schemas・保存形式を変えない。
- [CONF-0146](pending-confirmations.md#conf-0146-再試験の合成認証準備を親タスクで担当する例外): 今回に限り、親による専用合成Authの一時設定と通常ログイン入力を承認済み。認証情報をprompt・文書・logでagent間に受け渡さない。snapshotを変更せず、Emulator停止で失効させる。
- Customerの設計/reviewはHigh、開発/修正はMedium、test/環境準備/cleanupはLow。今回だけ親が合成認証準備と画面テストを担当し、専用build・process管理・backend assertion・cleanupはLow testerを維持する。
- CAS-02では、primary taskから通常の`developer`サブエージェントを作成し、Functions実装とdomain単体testだけを排他的single writerとして委譲する。coordinatorが差分とtestをreviewし、`tester`のEmulator統合testと独立review後に受入れ・local Git統合する。CAS-03以降の手順はCAS-02反省会後の利用者判断を待つ。
- 反省会一時メモは`.codex-test/customer-status-retrospective.md`、設計補助メモは`.codex-test/customer-status-security-design.md`。反省会と改善作業の両方が終了するまで削除しない。

## 次の作業

1. [CAS-02実行契約とSpark Developer試験記録](customer-archive-cas02-developer-trial.md)に従い、通常`developer`サブエージェントのroute確認後、CAS-02 Functions実装とdomain単体testを開始する。Spark用standalone taskを再試行せず、CAS-03/04も開始しない。
2. マスタデータ管理の一連の改修が揃った後、[Dev受入れの実施時期](../roadmaps/airguard-v2.md#今後のdev受入テストの実施時期)に従い、新しい状態filterの利用者判断、Customer状態のDev反映・権限別受入れ、他マスタとの関連操作をまとめて行う。停止済み専用Auth/Emulator/serverを再利用せず、別承認前にDev・remote・実dataへ進まない。

## 参照

- [確認済み仕様](../specification.md)
- [Customer取引状態roadmap](../roadmaps/customer-status.md)
- [Customer archive safety roadmap](../roadmaps/customer-archive-safety.md)
- [Customer archive safety実装設計](customer-archive-safety.md)
- [Customer状態のlocal検証記録](../verification/customer-02-status-local.md)
- [確認事項台帳](pending-confirmations.md)
- [local UI手順](../runbooks/local-ui-testing.md)
