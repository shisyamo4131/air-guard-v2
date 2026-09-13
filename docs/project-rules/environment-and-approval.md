# Environment and approval rules

- 状態: Active
- 役割: 承認、環境、外部作用、local検証、releaseに関するAirGuardV2固有規則
- 入口: [project rules index](../../governance/project-rules.md)

## 承認と保護対象

- 質問、比較、検討、診断、途中確認、完了報告を、code・仕様変更、merge、push、deployの承認とみなさない。重要仕様の変更前に現行規則、変更案、理由、影響、互換性、移行、rollback、確認方法を示す。
- `main`操作、push、history rewrite、Prod deploy、npm公開、実dataの作成・更新・削除、data migration、外部service変更は個別の明示指示を必要とする。`main`へのpush承認は、承認対象commitについてGitHub Actionsが変更fileから選んだserviceをDevへ自動deployする承認を含む。手動実行、再実行、対象serviceの上書き、IAM・credential変更、migration、repair、Prodは含まず、別の明示指示を必要とする。破壊操作前に対象環境・data・復旧方法を確認する。
- `.env`値、秘密鍵、token、Firebase Admin資格情報、Stripe/Webhook secret、実在の個人・顧客・勤怠・請求dataを文書、prompt、log、応答へ転記しない。
- `air-firebase-v2`、client/server adapter、`air-guard-v2-schemas`、`air-guard-v2-admin-sdk`は必要範囲をread-only調査できるが、変更は別承認とする。`air-vuetify-v3`はrepository内file参照packageとして利用箇所と境界を確認する。
- 関連repositoryを変更する前に、対象、必要性、影響するconsumer、互換性、公開・導入順序、代替案を示し、まずAirGuardV2内だけで解決できないか確認してから別承認を得る。
- critical identifierは当該turnにactual targetまたはtask-routed正本から確認する。Schemas consumer更新は[package release](../runbooks/package-release.md)のPreAdoption/PostAdoptionを使い、network未承認時はremote freshnessを未確認として残す。
- `npm audit fix`と`npm audit fix --force`を無条件に実行しない。package・lock・root/Functions双方の互換性を先に確認する。

## Local Emulatorとlocal UI

- 開発・Local検証の実行者は利用者とCodexだけとする。Devの他の試用者をLocalのprocess・log・data所有者として扱わない。
- `Codex専用Local`は、Codexが専用demo project、専用port、`.codex-test/saved-data`、generated server、Codex管理browserを起動・操作・終了する隔離環境を指す。`利用者環境Local`は、利用者が`.env.local`、`./saved-data`、Chrome profile、利用者起動processを管理する環境を指す。両者を同じ検証環境、session、credential、cleanup対象として扱わない。
- 両LocalはDev前の手戻り抑制用の任意検証であり、製品変更の最終受入れ・完了証拠にしない。製品変更は固定commitのDev反映と対象範囲のDev受入れ成功を最終受入れとする。文書・governance・test・専用local toolだけなど、Devの製品挙動を変えない変更はDev受入れ対象外。
- 環境検証は次表の保証範囲から選ぶ。実行した環境数を品質指標にせず、今回必要な証明事項を直接覆う最小の環境集合を使う。

| 環境 | 主目的 | その環境で保証する範囲 | 保証しない範囲 |
|---|---|---|---|
| Codex専用Local | UI・application統合の早期確認 | 専用build、合成data、専用Emulator、主要UI経路、保存・再表示、外部作用deny | Dev設定、deploy済みartifact、実Dev data・権限・外部service、利用者Chrome固有条件 |
| 利用者環境Local | 利用者固有条件とUXの早期確認 | 利用者Chrome・profile、`.env.local`、local表示、利用者環境固有の再現、Dev前に必要なUX判断 | deploy済みartifact、Dev Functions・Rules・Indexes・remote data・外部service |
| Dev | 製品変更の最終受入れ | 固定commitのdeploy済みartifact、対象service・Dev設定、remote認証・通信・権限・対象dataとの結合 | Prod固有状態、未確認の画面・actor・data、全利用者・全dataへの一般化 |

### 環境の選択と再利用

