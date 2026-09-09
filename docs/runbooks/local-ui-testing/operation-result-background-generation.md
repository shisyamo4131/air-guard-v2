# 実績の背景生成

- 状態: 運用中
- 役割: 実績から4保存先への背景生成をCodex専用local UIで検証する個別手順

先に[local UI検証runbook](../local-ui-testing.md)の共通手順を適用する。

実績から勤怠・従業員別稼働・取引先請求・現場履歴への背景生成を対象にする場合だけ、Emulatorを起動する専用前景processで`AIR_GUARD_CODEX_OPERATION_RESULT_TRIGGER=enabled`を設定する。専用entryに登録された`codexOnOperationResultChange`は、既定ではeventを処理せず、明示設定時もdemo project・Functions Emulator・loopback Firestore・外部作用denyを検査する。他triggerや通常entryを公開しない。終了時には設定を破棄する。通常の`npm run test:local`は親processのこの設定を除去して子を起動し、終了時に元の有無・値を復元する。

この背景生成のUI検証では、正規画面で作成した実績から上記4保存先へ到達したことをbackend assertionで確認する。直接use-caseを呼んだtestと区別し、一つの保存先の出現だけでtrigger全体成功とは扱わない。
