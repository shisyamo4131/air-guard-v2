# SCR-03〜10 利用者環境Local受入れ receipt（2026-09-17）

- Evidence-producing UI checkpoint: `SCR-03-10-USER-LOCAL-01`
- Documentation checkpoint: `SCR-03-10-LOCAL-DOCS-06`
- Repository: `C:\Users\seven\projects\AirGuard\air-guard-v2`
- Branch: `codex/scr03-10-standard-crud-prelocal`
- UI execution baseline HEAD: `1be0c1c7764331925b13aee235732ccbc121b054` with uncommitted product-source diff.
- Corresponding committed product source: `f8f5f1c910030dc8bf3603e855d84f703d8dd675`.
- UI build target: `f8f5f1c910030dc8bf3603e855d84f703d8dd675`.
- Evidence type: 利用者が準備したLocal環境での可視UI受入れ receipt。個人情報、既存dataの識別子、Auth情報は記録しない。
- Scope: SCR-03、SCR-06、SCR-07、SCR-10のLocal確認。SCR-05は既存receiptにある限定UI証拠のみを参照する。Local成功は製品完了、Dev受入れ、得点加算を意味しない。

## 実行環境と境界

- 利用者が import-only Emulator、`localhost:3000` のLocal server、会社管理者でsigned-in済みのChromeを準備した。
- ConsoleでEmulator接続を確認した。coordinatorはEmulator、server、Chromeを停止・再起動・終了していない。
- このimport dataでは `System/system` 前提が成立し、通常UI writeが成功した。既存import dataは変更していない。
- 既存Employeeへの操作はread-only preflightの拒否確認だけとし、User/Authの作成・削除は行っていない。
- 利用者所有process・Chromeは稼働・openのまま保持した。fingerprint、cleanup、backend assertionは行っていない。

## 可視UIで確認した操作

### SCR-03 Site手動終了・再開

- 可視UIから架空のCustomer A/B、Site A、Employeeを作成した。
- 初回確認ではlifecycle入力がManager draftへ届かず保存に失敗した。修正後、Site AをACTIVEからTERMINATEDへ、理由付きで保存できた。
- reload後もTERMINATED状態と理由が保持された。
- TERMINATEDからACTIVEへ、理由と工期日付を入力して保存でき、保存直後にACTIVE状態、理由、工期日付が表示された。再有効化後のreload保持は確認していない。

### SCR-06 Customer archive

- Site Aを参照するCustomer Aのarchiveは、child documents existにより拒否され、dialogが維持され、対象が残存しarchive成功表示がなかった。backend assertionは行っていない。
- 参照のないCustomer Bは標準Manager／Schema archiveに成功し、一覧から消えた。
- Customer Aはactiveのまま残った。

### SCR-07 Site archive

- Site Aの標準archiveに成功し、一覧へ反映された。
- Site Aは合成dataとしてarchiveした。既存import dataは変更していない。archive成功は一覧からの可視消失で確認し、backend assertionは行っていない。

### SCR-10 Employee archive

- 合成Employeeではpreflight success後に標準archive dialogへ到達し、明示確認後に標準archiveへ成功し、一覧へ反映された。
- 既存import Employeeではpreflight拒否messageを確認し、標準dialogへ進まず、対象が残存しarchive成功表示がないことを確認した。backend assertionは行っていない。
- Employee/Auth/User連携の作成・削除は行っていない。

### SCR-05 稼働請求・実績lock・稼働外売上

- 今回は登録button非表示の既存UI証拠だけを参照した。取極め、金額調整、lock／解除、稼働外売上の保存・再表示・失敗経路は確認していない。
- 詳細は[旧SCR Local verification receipt](scr-local-verification-2026-09-17.md)を参照するが、SCR-05全体のLocal受入れ完了とは扱わない。

## 自動検証と既存証拠の扱い

| Command / evidence | Result | Exit / status |
|---|---|---:|
| `node --test test/domain/site-lifecycle.test.mjs test/domain/site-archive-client.test.mjs test/domain/site-ui-source-contract.test.mjs test/domain/site-lifecycle-ui-source-contract.test.mjs` | 25/25 | 0 |
| `node --test test/domain/*.test.mjs` | 1303/1303 | 0 |
| `npm run test:local:ui:build` | sourceHead一致、build成功 | 0 |
| `SCR-03-UI-FIX-REVIEW-02` 一般code review（対象3 app/test files） | findings 0 | 完了 |
| `npm run test:local` | 135/135、旧HEAD `082d9d70...` の既存backend/Rules証拠 | 既存証拠を限定再利用。current HEADで未再実行 |

UI buildの警告はBrowserslist、large chunks、service-worker sourcemap、Node `DEP0155`。失敗ではない。

`npm run test:local` の135/135は旧HEADのbackend/Rules証拠であり、今回のUI-only最終差分により影響しない範囲だけを再利用する。current HEADでの全Local Emulator再実行とは扱わない。UI実行時のproduct source 2 filesは、後にcommit `f8f5f1c910030dc8bf3603e855d84f703d8dd675`へ含めた内容と同一である。UI実行後、commit前に追加変更したのは `test/domain/site-archive-client.test.mjs` のfixtureだけで、f8f5f1c910030dc8bf3603e855d84f703d8dd675 はUI実行時の2 product files、既存のsite-lifecycle-ui source-contract test差分、および後追加fixtureをまとめたcommitである。

## 現在状態と未確認事項

- SCR-03、SCR-06、SCR-07、SCR-10は「Local検証済み・Dev受入れ待ち」、得点0とする。SCR-05は登録button非表示の限定UI証拠のみで、Implementation（prelocal・検証継続/待ち）、得点0とする。
- SCR-04、SCR-08、SCR-09には今回追加のUI証拠はない。SCR-09の既存Callable挙動・受入れは維持する。
- SCR-02の既存receiptと状態は変更しない。SCR-05の登録button非表示は既存の前receiptを参照し、今回再実行していない。
- restore、legacy/server-adapter、future lifecycle、Dev/Prod、remote、migration、repair、pushは未実施・対象外である。
- security reviewは未完了。今回のreview rowは一般code review（対象3 app/test files）だけであり、security review完了を意味しない。
- 既存import dataの変更有無をbackend assertionで再確認していない。利用者所有processのcleanupも行っていない。
- SCR-03〜10全体は完了扱いにせず、roadmapの進捗20%とSCR-02の状態を維持する。
