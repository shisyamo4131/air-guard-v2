# UI snapshot candidateの受入れとpromotion

- 状態: 運用中
- 役割: signup後のcandidateを検証して専用saved-dataへ昇格する個別手順

先に[local UI検証runbook](../local-ui-testing.md)の共通手順を適用する。

正規signup後のexportは直ちに専用saved-dataへ昇格せず、`.codex-test/ui-candidate`へ置く。candidate importを起動し、backend verifierへ正規signupで使用した合成email、会社名、会社名カナ、表示名を`CODEX_UI_SYNTHETIC_EMAIL`、`CODEX_UI_SYNTHETIC_COMPANY_NAME`、`CODEX_UI_SYNTHETIC_COMPANY_NAME_KANA`、`CODEX_UI_SYNTHETIC_DISPLAY_NAME`として渡して`npm run test:local:ui:candidate:accept`を実行する。この処理はUI証拠ではなくbackend assertionであり、合格時だけcandidate directory SHA-256とclean source HEADを`.codex-test/ui-candidate-acceptance.json`へ記録する。実在情報やpasswordを渡さない。verifierは会社名カナを正規signup入力と完全一致で確認し、会社名カナ形式・40文字境界と、claim company ID・Auth UIDが単一の安全なFirestore path segmentであることを検証してからURL encodeしてGETする。

backend verifierのtransport契約は分離する。Authentication account列挙はAuth Emulator `127.0.0.1:19099`の`accounts:query`へJSON bodyを伴うPOSTを1回だけ行う。CompanyとUserはFirestore Emulator `127.0.0.1:18080`へbodyなしGETを各1回行う。Auth helperからFirestoreへ、Firestore helperからAuthへ到達せず、いずれも外部hostを使用しない。このbackend assertionをbrowser UI操作の証拠として数えない。

promotion前にCodex管理browser、generated server、Emulatorを停止する。`npm run test:local:ui:promote`は専用port `14400`、`14500`、`14600`、`15001`、`18080`、`19000`、`19099`、`19199`のLISTENがなく、acceptance receiptとcandidateの再計算SHA-256・現在のclean source HEADが一致する場合だけ`.codex-test/saved-data`を置換する。candidate変更、source変更、receipt欠損、process残存時は変更前に停止する。receiptと既存saved-dataは置換前にruntimeへ退避し、置換失敗時は復旧する。置換後のbackup削除だけが失敗した場合はpromotionを維持して`cleanup_required`を返し、対象runtime backupを明示する。

`scripts/run-codex-local-ui-child.ps1`は使用せず、上記の独立した前景commandを使う。
