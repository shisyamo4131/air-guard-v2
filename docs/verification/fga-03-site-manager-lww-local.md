# FGA-03 Site Manager・document LWW Local検証記録

## 対象

- Checkpoint: `FGA-03-SITE-MANAGER-LWW-05`
- 実施日: 2026-09-11
- Repository: `C:\Users\seven\projects\AirGuard\air-guard-v2`
- Branch: `codex/fga-03-site-normal-auth`
- 基準HEAD: `104914e3dff08da26732b78f7097c907ab830b6b`
- 証拠状態: 基準HEADからの未commit Local候補を検証済み。Dev・Prod反映、remote product受入れは未実施

## 確認した変更

- Siteの通常CREATE・UPDATEを単数`SiteManager`と複数形`SitesManager`からSite modelの標準`create`／`update`へ直接接続した。一覧の行選択は複数形Managerの`beforeEdit`から詳細へ遷移し、一覧dialogを開かない。
- 詳細の基本情報・Customer変更を単数`SiteManager`へ接続し、旧専用作成dialog、基本情報editor、Customer editorを削除した。
- listener由来のSite instanceをManagerへ直接渡し、編集中も受信した最新document全体でdraftを置き換える。通常保存は競合拒否を設けず、後から保存した通常field全体を正本とする。
- 作成用CustomInputはremote mainの履歴で確認した3ステップ方式とし、取引先名検索、既存Customerの任意選択、現場情報入力を順に行う。候補がない場合や選択しない場合も、入力した取引先名で仮登録できる。
- 通常保存用の`useSiteActions`、専用writer、埋込みCustomerのexact 6-field要件を撤去した。通常createとCustomer変更時のCustomer取得、validation、会社prefix、metadata、transaction保存はSite schemaと標準adapterへ委ねる。
- 終了、再有効化、archiveは従来の専用UI・Callable／transactionを維持した。取極めは詳細画面内の専用UIを維持しつつ、保存をSite modelの通常`update()`へ統一した。直接deleteは引き続き拒否する。
- Rulesは通常updateで`status`だけを保護し、`agreementsV2`を通常Site更新として許可する形へ訂正した。専用`updateSiteAgreements` Callableとそのserver contractをsourceから削除した。schema、package、既存data、migrationは変更していない。

## Local検証

| Gate | Command | 結果 | Exit status |
|---|---|---|---:|
| targeted-domain | `node --test --test-reporter=spec test/domain/site-operations.test.mjs test/domain/site-agreement-contract.test.mjs test/domain/site-ui-source-contract.test.mjs test/domain/site-authorization.test.mjs test/domain/firestore-rules-reservation-source-contract.test.mjs test/domain/codex-functions-entrypoint.test.mjs test/domain/callable-auth-identity-integration.test.mjs` | 34件成功 | 0 |
| domain-full | `node --test test/domain/*.test.mjs` | 1,546件成功 | 0 |
| local-emulator-site-agreement | `pwsh -NoProfile -File scripts/run-codex-local-test.ps1 -Mode Test -TestNamePattern "Site Agreement"` | 1件成功。通常Site更新のlast-write-winsと既存OperationResult snapshot不変を確認 | 0 |
| local-emulator-site-customer | `pwsh -NoProfile -File scripts/run-codex-local-test.ps1 -Mode Test -TestNamePattern "Sites Customer reference matrix"` | 1件成功。Customer参照を変えない取極め通常更新を確認 | 0 |
| local-emulator-suite | `npm run test:local` | 182件成功。専用demo project・loopbackだけを使用し、保存済み利用者dataは変更なし | 0 |
| project-docs | `pwsh -NoProfile -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` | 296 Markdown、69 ADR、12 roadmap、8 TOMLを検証して成功 | 0 |
| diff-check | `git diff --check` | whitespace errorなし。Gitの既定改行変換警告だけを確認 | 0 |

`local-ui-build`はverification policy上省略可能であり、未commit候補にclean HEADを要求するため省略した。画面componentのcompileはdomain test、保存境界はEmulatorで確認した。実browser確認の代替とは扱わない。

## Rules安全確認

