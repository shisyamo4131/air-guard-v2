# FGA-03 Site Manager・document LWW Local検証記録

## 対象

- Checkpoint: `FGA-03-SITE-MANAGER-LWW-05`
- 実施日: 2026-09-11
- Repository: `C:\Users\seven\projects\AirGuard\air-guard-v2`
- Branch: `codex/fga-03-site-normal-auth`
- 基準HEAD: `104914e3dff08da26732b78f7097c907ab830b6b`
- 証拠状態: 基準HEAD上のLocal候補を検証済み。Dev・Prod反映、remote product受入れは未実施

## 確認した変更

- Siteの通常CREATE・UPDATEを単数`SiteManager`と複数形`SitesManager`からSite modelの標準`create`／`update`へ直接接続した。一覧の行選択は複数形Managerの`beforeEdit`から詳細へ遷移し、一覧dialogを開かない。
- 詳細の基本情報・Customer変更を単数`SiteManager`へ接続し、旧専用作成dialog、基本情報editor、Customer editorを削除した。
- listener由来のSite instanceをManagerへ直接渡し、編集中も受信した最新document全体でdraftを置き換える。通常保存は競合拒否を設けず、後から保存した通常field全体を正本とする。
- 作成用CustomInputはremote mainの履歴で確認した3ステップ方式とし、取引先名検索、既存Customerの任意選択、現場情報入力を順に行う。候補がない場合や選択しない場合も、入力した取引先名で仮登録できる。
- 通常保存用の`useSiteActions`、専用writer、埋込みCustomerのexact 6-field要件を撤去した。通常createとCustomer変更時のCustomer取得、validation、会社prefix、metadata、transaction保存はSite schemaと標準adapterへ委ねる。
- Agreement、終了、再有効化、archiveは従来の専用UI・Callable／transactionを維持した。直接deleteは引き続き拒否する。
- Rulesは通常updateで`status`と`agreementsV2`だけを保護する形へ訂正した。Functions、schema、package、既存data、migrationは変更していない。

## Local検証

| Gate | Command | 結果 | Exit status |
|---|---|---|---:|
| targeted-domain | `node --test --test-reporter=spec test/domain/site-operations.test.mjs test/domain/site-ui-source-contract.test.mjs test/domain/site-lifecycle-ui-source-contract.test.mjs test/domain/site-archive-client.test.mjs` | 33件成功 | 0 |
| domain-full | `node --test test/domain/*.test.mjs` | 1,549件成功 | 0 |
| local-emulator-site-rules | `pwsh -NoProfile -File scripts/run-codex-local-test.ps1 -Mode Test -TestNamePattern "Site Rules"` | 13件成功 | 0 |
| local-emulator-suite | `npm run test:local` | 182件成功。専用demo project・loopbackだけを使用し、保存済み利用者dataは変更なし | 0 |
| project-docs | `pwsh -NoProfile -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` | 295 Markdown、69 ADR、12 roadmap、8 TOMLを検証して成功 | 0 |
| diff-check | `git diff --check` | whitespace errorなし。Gitの既定改行変換警告だけを確認 | 0 |

`local-ui-build`はverification policy上省略可能であり、未commit候補にclean HEADを要求するため省略した。画面componentのcompileはdomain test、保存境界はEmulatorで確認した。実browser確認の代替とは扱わない。

## Rules安全確認

- 評価: 4 / 5。tenant、本人確認、有効User、作成時のACTIVE、Customer参照、通常更新からの状態・取極め変更、client delete、archiveへのclient書込みは維持されている。
- 承認済みの残余risk: 同一tenantの認証済み本登録Userがapplicationを介さず直接requestを組み立てた場合、通常fieldの型・長さや、通常画面にない終了・予定関連fieldの変更をRulesだけでは防がない。本checkpointの脅威モデルでは追加対策を行わない。
- 将来、application外のrequestも対象にする場合は、通常fieldの上限・型と保護fieldをRulesへ戻すか、通常保存をserver経由へ移す必要がある。

## 確認済み境界

- 通常fieldはdocument単位last-write-winsであり、同じfieldの外部更新を理由に保存を拒否しない。
- Agreementだけは従来の明示的な競合検査を維持する。
- ACTIVEだけを通常編集でき、Customer設定済みSiteを未設定へ戻せない。
- Site schemaはCustomer設定済みSiteを未設定へ戻す操作を拒否し、Customer変更時は参照先Customerを取得する。
- 通常更新で状態・取極めを変更することはRulesが拒否し、各専用入口を使用する。

## 未確認・残余risk

- Dev・Prod、remote data、実browser、利用者環境Localでの見た目・操作感は未確認である。製品変更の最終受入れには、固定commitのDev反映と対象操作のDev確認が別途必要である。
- `local-ui-build`はclean HEADを前提にする別の実行承認境界であり、verification policy上省略可能なため未commit候補では実行していない。SFC compile、source契約、domain、Emulatorで自動確認したが、実browser操作の代替とは扱わない。
- 通常更新はSite modelが表現するdocument全体を保存するため、旧documentの未知fieldや通常画面にないfieldを保持する契約ではない。旧documentで欠けている通常fieldは現行Site modelの値へ収束し得る。data migrationは行っていない。
- applicationを介さない直接requestへの追加対策、archive形式変更、サインアウト／tenant切替時のmodel cleanupは本checkpointへ含めていない。model cleanupは既存のFUT-0005で扱う。
- rollbackは本checkpointのcommitをrevertする。Dev・remoteへ未反映であり、remote data rollbackは不要である。
