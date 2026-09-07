# CUSTOMER-01C local preparation verification receipt

- 状態: Verified local preparation / immutable execution evidence
- Evidence ID: CUSTOMER-01C-LOCAL-PREP-001
- 実施日: 2026-09-03 JST
- 最終artifact確認直後: 2026-09-02 23:51:04 UTC
- build source commit: `281272410dbb09e477e1e9c898c39225ec9b683e`
- branch: `codex/dev-user-reservation-migration`
- 関連計画: [Customer Dev反映・受入れ計画](../implementation/customer-dev-release.md)

## 実施境界

利用者の「タスク交代なし・Devテスト直前まで」の指示に基づき、localの差分・下流経路確認、必要なbuild不具合修正、test、review、静的生成とartifact確認を行った。Dev接続、deploy、maintenance操作、Firestore読取り・変更、通知送信、外部住所検索は行っていない。先のDev保存形式検査は別の[実行証拠](customer-01b-dev-compatibility.md)であり、今回再実行していない。

## 発見した不具合と修正

最初の`npm run generate:dev`はexit 0だったが、生成`sw.js`のFirebase設定がplaceholderのままだった。通常application用のVite pluginは独立Service Worker buildへ引き継がれていなかった。

`nuxt.config.js`で変換pluginをfactory化し、`pwa.injectManifest.buildPlugins.vite`と開発時の`vite.plugins`へ別instanceを渡した。公開設定6項目を引用符・改行等を保持して一度だけ置換する。Service Worker本体、通知処理、Customer、Rules、Functions、packageは変更していない。`test/domain/codex-nuxt-config.test.mjs`へ実設定・実SW sourceを合成値で検査する回帰を追加した。

初回artifactはreleaseへ使用しない。修正後の固定commit・clean状態から再生成し、以下の確認に成功した。

## 検証結果

| Command | 結果 | Exit status |
|---|---|---:|
| `node --test test/domain/codex-nuxt-config.test.mjs` | 11/11成功。合成Dev/Prod、6設定、escaping、path、専用PWA除外等 | 0 |
| `node --test test/domain/*.test.mjs` | 817/817成功。修正後1回 | 0 |
| `npm run generate:dev` | 固定commitのDev静的生成成功 | 0 |
| local artifact照合用`node --input-type=module` | 以下の全条件成立。一次出力`92f001` | 0 |
| `powershell -ExecutionPolicy Bypass -File scripts/test-project-docs-check.ps1` | 最終計画・code修正状態で21ケース成功。一次出力`b3acfa`・`39a9f3` | 0 |
| `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2` | 同turnのgovernance反映後にmanaged一致、内包rendererも成功。以後失効対象の変更なし | 0 |
| `powershell -ExecutionPolicy Bypass -File scripts/test-codex-session-size.ps1` | 同turnに7 checks成功。以後失効対象の変更なし | 0 |

buildはPowerShellで`NUXT_TELEMETRY_DISABLED=1`を当該processだけに設定し、command直後の`$LASTEXITCODE`を終了値として返した。最終generate一次出力は`c3776a`・`369e0e`。直接testと全domainはdeveloperが独立したprocess exitを確認し、reviewerはcodeとtestをread-onlyで確認した。親は実生成物を確認した。

最終文書の`powershell -ExecutionPolicy Bypass -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2`と`git diff --check`は、本receipt・索引・snapshotを含めてcoordinatorの最終command報告へ記録する。

## Artifact identity

- 生成時と確認時のHEADは上記build source commit、tracked worktreeはcleanだった。
- Hostingの`dist` junctionは同じrepositoryの`.output/public`を指した。
- 181 files、24,795,614 bytes。
- tree SHA-256: `f50b36d096c71bf7289da391bcb5a8317b5f172a070f4ed435f3b77a36e62f18`。
- hash算出は`dist`実体下の全通常fileの相対pathを`/`区切りにして昇順sortし、各`path + NUL + 内容SHA-256小文字hex + LF`をUTF-8で連結してSHA-256とした。内部symlinkは許可していない。
- `index.html`、`200.html`、`404.html`、`customers/index.html`、`sw.js`、`manifest.webmanifest`が存在し、index内の`/_nuxt/`参照27件がすべて解決した。
- HTMLとSWを構文解析し、公開Firebase設定6項目を`.env.development`と比較した。Dev project一致、Emulator false、SWのplaceholder不在を確認した。環境値・認証情報は出力していない。
- HTMLのsender IDはNuxtにより数値化されるため、安全な整数かつ10進文字列への変換が設定値と完全一致することを確認した。他の5項目とSW側6項目は文字列として完全一致を確認した。

最初の照合式はHTMLのbooleanとsender IDの数値化を文字列との不一致と判定した。構文解析と上記の型条件へ訂正して再確認したもので、これらの型に対する製品code変更は行っていない。

## 証拠の再利用と限界

今回のclassはapplication logicとbuild/release。comprehensive gateと直接影響domain・Dev generateを選び、managed/capacityの成功は[検証policy](../../governance/verification-policy.json)の失効条件に当たらないため再利用した。Customer/Rules/Functions/schemaは不変なので[local受入れ](customer-01a-local-acceptance.md)のEmulator証拠を維持し、再実行しない。専用UIはPWAを無効化するため、今回の独立SW buildの代替検証にせず実Dev生成物を確認した。Prod生成・remote試験は範囲外。

buildにはBrowserslistデータの古さ、大きいchunk、変換pluginのsourcemap、Nitro import、payload glob、CSRのprerenderに関するwarningが残った。生成と上記artifact確認は成功したが、Dev上の通知・画面・業務動作を証明しない。

build後の文書・実行証拠commitをartifactのsource commitと混同しない。次のrelease時は明示したsource commitと生成物を再照合し、別HEADのartifactとして黙って使用しない。現在のremote revision、切替対象・時間、条件2の下流状態、通常Dev操作は未確認であり、[計画](../implementation/customer-dev-release.md)に従ってDev実行前で停止する。