- 評価: 4 / 5。tenant、本人確認、有効User、作成時のACTIVE、Customer参照、状態変更、client delete、archiveへのclient書込み拒否は維持されている。取極めを通常Site更新へ統合してもtenant越境や権限昇格を許可する変更はない。
- 承認済みの残余risk: 同一tenantの認証済み本登録Userがapplicationを介さず直接requestを組み立てた場合、通常fieldと`agreementsV2`の型・長さ・値をRulesだけでは防がない。本checkpointの脅威モデルではapplicationを介さない操作を想定せず、追加対策を行わない。
- 将来、application外のrequestも対象にする場合は、通常fieldと`agreementsV2`の上限・型をRulesへ戻すか、通常保存をserver経由へ移す必要がある。

## 確認済み境界

- 通常fieldはdocument単位last-write-winsであり、同じfieldの外部更新を理由に保存を拒否しない。
- Agreementも通常fieldと同じdocument単位last-write-winsとし、baseline比較、競合拒否、競合通知、再読込要求を設けない。
- ACTIVEだけを通常編集でき、Customer設定済みSiteを未設定へ戻せない。
- Site schemaはCustomer設定済みSiteを未設定へ戻す操作を拒否し、Customer変更時は参照先Customerを取得する。
- 通常更新で状態を変更することはRulesが拒否する。取極めは通常Site更新として許可する。

## 未確認・残余risk

- Dev・Prod、remote data、実browser、利用者環境Localでの見た目・操作感は未確認である。製品変更の最終受入れには、固定commitのDev反映と対象操作のDev確認が別途必要である。
- `local-ui-build`はclean HEADを前提にする別の実行承認境界であり、verification policy上省略可能なため未commit候補では実行していない。SFC compile、source契約、domain、Emulatorで自動確認したが、実browser操作の代替とは扱わない。
- 通常更新はSite modelが表現するdocument全体を保存するため、旧documentの未知fieldや通常画面にないfieldを保持する契約ではない。旧documentで欠けている通常fieldは現行Site modelの値へ収束し得る。data migrationは行っていない。
- applicationを介さない直接requestへの追加対策、archive形式変更、サインアウト／tenant切替時のmodel cleanupは本checkpointへ含めていない。model cleanupは既存のFUT-0005で扱う。
- rollbackは本checkpointのcommitをrevertする。Dev・remoteへ未反映であり、remote data rollbackは不要である。

## 2026-09-11 取極めUI・保存境界補正

- 補正開始HEAD: `968543a4754619281e6c113ebfb7f201bf317251`
- remote履歴で確認した構成に合わせ、Site詳細へ取極め一覧と追加・編集・複製buttonを直接表示する形へ戻した。取極め一覧全体を開くための重複した編集dialogは撤去し、選択した1件だけを従来の入力dialogで扱う。
- 取極めも通常Site更新のlast-write-winsでよいという利用者判断により、`useSiteActions`、専用`updateSiteAgreements` Callable、baseline比較、同一field競合を撤去した。listener由来Siteへ編集後の`agreementsV2`を重ね、Site modelの通常`update()`で保存する。0円確認、値・重複検査、失敗後の入力保持、同一操作の二重送信防止、既存OperationResult snapshot不変は維持する。
- Rulesは`agreementsV2`の変更を通常Site updateで許可し、`status`の保護を維持する。専用Callableのclient entrypoint、Functions export、server module、transport contractをsourceから削除した。
- 最新候補は対象domain 34件、全domain 1,546件、取極めEmulator 1件、Site Customer参照Emulator 1件、Emulator全体182件が成功した。以前の18件・1,549件の結果は保存境界変更前の履歴証拠であり、最新候補の完了根拠には使用しない。
- Dev・Prod、remote data、実browser、利用者環境Localは未変更・未確認である。`local-ui-build`は未commit候補にclean HEADを要求する省略可能gateのため実行していない。
- rollbackは本補正commitをrevertする。data migrationや既存documentの復元は不要である。Devへ反映する場合はHosting・Rulesの更新に加え、既存の`updateSiteAgreements` Function削除が外部変更になるため、actual target確認と別承認を要する。
