# Company設定改修ロードマップ

## メタデータ

- 改修コード: CCB（Company Configuration Boundary）
- 状態: In progress（仕様確定・compatible reader・Codex専用migration Emulator経路・pre-containment Rulesをlocal実装済み）
- 現在の進捗: 10%
- 基準日: 2026-08-28
- 調査基準commit: `c8718a82c43a05d3ea70f928747333ef985e77db`
- 文書化基準commit: `919733aea74476b5839d5e3c277d75641e4a5ccb`
- CCB-02静的調査基準commit: `df31d311e9973384cbdb602729c9a8b542b6fc68`
- 親ロードマップ: [AirGuardV2 正式運用準備](airguard-v2.md)
- 現行仕様: [Company設定とtenant lifecycle](../specification.md#company設定とtenant-lifecycle)
- 主要判断: [ADR 0025](../decisions/0025-company-configuration-boundary.md)、[ADR 0026](../decisions/0026-maintenance-quiescence-and-data-change.md)、[ADR 0028](../decisions/0028-ccb-parity-backup-audit-restore.md)
- 実装調査: [Company（自社情報・会社設定）](../implementation/company-settings.md)
- 互換性調査: [CCB-02 Company data・package互換性調査](../implementation/company-configuration-compatibility.md)
- 確認事項: CONF-0074〜CONF-0082は回答済み。CONF-0083〜CONF-0087のStripe詳細は正式release直前まで明示保留。
- CCB-02技術契約: 2026-08-28承認。Company設定専用Callable、schema/marker、pre-containment、create-only staging、旧writer 0件後activation、compatible rollbackを採用する。
- CCB-02 exact schema v1: 2026-08-28承認。Unicode見た目文字数、全field allowlist・型・長さ・enum・相関・default・maskをADR 0025へ固定した。
- CCB-02 local release/parity調査: 2026-08-28完了。Schemas exact `2.4.2-dev.167`は公開・artifact検証済み。Admin SDK、AirGuardV2 app、Functionsは同versionへpin済みで、Admin SDKの旧破壊操作とActive Companyの旧root writeを外部作用前にfail closedとした。client compatible readerは両marker成立後にcomplete 6 Settingsを厳密検証する。Dev 4 tenantは全件migration対象、staging actorとmaintenance conflict停止も確定した。
- CCB-02 parity/backup/restore契約: 2026-08-28承認。異常1件で全tenant write 0、8 target create-only、partial set自動修復禁止、fresh digest再開を採用する。PrivateSettingsは既存logical backupから除外しmanaged backup/PITRを当面の復旧基盤とする。SettingAuditsは同一company/schema/IDのcreate-only、同値skip、異値拒否とし、update/delete/clearを禁止する。pure migration planner・type-tagged digest・合成回帰test、Codex専用合成EmulatorのREST reader・transaction apply・post-check、Admin SDKのINCOMPLETE backup inventory/metadata sidecar、SettingAuditsのlocal-only pure create-planと合成test、pre-containment Rulesのlocal source/Emulator回帰は完了した。Dev reader/apply、audit artifact真正性・apply、deployed Rules receipt、remote staging、復旧演習は未完了。
- 加点方式: マイルストーン単位。部分加点なし。

## 目的

単一Company documentに混在するtenant anchor、会社・請求元情報、運用設定、表示順、maintenance、entitlementを責務別documentと操作へ分離する。後続のCustomer、Site、Employee、Outsourcer、Billingが依存できるactor、validation、revision、snapshot、lifecycleを先に確立する。

このロードマップはCompanyの全CUDを一律Functions化しない。会社管理者設定、日常業務の表示順、server-owned lifecycle・entitlementの性質に合わせてclient Rules、transaction、Callable/operatorを使い分ける。

## 確定した目標境界

| document | 主なfield | 読取 | 更新 |
|---|---|---|---|
| Company root | status、schemaVersion、作成metadata | 同社の有効な本登録Userへ必要最小 | server/provider only |
| `Settings/profile` | 会社名、カナ、住所、電話、FAX | 同社の有効な本登録User | 会社管理者 |
| `Settings/billing` | invoice number、振込先 | 同社の有効な本登録User | 会社管理者 |
| `Settings/operations` | minute、round、week、attendance summary | 同社の有効な本登録User | 会社管理者 |
| `Settings/arrangement` | siteOrder、scheduleOrder | 同社の有効な本登録User | 既存の配置・予定管理actor |
| `Settings/entitlement` | client-safe plan/feature/employeeLimit projection | 同社の有効な本登録User | server/provider only |
| `Settings/maintenance` | client-safe停止状態・理由・時刻projection | 停止案内対象の同社User | server/provider only |
| `PrivateSettings/entitlement` | Stripe/customer ID、provider metadata、内部状態 | client不可 | server/provider only |
| `PrivateSettings/maintenance` | operator、内部operation/error、private metadata | client不可 | server/provider only |
| `SettingAudits/{auditId}` | profile/billing/operationsのmask済み変更履歴 | 会社管理者専用Callableだけ | server only append |

- profile/billing/operationsはrevisionとappend-only auditを持ち、auditは会社管理者だけが専用Callableからmask済みprojectionを閲覧できる。理由入力は必須にしない。arrangementは現在値とrevisionだけを持つ。
- super-userをCompany設定actorに含めず、会社横断処理は個別承認されたprovider/operator手順とする。
- `attendanceManagementMode`は`attendanceSummaryMode`へ改名し、`LABOR_STANDARD`/`OPERATION_COUNT`で画面・navigationだけを切り替える。両projectionは常時生成する。
- round modeはOperationResult作成時、issuer情報は請求確定時にsnapshotする。
- Company既定取極めとCompany geocodingを廃止する。既存値の削除は別migrationとする。
- lifecycleは`ACTIVE`、`SUSPENDED`、`CLOSED`。root物理削除、法的削除、tenant移転は別scopeとする。
- maintenanceはproject-wide quiet procedureとし、CCBはCompany状態・表示の統合だけを担う。
- Stripe再有効化とemployeeLimit強制は正式release直前の別改修へ延期し、CCBはentitlement documentのserver ownershipだけを準備する。
- profile/billing/operations/arrangementは専用Callableから更新し、Settingsのclient CUDを拒否する。siteOrderは`sites:write`、scheduleOrderは`site-operation-schedules:write`をstrict actor条件にする。この判断を他collectionへ一律展開しない。
- `schemaVersion=1`と`configurationState=CCB_V1_ACTIVE`の両方で正本を切り替え、activation前に全旧whole-document writer 0件を確認する。backfillはcomplete Settings setのcreate-only stagingとし、legacy root cleanupは別migrationへ残す。
- legacy attendanceは`ACTUAL_DATE`から`LABOR_STANDARD`、`OPERATION_DATE`から`OPERATION_COUNT`へ写像し、欠損時だけ`LABOR_STANDARD`を補う。未知値はmigration conflictとして停止する。

## 現在実装との差

| 領域 | 現在実装 | 目標との差 |
|---|---|---|
| 保存 | root 1 documentの全体set | 設定document分割、操作別writer、revision、unknown field保護が未実装 |
| actor | 同社有効User全員がroot全field update | 会社管理者・日常業務actor・providerの分離が未実装 |
| read | legacy rootとActive CCBのcompatible readerをlocal実装。Active時は6 Settingsを厳密検証。pre-containmentでは新3 collectionを全client deny | final Rulesによるclient-safe projection開放、Dev deploy receipt・cutover・受入れが未実装 |
| lifecycle | statusなし、client create/deleteだけ拒否済み | ACTIVE/SUSPENDED/CLOSEDとaccess gateが未実装 |
| profile/billing | 長さ・住所editor・invoice/bank validation不一致 | 承認済みvalidation、audit、帳票snapshotが未実装 |
| operations | process-global round、旧attendance enum | snapshot、改名、両projectionの表示切替が未実装 |
| arrangement | 全体set、revisionなし | 専用actor、stale拒否、履歴なし現在値保存が未実装 |
| legacy | agreements/geocodingがrootに残る | caller撤去と別migrationが未実装 |
| maintenance | route redirect中心 | Rules/Callable/scheduled gateとquiet procedureのproduct実装が未完了 |
| Stripe | Functions公開停止、root fieldはclient writable | entitlement隔離未実装。課金本体は意図的に延期 |

## 手戻りを抑える実施順序

```text
CCB-01 confirmed contract
  → CCB-02 data/package compatibility contract
  → CCB-03 root・server-owned containment
  → CCB-04 profile/billing
  → CCB-05 operations・snapshot
  → CCB-06 arrangement・master handoff
  → CCB-07 lifecycle・maintenance integration
  → CCB-08 entitlement isolation
  → CCB-09 migration・回帰・Dev受入れ
```

additive schemas、Admin SDKの旧破壊操作fail-closed、承認済みCCB backup方針を準備し、generic fallbackから新pathを除外するpre-containment Rulesを新documentより先にdeployする。次にlegacy rootを正本としたcompatible Functions/clientとcomplete Settingsのcreate-only stagingを導入する。maintenance cutoverでは最終Rules・Functions・clientを有効化し、client、deploy済みFunctions、operator、Admin SDKを含む旧whole-document writer 0件を確認してからroot activation markerを設定する。旧field cleanupは別migrationとする。関連Schemas/Admin SDK repository変更は対象、互換性、公開・導入順、rollbackを示して別承認を得る。

## マイルストーン

| マイルストーン | 重み | 得点 | 状態 | 完了条件 |
|---|---:|---:|---|---|
| CCB-01 確認済み仕様・判断基準線 | 10 | 10 | Completed | actor、document分割、validation、revision/audit、snapshot、勤怠、廃止field、lifecycle、maintenance、Stripe延期を質疑で承認し、仕様、ADR、CONF/FUT、roadmap、runbook、manualへ反映してvalidatorを通す。 |
| CCB-02 data・field・package互換契約 | 10 | 0 | In progress | Dev fixtureと全Company callerを再照合し、root・各Settingsのexact schema、default、unknown/legacy field、Schemas/client/Functions/Admin SDKのrelease順、dual-read期間、migration mappingを検証する。Schemas公開、3 consumerのexact導入、Admin SDK安全停止、client compatible reader、canonical parity・backup coverage・SettingAudits restore契約、pure migration/audit planと合成回帰、Codex専用REST create-only transaction/post-check、pre-containment Rules local回帰は完了した。Dev reader/apply、audit artifact/apply、deployed Rules receipt、Callable・staging検証が残る。 |
| CCB-03 root・server-owned containment | 20 | 0 | Not started | root create/delete拒否を維持し、client-safe entitlement/maintenance projectionとPrivateSettingsを分離してclient writeを拒否する。共通tenant/actor/revision/audit境界、会社管理者専用audit readerと陰性testを実装し、旧client互換中もserver fieldを失わない。 |
| CCB-04 profile・billing | 10 | 0 | Not started | 操作別保存、承認済みgrapheme長・kana結合濁点・invoice・bank validation、完全住所editor、全User read/管理者write、masked auditを実装する。合成済み/結合表現、結合濁点単独拒否、長値PDF renderとissuer snapshot schemaを検証し、snapshot writeをBillingへ引き渡す。 |
| CCB-05 operations・履歴再現性 | 15 | 0 | Not started | minute/round/week/attendanceSummaryModeを操作別保存へ移し、enum・範囲、即時表示、account切替reset、両勤怠projection、OperationResult round snapshot、既存data不変を検証する。 |
| CCB-06 arrangement・master接点 | 10 | 0 | Not started | agreements/geocoding callerを撤去し、site/schedule orderを既存業務permission、revision、1 reorder 1 save、新規ID末尾補完、archive・削除済みIDの無視・次回保存時除去へ移す。Customer既定取極めと後続masterの共通actor/validation/競合契約を引き渡す。 |
| CCB-07 tenant lifecycle・maintenance統合 | 10 | 0 | Not started | ACTIVE/SUSPENDED/CLOSED、停止案内、通常read/write/Callable拒否、provider restore、root欠損・orphan検出を実装する。project-wide Rules/Callable/scheduled maintenance gate、unknown fail-closed、quiet runbookを検証する。 |
| CCB-08 entitlement隔離・外部連携延期境界 | 10 | 0 | Not started | subscription/feature/employeeLimitをserver-owned documentへ隔離し、client最小projectionとdisabled UIを検証する。Stripe本体を再有効化せず、正式release直前の別roadmapへ未決仕様を引き渡す。 |
| CCB-09 migration・回帰・Dev受入れ | 5 | 0 | Not started | dry-run、backup、rollback、quiet period、旧新compatibilityを固定し、local自動test、Emulator、PDF render、fixed-commit build、bounded Dev release、管理者・一般User・業務actor・providerの受入れ、旧全体writer 0件を確認する。 |
| **合計** | **100** | **10** |  |  |

## 必須検証matrix

- actor: 会社管理者、配置・予定permission actor、権限なしUser、super-user、provider operator、無効User、他tenant、未認証。
- read: profile/billingの同社read、entitlement/maintenanceのclient-safe projection、PrivateSettingsの全client拒否、auditの会社管理者Callableだけ、一般User・super-user・他tenant・未認証拒否、bank before/after mask。
- write: exact field、required/optional、型・長さ・enum・相関、server-owned混入、unknown field、stale revision、同時tab、旧client、Functions競合。
- lifecycle: ACTIVE/SUSPENDED/CLOSED、restore、CLOSED誤操作incident、root欠損、orphan、claim不一致、maintenance unknown。
- downstream: draft/final invoice、issuer snapshot、長値render、OperationResult round snapshot、両attendance projection、calendar、site/schedule order。
- migration: edition、legacy enum/field、agreements/location、dry-run digest、create-only backfill、再実行、部分失敗、derived data、rollback、Rules切替順。

各validator、test、build、migration check、Dev検証はcommand、result、独立exit statusを記録する。画面非表示だけを認可証拠にしない。

## 停止・rollback条件

- Devのcurrent edition、schema、unknown field、実callerが基準線と異なる。
- 旧全体writerがserver-owned fieldを失わせる、または互換readerが旧新dataを決定的に合成できない。
- stale saveが拒否されず別設定を上書きする。
- Company変更が既存OperationResult、Billing、確定帳票、勤怠projectionを意図せず再計算する。
- migration digest、対象company、field、write件数、quiet状態、snapshotがcheckpointと一致しない。
- SUSPENDED/CLOSED/maintenance中に通常business処理が通る。

停止時はmaintenanceを維持し、既知の互換releaseへ戻す。新setting document、legacy field、root/subcollectionを推測削除しない。apply後はsnapshotと前後digestからexact corrective releaseまたは別repairを組み立てる。

## 後続master CRUDへの引渡し

- Customer・Outsourcer: tenant actor確認、操作別field allowlist、revisionによるstale拒否、必要なaudit、archive/lifecycleを機能単位で選ぶ。
- Site: Customer既定取極め、Company arrangement order、終了・再有効化、参照切れを接続する。
- Employee: attendanceSummaryModeの表示契約だけを受け、給与用勤務回数詳細とentitlement実強制は各後続改修で完成させる。
- Billing: issuer snapshot schemaとround snapshotを受け、draft・確定・取消・訂正・再発行のwrite lifecycleを完成させる。

Company全完了を待たず、各引渡し契約が実装・検証された時点で対応masterを開始できる。CUD一律Functions化や全collection共通auditは前提にしない。

## 進捗履歴

| 日付 | 進捗 | 変化 | 理由と証拠 |
|---|---:|---:|---|
| 2026-08-27 | 0% | 基準線 | client、server、Rules/security、下流依存の4系統を独立調査し、影響範囲、判断ゲート、実施順、検証・rollback条件を設定した。 |
| 2026-08-28 | 10% | +10 | Company document分割、actor、validation、revision/audit、snapshot、attendanceSummaryMode、廃止field、lifecycle、project-wide maintenance、Stripe延期を質疑で承認し、仕様・ADR 0025/0026・runbook・台帳・manualへ反映した。application実装・test・migration・Dev受入れは未着手のためCCB-01だけを加点した。 |
| 2026-08-28 | 10% | ±0 | CCB-02のclient、Functions/Admin SDK、Rules/fixture、packageを4系統で再調査した。generic Rules fallback、新server fieldを落とす旧whole-document writer、Admin SDK backup欠落、package version差を確認し、release順と技術契約候補を記録した。利用者確認とDev実data照合が未完了のため加点しない。 |
| 2026-08-28 | 10% | ±0 | CCB-02のCompany設定専用Callable、exact schema共通規則、enum mapping、pre-containment、create-only staging、activation marker、旧writer 0件gate、compatible rollbackを利用者が承認した。Dev read-only preflightはFirebase CLI credential失効でdatabase API到達前に停止し、Firestore document read 0、data write 0だった。Dev edition・data-shape未確認のため加点しない。 |
| 2026-08-28 | 10% | ±0 | Firebase CLI再認証後の`CCB-02-DEV-SHAPE-001`で、Dev `(default)`がStandard/Native、Company root 4件が同一38-field shape、schema/activation未設定、旧enum全件`ACTUAL_DATE`、unknown field 0、CCB target document 0であることを値・IDなしの集計とdigestで確認した。Functions 36件は全ACTIVE、CCB Callable未deploy、operator toolは旧schema・新path未対応だった。4 rootの用途・migration対象性、exact Settings schema、canonical parity plan、package release契約が残るため加点しない。 |
| 2026-08-28 | 10% | ±0 | CCB exact schema v1として、利用者の見た目に一致するUnicode Extended Grapheme Cluster文字数、`minuteInterval`の5分単位、root・Settings・PrivateSettings・audit・Callableの全allowlist、型、長さ、enum、相関、default、maskを承認・文書化した。application、Rules、package、migration parityは未実装のため加点しない。 |
| 2026-08-28 | 10% | ±0 | schemas、Admin SDK、AirGuardV2 migration/Rules/fixtureを3系統でread-only再調査し、additive package surface、無検査publish blocker、危険な旧backup/restore/delete、consumer release順、値を出さないcanonical parity digestとcreate-only再実行契約案を記録した。cross-repository変更、Dev tenant分類、実装・testは未承認・未実施のため加点しない。 |
| 2026-08-28 | 10% | ±0 | Schemas契約を別projectの既存task `PM（Schemas）-02`へ移管し、承認済みDev read-only分類でCompany root 4件中、合成test 2件・要確認2件を識別情報非出力で確認した。remote write 0。残る用途、migration include/exclude、Schemas/Admin/Application実装が未完了のため加点しない。 |
| 2026-08-28 | 10% | ±0 | 利用者が残る2 tenantを利用者会社1件・試用中の別会社1件と確認し、合成test 2件を含む4件すべてをmigration対象とした。staging actorはservice account匿名ID、maintenance中の決定不能値はconflict停止と確定。Schemas S1/S2 local実装を別project taskへ承認したが、package完了、Admin/Application実装、Dev applyは未完了のため加点しない。 |
| 2026-08-28 | 10% | ±0 | Schemas S1/S2 commit `ebfc173`をreviewし、旧空口座defaultとactivation root既知extrasの不足を検出、corrective `53fb53d`で補正した。Schemas Node 24とcoordinator Node 22でCCB 11/11、role preset 6/6、public self-import・root非公開を確認し、2 commit一体でlocal contractを受入れた。package公開・consumer導入・CCB-02完了gateは未完了のため加点しない。 |
| 2026-08-28 | 10% | ±0 | Schemas S3 commit `78bb1f4`をreviewし、version `2.4.2-dev.167`、全10 test fileのfail-closed inventory、tag/version/export/package-content/public-import guard、Node 22/24 test後のTrusted Publishing workflowを受入れた。coordinator再検証の`npm test`と実release guardもexit 0。tag・push・公開・fresh install・consumer導入は未実施でCCB-02完了gateを満たさないため加点しない。 |
| 2026-08-28 | 10% | ±0 | Schemasの旧project-rule記述をrecovery `bb23909`で修正し、新coordinatorの変更なし再開後にexact `2.4.2-dev.167`を公開した。Node 22/24 workflow、registry metadata、LF clean treeとの84-file byte一致、fresh install、CCB 27 exports・root非公開・peer importを確認。Windows packとの差は改行/toolchain環境差でsource/runtime/API差0だった。consumer導入・Admin SDK・parity migrationが未完了のため加点しない。 |
| 2026-08-28 | 10% | ±0 | Admin SDK commit `c95660d`でSchemasをexact `.167`へpinし、CCB root marker・新3 collection・backup payloadを検査するfail-closed guardを追加した。旧backup/snapshot/diff/restore、Company delete、legacy maintenanceはAuth/Firestore/storage write前に停止し、Node 22/24専用17件と既存9件が成功した。CCB backup本体、AirGuardV2 app/Functions導入、canonical parity、Rules・migrationが未完了のため加点しない。 |
| 2026-08-28 | 10% | ±0 | AirGuardV2 app/FunctionsをSchemas exact `.167`へ揃え、client compatible readerをlocal実装した。両marker成立前はlegacy、成立後はroot projectionと6 Settingsを厳密検証し、欠損・invalidはmaintenance側へfail closed、Active/error時の旧root全体更新はFirestore前に拒否する。対象test 8件は成功した。canonical parity、backup/audit restore、Rules・Callable・Dev stagingが未完了のためCCB-02は加点しない。 |
| 2026-08-28 | 10% | ±0 | 利用者がcanonical parity、PrivateSettings backup、SettingAudits restoreの3契約を承認した。異常1件で全体停止する8 target create-only staging、PrivateSettingsの既存logical backup除外とmanaged backup/PITR依存、auditの同一ID create-only・同値skip・異値拒否をADR 0028へ確定した。application、migration、Rules、remote staging、復旧演習が未実装のためCCB-02は加点しない。 |
| 2026-08-28 | 10% | ±0 | CCB local-only pure migration planner、Firestore REST Valueのtype-tagged canonical digest、合成fixture、23件の回帰testを実装した。Schemas exact `.167` mappingを使い、8 target create-only、complete exact、partial/不一致/unknown/invalid/ambiguous/orphan/edition未確認の全体停止、manifest/environment/full snapshot digest binding、UTF-8 byte順、primary分類と全finding保持、per-subject非出力、fresh re-planを確認した。Firestore reader/apply、Rules、backup/audit restore、Dev stagingが残るため、部分加点なしのCCB-02は未完了とする。 |
| 2026-08-28 | 10% | ±0 | Codex専用合成Emulatorへexact project/loopback/external-effects/credential target guard、公開REST reader、tenant単位read-write transaction、8 create-only、fresh post-checkを追加した。domain 34件と専用Emulator 1件で2 tenant・16 create、root不変、audit 0、update/delete 0、再dry-run全件equivalent、利用者saved-data・専用seed不変を確認した。Dev reader/apply、deployed Rules receipt、backup/audit restore、remote stagingが残るため、部分加点なしのCCB-02は未完了とする。 |
| 2026-08-28 | 10% | ±0 | SettingAuditsのlocal-only pure restore plannerを追加し、同一project/database/company/schema/ID、manifest/artifact digest、manifest全IDの同一snapshot present/absent観測、Schemas exact `.167`、strict Firestore wire形式とcanonical round-tripを満たす場合だけ`exists=false` createを計画し、同値skip・観測欠落・異値または不正1件で全体write 0とする20件の合成testを実装した。artifact真正性・保存・暗号化/IAM/保持、apply、復旧演習が残りoperational restoreは利用不可のため、部分加点なしのCCB-02は未完了とする。 |
| 2026-08-28 | 10% | ±0 | Admin SDKの新規legacy backupを固定16 collectionの`INCOMPLETE` v1とし、verified v1だけPrivateSettings除外、旧・不正metadataは含有`UNVERIFIED`、PrivateSettings/SettingAudits restoreとCCB backup/restoreは`UNAVAILABLE`と一覧表示する。local一覧は厳密なPID/UUID lock・generation ID・temp publishを使う`.metadata` sidecarだけを読み、payloadを開かない18件のtestを実装した。active lockを拒否し、妥当なownerの死亡済みorphanだけを新規UUIDの隔離pathへ限定回収する。暗号化logical backup、restore、実artifact検証、復旧演習が残るためCCB-02は未完了とする。 |
| 2026-08-28 | 10% | ±0 | pre-containment Firestore Rulesのlocal prototypeを追加し、`Settings`、`PrivateSettings`、`SettingAudits`をgeneric fallbackから除外して全client actorへ再帰deny、legacy rootのreserved field保護、CCB v1 active rootのclient update停止を実装した。静的契約4件、専用Firestore Emulator 8件、既存Firestore Rules回帰37件が成功し、全CRUD、list/collection-group、nested/orphan、legacy patch互換、partial reserved rootでのwhole-document replacement拒否、利用者saved-data・専用seed不変を確認した。remote deployとdeployed Rules receipt、Dev stagingが残るためCCB-02は加点しない。 |
