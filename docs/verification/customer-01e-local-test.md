# CUSTOMER-01E local分担検証記録

- 状態: local検証成功 / PM review済み / Dev検証は別途継続
- 実施日: 2026-09-03 JST
- Checkpoint: `CUSTOMER-01E-LOCAL-TEST-001`
- 担当: 「Local環境テスト」task `01a0650c-501d-7bf0-8569-d3a87f798750`
- 計画: [Customer追加検証](../implementation/customer-dev-release.md#追加検証のすり合わせ案)
- 開始source: `58d05aa52ecfc12883218a9c0e1ee0a117963352`

利用者はDev2種類・local2境界の検証を承認し、PMと別taskで分担して結果をPMが集約するよう指示した。NG事項の修正は禁止。変更なしcallbackがPMへ到達し、同じprimary repository・branch・baselineを双方が照合した後、local担当へ実行を割り当てた。

## 変更と結果

変更は`test/local/codex-local-harness.test.mjs`の2 test・75行追加だけ。製品code、Rules、設定変更はない。PMは実際の差分をreviewし、テストfile SHA-256 `E1F6C274C2C3DD4A2059474F329016CCD4D191875D763ACDF04C73F5DF7C76D2`が担当報告と一致することを独立確認した。

| 境界 | 検証結果 |
|---|---|
| 閲覧専用actorの既存Customer更新 | 有効・登録済みaccountantの更新は`permission-denied`。Rules経由の正常作成、同actorの読取り、拒否後のdocument不変、managerによる同形式の更新成功も確認 |
| 他社Customerの取得・一覧 | 合成2社それぞれの自社get/listが成功し、相互の他社get/listは`permission-denied`。対象不存在・未認証を拒否成功と誤認しない対照を確認 |

| Command | pass / fail / skipped | Exit status | 一次実行ID |
|---|---:|---:|---|
| `npm run test:local -- -TestNamePattern Customer` | 9 / 0 / 0 | 0 | `exec-f8be3a0f-1f62-4cbe-abd7-87fb6c36b8ae` |
| `npm run test:local` | 115 / 0 / 0 | 0 | `exec-96729f92-87ad-4ebe-b4e2-b30c6d242ab7` |
| `git diff --check` | 成功 | 0 | `exec-db49572c-bd98-454c-9fac-14412b8120f0` |

件数は担当の最終callback、commandの完了・exit statusはPMが`read_thread`で取得した独立command記録で確認した。対象実行の106件はpattern選択外で、TAPのskippedではない。共有harnessの変更に伴う回帰として既存suiteを1回実施し、PMは同じsuiteを再実行しなかった。テスト本体は5.099秒と38.969秒、計44.068秒。担当の時計確認区間は02:21:32〜02:25:44 UTCの4分12秒（それ以前の資料確認を含まない）。

## 隔離・終了処理・残存事項

実runnerは`demo-air-guard-v2-codex`、`firebase.codex-test.json`、loopback、`.codex-test/isolated-saved-data`を使用。Functionsを含む専用suiteで`AIR_GUARD_EXTERNAL_EFFECTS=deny`を適用した。合成2社は今回承認された陰性fixtureだけであり、Dev会社・利用者dataの複写、export、promotionは行っていない。

両実行でrunnerが利用者saved-dataと専用exportの前後指紋不変を確認した。Windows handleで一時directory削除が保留され、最初の手動cleanupはexit 1だったが、終了後の対象限定cleanupはexit 0。PMが取得した`exec-c6ec92e0-8a26-4c4e-9921-480d4dde701a`で、担当の2 runtime directoryの不存在・残存file 0、対象portとprocessの残存なしを確認した。利用者のprocessは停止していない。

製品NG・test NGはなし。CLIの認証期限とMOTD/remote config取得警告は出たが、専用Emulator検証はexit 0。再認証や修復は行っていない。runbookと実runnerのimport場所・Functions起動記載差、tester roleの通常import表記は未修正として残す。実Devのアクセス拒否を証明した結果ではない。

PM側の文書検証では`powershell -ExecutionPolicy Bypass -File scripts/test-project-docs-check.ps1`がexit 1（`f85ee5`）。検証用コピー内でCustomer計画から`test/local/codex-local-harness.test.mjs`へのlinkが解決できず、valid baselineが失敗した。通常のproject-docsは同時点でexit 0（`d8de7d`）。これは当該検証終了時にはNG修正禁止のため未修正として報告した。後の利用者承認による限定修正と閉鎖結果は[Dev統合記録の閉鎖節](customer-01e-dev-test.md#利用者承認によるフェーズ閉鎖)を参照する。現在のDev再開位置は[current handoff](../implementation/current-coordinator-handoff.md)を参照する。
