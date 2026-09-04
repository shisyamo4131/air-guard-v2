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

- Codex専用local検証はADR 0014のdemo project、loopback、合成data、外部作用denyへ限定する。利用者用`./saved-data`、`.env.local`、Chrome profile、Dev、Prod、remote dataへ許可を広げない。
- Emulator、Functions、server、合成Auth/dataの起動・停止・変更は[local Emulator runbook](../runbooks/local-emulator-testing.md)、UI build・browser・credential・cleanupは[local UI runbook](../runbooks/local-ui-testing.md)を正本とする。Windows Firebase CLIのsandbox外実行も同runbookの限定条件に従う。
- local UIはbuild前の`UI-READY`で、実担当のbrowser接続、合成Auth準備、client側外部endpoint隔離、既存log退避、port・process・cleanup ownerを確認する。満たさなければbuildやprocess起動へ進まない。
- UI受入れは実利用者が行える可視なpointer・keyboard操作だけを証拠とし、DOM・storage・event・client APIの直接変更で代用しない。非UI setupとbackend assertionはUI操作証拠から分ける。
- 既存画面・操作の内部改修は、Codex専用local UI、自動検証、review、後処理が完了すれば利用者local受入れを原則重ねない。新画面・操作、UX判断、利用者data/Chrome、Dev固有条件、外部service、未解決errorは必要な範囲だけ利用者確認を残す。
- 数百件の合成documentは段階投入し、約1000件でEmulator停止を経験したlocal riskを扱う。これはFirebase公式上限ではなく、同規模一括投入には別の停止・復旧計画と承認が必要である。

## Dev・Prod・remote

- Devは利用者と協力会社が使う非本番試行環境である。対象commit、service、data影響、backup、rollback、停止条件、検証を含むbounded Dev release checkpointの承認後だけ、[Dev deploy runbook](../runbooks/dev-deployment.md)内のbuild・deploy・remote検証を実行できる。
- Devの承認を別service・data・期間、新migration、破壊的repair、Prodへ拡張しない。正式運用準備の未完了だけで承認済みDev検証を延期せず、Dev成功をProd・正式運用開始の証拠にしない。
- 未起動serviceからremoteや外部APIへ到達する可能性を確認し、fail-closedにできなければlocal検証を開始しない。実施不能・未実施の確認を成功と記載しない。
- 静的生成・buildは承認済みcheckpointのexact commandだけを実行し、生成物を別releaseへ流用しない。Dev/Prod、migration、maintenance、package公開は[runbook index](../runbooks/README.md)から該当手順を必読とする。
