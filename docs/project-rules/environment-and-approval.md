# Environment and approval rules

- 状態: Active
- 役割: 承認、環境、外部作用、local検証、releaseに関するAirGuardV2固有規則
- 入口: [project rules index](../../governance/project-rules.md)

## 承認と保護対象

- 質問、比較、検討、診断、途中確認、完了報告を、code・仕様変更、merge、push、deployの承認とみなさない。重要仕様の変更前に現行規則、変更案、理由、影響、互換性、移行、rollback、確認方法を示す。
- `main`操作、push、history rewrite、Prod deploy、npm公開、実dataの作成・更新・削除、data migration、外部service変更は個別の明示指示を必要とする。破壊操作前に対象環境・data・復旧方法を確認する。
- `.env`値、秘密鍵、token、Firebase Admin資格情報、Stripe/Webhook secret、実在の個人・顧客・勤怠・請求dataを文書、prompt、log、応答へ転記しない。
- `air-firebase-v2`、client/server adapter、`air-guard-v2-schemas`、`air-guard-v2-admin-sdk`は必要範囲をread-only調査できるが、変更は別承認とする。`air-vuetify-v3`はrepository内file参照packageとして利用箇所と境界を確認する。
- 関連repositoryを変更する前に、対象、必要性、影響するconsumer、互換性、公開・導入順序、代替案を示し、まずAirGuardV2内だけで解決できないか確認してから別承認を得る。
- critical identifierは当該turnにactual targetまたはtask-routed正本から確認する。Schemas consumer更新は[package release](../runbooks/package-release.md)のPreAdoption/PostAdoptionを使い、network未承認時はremote freshnessを未確認として残す。
- `npm audit fix`と`npm audit fix --force`を無条件に実行しない。package・lock・root/Functions双方の互換性を先に確認する。

## Local Emulatorとlocal UI

- 本projectの開発・local検証の実行者は利用者とCodexだけである。Dev環境では利用者以外による試用・検証があり得るが、Codex専用Localまたは利用者環境Localのprocess・log・data ownershipへ持ち込まない。
- `Codex専用Local`は、Codexが専用demo project、専用port、`.codex-test/saved-data`、generated server、Codex管理browserを起動・操作・終了する隔離環境を指す。`利用者環境Local`は、利用者が`.env.local`、`./saved-data`、Chrome profile、利用者起動processを管理する環境を指す。両者を同じ検証環境、session、credential、cleanup対象として扱わない。
- Codex専用Localと利用者環境Localは、Dev反映前に問題を発見して手戻りを抑えるための任意の検証であり、製品変更の最終受入れまたは完了証拠にはしない。製品挙動を変える変更は、固定commitをDevへ反映し、対象範囲のDev受入れが成功した時点を最終受入れとする。文書・governance・testだけの変更、Codex専用local toolだけの変更など、Devの製品挙動を変えない変更にはDev受入れを要求しない。
- 環境検証は次表の保証範囲から選ぶ。実行した環境数を品質指標にせず、今回必要な証明事項を直接覆う最小の環境集合を使う。

| 環境 | 主目的 | その環境で保証する範囲 | 保証しない範囲 |
|---|---|---|---|
| Codex専用Local | UI・application統合の早期確認 | 専用build、合成data、専用Emulator、主要UI経路、保存・再表示、外部作用deny | Dev設定、deploy済みartifact、実Dev data・権限・外部service、利用者Chrome固有条件 |
| 利用者環境Local | 利用者固有条件とUXの早期確認 | 利用者Chrome・profile、`.env.local`、local表示、利用者環境固有の再現、Dev前に必要なUX判断 | deploy済みartifact、Dev Functions・Rules・Indexes・remote data・外部service |
| Dev | 製品変更の最終受入れ | 固定commitのdeploy済みartifact、対象service・Dev設定、remote認証・通信・権限・対象dataとの結合 | Prod固有状態、未確認の画面・actor・data、全利用者・全dataへの一般化 |