- 自動testまたは静的検査が今回の証明事項を直接覆う場合、同じ事項のためにCodex専用Localと利用者環境Localを追加しない。既存画面の内部改修は自動検証で残るUI・application統合の不確実性がある場合だけCodex専用Localを選ぶ。両Localが同じ事項を証明する場合は、Codexが再現・完結できるCodex専用Localを優先し、同じ事項の利用者環境Localを重ねない。
- 利用者環境Localは、利用者Chrome・profile・表示環境、`.env.local`、利用者環境固有の再現、またはDev反映前の利用者によるUX判断が手戻りを実質的に抑えられる場合だけ選ぶ。新画面・操作も同じ条件で選び、両Localを行う場合は各環境で別々に証明する事項を開始前に明示する。Dev固有条件・外部service・remote dataはDevで確認する。
- 関連する変更はreview可能で境界の明確な単位へまとめ、Dev受入れを微小な編集ごとに繰り返さない。Devで不具合が判明した場合は、原因と再現条件に対応するLocalだけへ戻り、両Localを自動的に再実行しない。
- 実行要否と証拠の再利用は[検証規則](documentation-and-verification.md#verification)を正とする。起動済みEmulator・server・Chrome・Codex管理browserは、対象HEAD・設定・実行経路・権限・tenant・隔離・data・test・owner/cleanup条件が一致すれば再利用する。同一条件の停止・再起動・build・別suite起動を前提にせず、確認不能・失効・新規経路の部分だけ準備する。

### 実行と保護の境界

- Codex専用local検証はADR 0014のdemo project、loopback、合成data、外部作用denyへ限定する。利用者用`./saved-data`、`.env.local`、Chrome profile、Dev、Prod、remote dataへ許可を広げない。未起動serviceからremoteや外部APIへ到達する可能性も確認し、fail-closedにできなければ開始しない。実施不能・未実施の確認を成功と記載しない。
- 実行手順は、Emulator・Functions・server・合成Auth/dataの起動・停止・変更を[local Emulator](../runbooks/local-emulator-testing.md)、UI build・browser・credential・cleanupを[Codex専用UI](../runbooks/local-ui-testing.md)、利用者環境を[利用者Local](../runbooks/user-local-ui-testing.md)へ分ける。Windows Firebase CLIのsandbox外実行も専用runbookの限定条件に従う。
- Codex専用local UIのbuild・起動前は[UI-READY](../runbooks/local-ui-testing.md#ui-ready-preflight)を必須とする。browser・合成Auth・外部endpoint隔離・ownerの条件を満たさなければ起動しない。debug logの上書き・退避・復元は同節を正とする。
- UI受入れは実利用者が行える可視なpointer・keyboard操作だけを証拠とし、DOM・storage・event・client APIの直接変更で代用しない。非UI setupとbackend assertionはUI操作証拠から分ける。
- 既存画面の機能改修では、表示文言、Chip、icon、色、余白、配置、列、button、並び順、dialogを含む見た目を原則として維持する。見た目の変更が必要な場合は、実装前に理由、変更前後、影響、代替案を利用者へ提示して明示的な判断を得る。未承認の見た目差分は機能改善として受け入れず、回帰として是正または承認待ちにする。
- 数百件の合成documentは段階投入し、約1000件でEmulator停止を経験したlocal riskを扱う。これはFirebase公式上限ではなく、同規模一括投入には別の停止・復旧計画と承認が必要である。

## Dev・Prod・remote

- Devは利用者と協力会社が使う非本番試行環境である。[承認と保護対象](#承認と保護対象)の標準main pushをbounded Dev release checkpointとし、data影響、backup、rollback、停止条件、remote検証をpush前に確定する。手動・標準経路外のreleaseはcommitとserviceを明示した別承認を必要とする。実行手順は[Dev deploy runbook](../runbooks/dev-deployment.md)を正とする。
- Devの承認を別service・data・期間、新migration、破壊的repair、Prodへ拡張しない。正式運用準備の未完了だけで承認済みDev検証を延期せず、Dev成功をProd・正式運用開始の証拠にしない。
- 静的生成・buildは承認済みcheckpointのexact commandだけを実行し、生成物を別releaseへ流用しない。Dev/Prod、migration、maintenance、package公開は[runbook index](../runbooks/README.md)から該当手順を必読とする。
