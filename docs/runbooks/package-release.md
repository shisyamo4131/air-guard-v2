# package release runbook

- 状態: 運用中
- 最終確認日: 2026-08-28
- 役割: 関連packageのconsumer更新、公開、rollback

## 関連パッケージの更新

`air-guard-v2-schemas`の公開済みversionをルートアプリとCloud Functionsへ同時に反映する場合、security・authorizationに関係するcatalog変更では`@dev`やrangeを使わず、承認済みのexact versionを両方へ指定する。現在のAirGuardV2 app/Functions consumerは、UWB role presetとCCB v1 public contractを含む`2.4.2-dev.167`へ固定している。Admin SDKもlocal commit `c95660d`でexact `.167`へ導入済みで、CCB tenantへの旧破壊操作をfail closedにするが、CCB-aware backup/restore自体は未提供である。

```powershell
$env:NODE_USE_SYSTEM_CA = "1"
npm install --save-exact @shisyamo4131/air-guard-v2-schemas@2.4.2-dev.167
Push-Location functions
npm install --save-exact @shisyamo4131/air-guard-v2-schemas@2.4.2-dev.167
Pop-Location
```

各commandのexit statusを独立して確認し、ルートとFunctionsの`package.json`、`package-lock.json`、実installについてversion、resolved tarball、integrityが一致することを検証する。role preset catalogの導入では、公開`./constants` importへ全callerを移行してからlocal catalogを削除し、client strict判定、Functions strict判定、一般client互換判定を別々に回帰確認する。公開packageの存在だけでconsumer導入成功とはみなさない。

UWB-09のconsumer rollbackは、AirGuardV2の依存をexact `2.4.2-dev.164`へ戻し、両local catalogとpackage import以前のcatalog参照を同時に復元する。ただし、旧実装のtruthyな`ROLE_PRESETS[role]`判定は復元せず、local catalogに対する`typeof role === "string" && Object.hasOwn(ROLE_PRESETS, role)`相当のprototype-safe membershipをstrict経路と一般展開へ維持する。`toString`、`constructor`、`__proto__`を含む陰性testとpolicy/parity testを再実行し、rollback自体を別のconsumer変更としてreviewする。公開済みpackageのunpublish、tag削除、force push、history rewriteには依存しない。

公開元でのバージョン作成・タグ push・Trusted Publishing は`governance/project-rules.md`と次の手順に従います。ローカルから`npm publish`しません。

1. `air-guard-v2-schemas`のbranch、HEAD、upstream、clean、primary-only worktreeを確認し、fresh remote refとfast-forward可能性を照合する。
2. version未準備なら承認済みversion checkpointで`npm version prerelease --preid=dev`を実行する。package/lock versionがreview済みrelease commitに既に含まれる場合は再実行せず、exact version、commit、tag不存在、registry未使用を確認する。
3. exact release tagを与えたrelease guardを実行し、test、public import、pack内容を独立に確認する。
4. review済みrelease commitへannotated `v*-dev.*` tagを作り、current branchとtagを個別にpushする。`--follow-tags`は使用しない。
5. `.github/workflows/publish.yml`のTrusted Publishing完了、exact registry version・integrity、一時directoryへのfresh installとpublic subpath importを確認する。
6. pushだけが失敗した場合はversion作成やtag作成を再実行せず、既存commit・tag・remote refを確認して失敗したpushだけを再開する。

Windowsの`core.autocrlf=true` checkoutで得たlocal pack digestは、GitHub/LinuxのLF checkoutから公開したtarballと一致しない場合がある。digest差だけでsource差と判定せず、registry tarball自身のmetadata digestを確認した上で、exact commitを`git -c core.autocrlf=false -c core.eol=lf archive`した一時treeを公開時と同じNode/npmでpackし、tarball bytesと全published pathを比較する。LF-normalized比較だけで受入れず、LF clean treeとregistry artifactのraw byte差0、fresh exact install、public importを完了条件とする。

公開後はunpublish、tag移動・削除、force push、history rewriteをrollbackに使わない。consumer未導入なら既存exact versionを維持し、公開packageに問題がある場合は修正版を後続versionとして公開する。
