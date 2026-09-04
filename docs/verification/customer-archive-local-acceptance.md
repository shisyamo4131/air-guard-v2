# Customer archive safety local acceptance verification receipt

- 状態: Verified / immutable execution evidence
- Evidence ID: CUSTOMER-ARCHIVE-CAS04-LOCAL-ACCEPTANCE-001
- 実施日: 2026-09-04
- 対象環境: Codex専用local demo project `demo-air-guard-v2-codex`
- 対象commit: `8db79a2e2325e06bda845c6bd2758414f79f5b06`
- 関連実装: [Customer archive safety実装設計](../implementation/customer-archive-safety.md)
- 関連手順: [local UI検証runbook](../runbooks/local-ui-testing.md)

## 境界

- clean worktreeの対象commitから専用buildを生成し、設定・backend確認ではloopbackのAuth・Firestore・Realtime Database・Storage・Functions Emulatorとgenerated serverを使用した。完全なbrowser network host traceは取得しておらず、未調査の全通信先がloopbackだけだったとは主張しない。
- 保存済み合成会社管理者、可視UIから作成した合成Customer 2件と合成Site 1件だけを操作した。利用者のChrome、利用者用`./saved-data`、Dev、Prod、remote dataへ接続していない。
- UI操作は可視画面の通常のpointer・keyboard操作だけを使用した。Firestore RESTによる管理者Userの一時的なread-only actor化と操作後の照合は、actor baselineの非UI準備・read-only backend assertionとしてUI証拠から分離した。
- deploy、push、export-on-exit、saved-data promotion、migration、package変更、外部作用の許可変更は実施していない。

## 自動検証・レビュー

| Gate | Command | 結果 | Exit status |
|---|---|---|---:|
| CAS-04 targeted | `node --test test/domain/customer-archive-client.test.mjs test/domain/customer-ui-source-contract.test.mjs` | 65/65成功 | 0 |
| 全domain | `node --test test/domain/*.test.mjs` | 913/913成功 | 0 |
| Codex専用Emulator | `npm run test:local` | 142/142成功 | 0 |
| Codex専用UI build | `npm run test:local:ui:build` | cleanな同一HEAD・専用設定identityを確認して生成成功。client 11.01秒、server 18 ms | 0 |
| project文書 | `powershell -ExecutionPolicy Bypass -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` | TOML 8件、Markdown 228件、ADR 48件、roadmap 8件を検証 | 0 |
| 差分形式 | `git diff --check` | whitespace errorなし。改行変換warningのみ | 0 |

- application/UI差分の独立general reviewは非同期validation中の再入可能性を指摘し、同期的なsingle-flight guardと実SFC挙動testを追加した後の再reviewで未解決指摘0件となった。
- 独立security reviewは最終application/UI差分を5/5、未解決指摘0件と評価した。これはlocal差分の静的reviewであり、Dev・Prod・remoteのGOではない。
- 上表の`project-docs`と`diff-check`は文書候補へ実行後、その結果を本receiptへ反映したため、最終文書状態で再実行して統合commitへ記録する。後続が文書だけであるため、domain・Emulator・UI buildは対象application commitへ結び付く成功証拠を維持する。

## 可視UIの観測

- 保存済み合成会社管理者sessionでdashboardへ到達し、画面内navigationから取引先一覧へ移動した。write actorには作成・編集・「アーカイブ」が表示された。
- 可視UIから参照ありCustomer、これを参照するSite、参照なしCustomerを作成した。対象業務dataをbackendへ直接注入していない。
- 確認dialogでCustomer code/name、誤登録・重複専用、参照時は実行不可、通常画面から復元不可、理由入力、不要な個人情報・認証情報を入力しない案内、取消を確認した。
- 参照ありCustomerでは、実行直後に理由・閉じる・取消・実行controlが無効化され、安全な参照拒否messageを表示した。画面上でCustomerと参照Siteが残った。
- 参照なしCustomerの実行buttonを通常pointerの高速double-clickで操作した。直後に同じ4 controlが無効化され、1回のarchive処理だけで取引先一覧へ復帰し、対象行が消えた。
- 稼働中Emulatorの合成会社管理者Userだけを非UI setupで`controller` presetへ一時変更した。既存sessionで取引先一覧と詳細を閲覧できる一方、作成controlが消え、詳細の「アーカイブ」buttonは0件だった。このactor変更はexportせずEmulator停止で破棄した。
- archive操作開始前のbrowser console errorは3件、read-only確認後も3件で、archive・read-only操作による増分は0件だった。3件は合成住所作成時の`[ClientGeocoding] Error: FirebaseError: internal`であり、本実行では原因のnetwork traceを取得していないためarchiveの成功証拠や新規不具合へ読み替えない。

## backend補助assertion

- 参照ありCustomerはactiveに存在しarchiveに存在せず、参照Siteもactiveに存在した。参照なしCustomerはactiveに存在せずsame-ID archiveに存在した。
- 成功archiveはtop-levelが`schemaVersion`・`customer`・`audit`だけ、schema version 1、Customer snapshot 26 fields、auditがactor・時刻・operation ID・reasonの4 fieldsであることを確認した。識別子、reason、snapshot値は本receiptへ記録しない。
- Functions foreground logでは各browser actionにCORS前処理と認証済みCallable本処理が1組ずつあり、参照拒否1回と成功1回を確認した。double-clickによる成功Callable本処理の追加実行はなかった。

## 終了確認

- Codexが作成したbrowser tabを閉じ、generated server、Emulatorの順にCtrl-Cで停止した。両foreground processはsignal終了のためexit status 1であり、成功exit 0とは扱わない。Emulatorはclean shutdownを報告した。
- 専用8 portsと派生port 9150・8953のLISTENは0件だった。Codex in-app browserのtab一覧も0件だった。
- `.codex-test/saved-data`は実行前後とも7 files、3492 bytesで、今回の同一集約手順によるSHA-256 `7096598FBB4AE2BFB072E7B3B89F88BD19E1AA5F9ACAFCB306AE73C1E3BCBF1B`が一致した。
- 既存root debug log 4件は開始前backupから内容、長さ、UTC更新時刻、SHA-256の一致を確認して復元した。安全な絶対path・project包含・reparse不在を確認後、今回の`.output`と`.codex-test/runtime/cas04-ui-8db79a2e`だけを削除した。
- 最終確認時のHEADは対象commit、tracked worktreeはcleanだった。画面で作成した合成dataと一時actor変更はexportしておらず、Emulator停止で破棄した。

## 完了判定と対象外

CAS-04のclient/UI local実装、自動test、独立review、Codex専用local UI受入れは完了した。Customer archive safety全体は90%で、CAS-05のDev反映・利用者受入れはマスタデータ管理の一連の改修後まで延期し、別承認とする。

Dev・Prod・remote database/IAM/App Check/edition・実data・既存archive形状・実参照件数・正式運用可否は未確認である。operator inspection、緊急restore、retention、purge、物理delete、Customer code一意性・検索拡張、3参照collection全体のpermission見直しは本receiptの範囲外である。

本receiptは実行時点の証拠であり、後続の現在状態を表さない。現在状態はCustomer archive safety実装設計、roadmap、current coordinator handoffを参照する。
