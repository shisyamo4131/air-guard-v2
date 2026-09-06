# Employee EMP-02〜04 local検証記録

- 対象: EMP-02 作成・基本・国籍、EMP-03 警備員登録・資格、EMP-04 3保険の保存
- 実施承認: 2026-09-06「EMP-04まで一気通貫で作業開始」
- 開始baseline: `9f4ec24d783f0c81fd89a056dc0ff4893f0f83a4`、primary `codex/employee-master-roadmap`
- 現在工程・進捗・次作業の正本: [Employeeロードマップ](../roadmaps/employee.md)

## 実施範囲と証拠の区分

EMP-01で確定した[仕様](../specification.md#employeeの操作権限と保持)と[設計契約](../implementation/employee-master.md#通常保存の技術契約)を対象とする。各工程の実装・独立review・自動検証・正規UI操作・backend assertion・cleanupを個別に確認する。source commitはUI検証用のclean HEADを得る境界であり、その時点だけで工程完了としない。各工程で実際に得た結果だけを下記へ追記し、後続工程で無効になる証拠を区別する。

UIはCodex専用demo `demo-air-guard-v2-codex`、loopback、合成data、外部作用deny。Dev/Prod、利用者用saved-dataへの書込み、実provider接続、package変更は対象外。geocoding成功・0座標・遅延/競合は注入した合成応答で試験し、外部接続をしないUIでは住所保存と座標未取得の通知を確認する。

## 開始時点の環境確認（2026-09-06）

rootが専用in-app browserのタブ取得を確認した。専用port（14600、19099、18080、19000、19199、15001、14400、14500）にLISTENはなく、`.output`は存在しなかった。既存のdatabase/firestore/pglite debug logをroot所有の`.codex-test/runtime/emp02-04-ui`へ退避し、SHA-256を記録した。他のruntimeは保持する。

以下は開始時のファイル数・bytes・集約SHA-256。FullName順のrelative path（先頭区切りあり）・length・file SHA-256を`|`で連結し、LF結合したUTF-8のSHA-256を使用した。終了後も同方式で比較する。data内容とcredentialsは記録しない。

| 対象 | files | bytes | SHA-256 |
|---|---:|---:|---|
| 利用者用 saved-data | 7 | 6012330 | C0E4BF8B382A786B8EBAA4C6729937D6DDEC6804DCFD0C464FA1C1F38F8BA584 |
| Codex UI saved-data | 7 | 3492 | 12D57744070A8F7D699A4B0A631851BEB87E529E59F8CA570BC930BD9838EC47 |
| Codex isolated-saved-data | 7 | 3520 | 9FD810AB2232A7BB10D89786FE84A72BDC4720ADFA7FC6A1E388995D15720BC1 |

## 共通検証の実測

source baseline上で`powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2`、`powershell -ExecutionPolicy Bypass -File scripts/test-project-docs-check.ps1`、`powershell -ExecutionPolicy Bypass -File scripts/test-codex-session-size.ps1`を個別実行し、それぞれexit 0を確認した。managed/renderer整合、negative fixturesの期待結果一致、capacity合成7 checksが成功した。現在taskの容量測定ではない。該当validator/route/policyが後続編集で変更されなければpolicy上再利用する。製品domain・Rules・UIの成功証拠とはしない。

## EMP-02 実装・review・検証

開始baselineは上記`9f4ec24`。UI・application logic・data contract/schema・permissions・専用buildのclass unionで選択した。共通3gateに加え、project-docs、全domain、local Emulator、専用UI build、diff-checkを完了gateとする。Dev/Prodのgenerate/deployはrelease-onlyかつ未承認のため実施しない。利用者仕様の変更はなく、specificationのversion更新・新ADR・migration・package/governance設定変更はない。既存ADRの工程停止記述は履歴化し、最新承認とroadmapへ接続した。

### 独立review

- EMP-02-SEC-R1: `employeeContract.js`、`saveEmployee.js`、関連clientとtestをread-only確認。住所の同値preflight後の競合保存、国籍解除時の入力patch残存、在留期間制限解除の満了日消去と期待値を修正し、再reviewで3件解消・追加blockingなし。runtime成功の代用にはしない。
- EMP-02-CLIENT-R1: editor/controller/共有契約/testとmessage queue接続をread-only確認。作成後の遷移で警告が消える問題と、表示名を元の値へ明示入力した場合の優先漏れを修正し、再reviewで2件解消・追加blockingなし。次工程で共通editorを使うための追加設計判断はない。

### 実測（UI前）

- `npm run test:local`: 172 tests / pass 172 / fail 0、exit 0。実Functions HTTPの作成・基本patch・不正field・同ID重複、外部作用deny、および7actor原本/archive read・直接CUD/nested/他tenant拒否を含む。runnerが利用者saved-data不変、専用import read-onlyを確認して終了した。
- `node --test test/domain/*.test.mjs`: 初回は1179 tests中1178 pass、exit 1。既存Rules予約collection期待値に`Employees_archive`がない1件で、Rulesの保護を維持して期待値を更新する。最終結果は後記する。
- 同commandを期待値修正後に再実行し、1179 tests / pass 1179 / fail 0、exit 0。local harnessを変更しないtest期待値の修正なので、上記Emulator証拠は有効。
- `git diff --check`: exit 0。project-docsの初回は既存見出しlinkの欠損でexit 1。見出し識別子を保持して履歴の説明を本文へ置く形に修正した。

直接UI・backend assertion・専用build・最終文書gate・統合・cleanupはこの時点では未完了であり、EMP-02の進捗は加点しない。