- 自動testまたは静的検査が今回の証明事項を直接覆う場合、同じ事項のためにCodex専用Localと利用者環境Localを追加しない。両Localが同じ事項を証明する場合は、Codexが再現・完結できるCodex専用Localを優先する。
- 利用者環境Localは、利用者Chrome・profile・表示環境、`.env.local`、利用者環境固有の再現、またはDev反映前の利用者によるUX判断が手戻りを実質的に抑えられる場合だけ選ぶ。両Localを行う場合は、開始前に各環境で別々に証明する事項を明示する。
- 関連する変更はreview可能で境界の明確な単位へまとめ、Dev受入れを微小な編集ごとに繰り返さない。Devで不具合が判明した場合は、原因と再現条件に対応するLocalだけへ戻り、両Localを自動的に再実行しない。
- Local検証の実行要否と既存証拠の再利用は[Documentation and verification rules](documentation-and-verification.md#verification)を正とする。追加実行が必要な場合も、既に起動しているEmulator、local server、ChromeまたはCodex管理browserが対象HEAD・設定・実行経路・権限・tenant・隔離・data・test条件とowner/cleanup境界を満たすなら再利用し、同一条件の停止・再起動、build、別suite起動を前提にしない。条件を確認できない、失効している、または新しい経路を証明する必要がある部分だけを新規に準備する。
- Codex専用local検証はADR 0014のdemo project、loopback、合成data、外部作用denyへ限定する。利用者用`./saved-data`、`.env.local`、Chrome profile、Dev、Prod、remote dataへ許可を広げない。
- Codex専用LocalのEmulator、Functions、server、合成Auth/dataの起動・停止・変更は[local Emulator runbook](../runbooks/local-emulator-testing.md)、UI build・Codex管理browser・credential・cleanupは[Codex専用local UI runbook](../runbooks/local-ui-testing.md)を正本とする。利用者環境Localは[利用者環境local UI runbook](../runbooks/user-local-ui-testing.md)を正本とする。Windows Firebase CLIのsandbox外実行はCodex専用runbookの限定条件に従う。
- Codex専用local UIはbuild前の`UI-READY`で、実担当のbrowser接続、合成Auth準備、client側外部endpoint隔離、port・process・cleanup ownerを確認する。Firebase Emulatorのroot debug logは一時診断情報として実行ごとの上書きを許容し、退避・復元対象にしない。満たさなければbuildやprocess起動へ進まない。
- UI受入れは実利用者が行える可視なpointer・keyboard操作だけを証拠とし、DOM・storage・event・client APIの直接変更で代用しない。非UI setupとbackend assertionはUI操作証拠から分ける。
- 既存画面の機能改修では、表示文言、Chip、icon、色、余白、配置、列、button、並び順、dialogを含む見た目を原則として維持する。見た目の変更が必要な場合は、実装前に理由、変更前後、影響、代替案を利用者へ提示して明示的な判断を得る。未承認の見た目差分は機能改善として受け入れず、回帰として是正または承認待ちにする。
- 既存画面・操作の内部改修は、自動検証で残るUI・application統合の不確実性がある場合だけCodex専用Localを選び、同じ事項の利用者環境Localを重ねない。新画面・操作やUX判断でも、利用者環境Localは上記の利用者固有条件またはDev前判断が必要な範囲に限る。Dev固有条件、外部service、remote dataはDevで確認する。
- 数百件の合成documentは段階投入し、約1000件でEmulator停止を経験したlocal riskを扱う。これはFirebase公式上限ではなく、同規模一括投入には別の停止・復旧計画と承認が必要である。

## Dev・Prod・remote

- Devは利用者と協力会社が使う非本番試行環境である。対象commit、service、data影響、backup、rollback、停止条件、検証を含むbounded Dev release checkpointの承認後だけ、[Dev deploy runbook](../runbooks/dev-deployment.md)内のbuild・deploy・remote検証を実行できる。
- Devの承認を別service・data・期間、新migration、破壊的repair、Prodへ拡張しない。正式運用準備の未完了だけで承認済みDev検証を延期せず、Dev成功をProd・正式運用開始の証拠にしない。
- 未起動serviceからremoteや外部APIへ到達する可能性を確認し、fail-closedにできなければlocal検証を開始しない。実施不能・未実施の確認を成功と記載しない。
- 静的生成・buildは承認済みcheckpointのexact commandだけを実行し、生成物を別releaseへ流用しない。Dev/Prod、migration、maintenance、package公開は[runbook index](../runbooks/README.md)から該当手順を必読とする。
