# Employee Dev反映前API接続 Local検証記録

- Checkpoint: `MASTER-DEV-PREFLIGHT-01` No.2〜3
- 対象commit: `2265bc34`（`feat: connect employee archive callable`）
- 対象: Employee archive Callableの通常Functions API entrypoint接続と、通常用許可設定の既定拒否・Codex専用demo設定との分離
- 対象外: Dev/Prod deploy、remote接続、対象tenant開放、実data読取り・補完、migration、IAM変更

## 実測結果

| 区分 | command・操作 | 結果 | exit |
|---|---|---|---:|
| 直接domain | `node --test test/domain/employee-archive.test.mjs test/domain/codex-functions-entrypoint.test.mjs` | 35/35成功 | 0 |
| 全domain | `node --test test/domain/*.test.mjs` | 1507/1507成功 | 0 |
| Local Emulator | `npm run test:local` | 181/181成功。demo project、loopback限定、保存済みdata不変 | 0 |
| 専用UI build | `npm run test:local:ui:build` | clean `2265bc34`から生成成功 | 0 |
| 文書 | `pwsh -NoProfile -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` | 260 Markdown、61 ADR、11 roadmap、8 TOML成功 | 0 |
| 差分 | `git diff --check` / `git diff --cached --check` | whitespace errorなし | 0 / 0 |

`npm run test:local`のsandbox実行はFirebase CLI設定の読取りでEPERM・exit 1、専用UI buildのsandbox実行はuser directoryのreadlinkでEPERM・exit 1となった。いずれも製品testへ到達する前の権限制約として切り分け、承認済みの権限付き経路で同一commandを再実行して上表の成功を確認した。

## Chrome受入れ

利用者が指定した起動中Chromeを使用した。最初に開いていた利用者用Local画面には実在情報の可能性がある従業員が表示されたため、archive操作を行わず、`demo-air-guard-v2-codex`・loopback専用port・外部作用denyのgenerated UIへ切り替えた。

保存済み単一合成accountへ起動中Auth Emulator内だけで一時passwordを設定し、通常keyboard操作でsign-inした。正規画面から架空従業員1件を登録し、詳細画面のarchive導線・理由保持を確認した。初回archiveは保存済みsnapshotに`System/system.isMaintenance=false`がなく安全に拒否され、原本削除0だった。不在を確認後、起動中Emulatorだけへcreate-onlyで環境baselineを追加し、利用者の削除確認後に同じ架空従業員を再実行した。

画面は「従業員をアーカイブしました。」を表示して在職者一覧0件へ戻った。backend read-only assertionは通常原本なし、archiveあり、理由・Employee ID一致、archive時刻ありでexit 0だった。通常用tenant許可設定は変更せず既定空集合を維持し、専用demo用許可は当該前景Emulator processだけに限定した。

## Cleanup・残留事項

generated serverからEmulatorの順にCtrl+Cで停止し、停止要求による各exit 1を確認した。専用9portのLISTENは0、`.output`はexact repository配下・directory・reparse point不在を確認して削除した。`.codex-test/saved-data`は7 files / 3492 bytesで、SITE-08記録済みfingerprintと一致した。Chromeは元の`http://localhost:3000/customers`へ戻した。一時passwordはEmulator停止で失効し、一時Clipboard内容は空にした。

今回のUI開始前にroot `firebase-debug.log`等のfingerprintを取得しなかったため、既存root debug logの開始内容不変・復元は確認できない。現在のdebug logは保持し、推測で削除・上書きしない。製品source、tracked worktree、保存済み合成snapshot、利用者用Local dataの完了判定には使用しない。
