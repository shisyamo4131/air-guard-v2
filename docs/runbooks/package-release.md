# package release runbook

- 状態: 運用中
- 最終確認日: 2026-08-27
- 役割: 関連packageのconsumer更新、公開、rollback

## 関連パッケージの更新

`air-guard-v2-schemas`の公開済みversionをルートアプリとCloud Functionsへ同時に反映する場合、security・authorizationに関係するcatalog変更では`@dev`やrangeを使わず、承認済みのexact versionを両方へ指定する。UWB-09で確認済みのversionは`2.4.2-dev.166`である。

```powershell
$env:NODE_USE_SYSTEM_CA = "1"
npm install --save-exact @shisyamo4131/air-guard-v2-schemas@2.4.2-dev.166
Push-Location functions
npm install --save-exact @shisyamo4131/air-guard-v2-schemas@2.4.2-dev.166
Pop-Location
```

各commandのexit statusを独立して確認し、ルートとFunctionsの`package.json`、`package-lock.json`、実installについてversion、resolved tarball、integrityが一致することを検証する。role preset catalogの導入では、公開`./constants` importへ全callerを移行してからlocal catalogを削除し、client strict判定、Functions strict判定、一般client互換判定を別々に回帰確認する。公開packageの存在だけでconsumer導入成功とはみなさない。

UWB-09のconsumer rollbackは、AirGuardV2の依存をexact `2.4.2-dev.164`へ戻し、両local catalogとpackage import以前のcatalog参照を同時に復元する。ただし、旧実装のtruthyな`ROLE_PRESETS[role]`判定は復元せず、local catalogに対する`typeof role === "string" && Object.hasOwn(ROLE_PRESETS, role)`相当のprototype-safe membershipをstrict経路と一般展開へ維持する。`toString`、`constructor`、`__proto__`を含む陰性testとpolicy/parity testを再実行し、rollback自体を別のconsumer変更としてreviewする。公開済みpackageのunpublish、tag削除、force push、history rewriteには依存しない。

公開元でのバージョン作成・タグ push・Trusted Publishing は`governance/project-rules.md`と次の手順に従います。ローカルから`npm publish`しません。

1. `air-guard-v2-schemas`のbranchとworktreeを確認し、変更をcommitする。
2. `npm version prerelease --preid=dev`を実行する。
3. current branchと作成された`v*-dev.*` tagを個別にpushする。`--follow-tags`は使用しない。
4. `.github/workflows/publish.yml`のTrusted Publishingと`npm view @shisyamo4131/air-guard-v2-schemas@dev version`で公開結果を確認する。
5. pushだけが失敗した場合は`npm version`を再実行せず、既存commit・tagを確認して失敗したpushだけを再開する。
