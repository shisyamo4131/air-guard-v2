# 0028 CCB canonical parity・PrivateSettings backup・SettingAudits restore境界

- 日付: 2026-08-28
- 状態: Superseded
- 置換: [ADR 0031 必要十分なdata境界と変更保護](0031-proportional-data-boundary-and-change-safeguards.md)
- 関連仕様: [Company設定とtenant lifecycle](../specification.md#company設定とtenant-lifecycle)
- 関連判断: [0025 Company Configuration Boundary](0025-company-configuration-boundary.md)、[0026 maintenance静穏化](0026-maintenance-quiescence-and-data-change.md)
- 関連手順: [data migration runbook](../runbooks/data-migrations.md)、[運用・開発手順](../operations.md)
- 関連ロードマップ: [Company設定改修](../roadmaps/company-settings.md)

## 背景

> 2026-08-30: PrivateSettings、SettingAudits、8 target create-only stagingを前提とする本ADRは、CCB設計restartにより置換された。実装済みplanner・backup guard・testを安全に整理するためのrollback inventoryとしてのみ参照する。

CCB stagingはlegacy Company rootから8件の`Settings`・`PrivateSettings`を新規作成する。対象の取り違え、partial setの継ぎ足し、不明値の推測、既存targetの上書きがあると、rootと新設定のどちらが正しいか判断できなくなる。

`PrivateSettings`にはprovider actor、内部理由、operation/error、将来のStripe識別子が入り得るが、現行Admin SDKのlogical backupには機密度、暗号化、IAM、保持、redaction、環境間restoreの契約がない。`SettingAudits`はappend-onlyである一方、現行generic restoreはmerge、update、deleteを実行し得る。

## 決定

### canonical parityとcreate-only staging

- candidate universeは、外部保管する承認済みtarget manifest、Company root、既存CCB target pathのunionとする。会社ID、会社名、個人情報をrepository、標準出力、callbackへ保存しない。
- `editionUnverified`、`rootMissingOrOrphan`、`targetConflict`、`unknownFieldReview`、`invalidSource`、`ambiguousMapping`が1件でもあれば、全tenantのapplyをwrite 0で停止する。
- `alreadyEquivalent`は8 targetがcompleteかつexactで、revision、metadata、source mapping、business valueが一致し、unexpected audit/pathがない場合だけとする。partial setを自動修復しない。
- `eligibleCreate`はroot marker未active、source mappingが決定的、8 targetとauditがすべて不存在の場合だけとする。Schemas packageのpure mappingを使用し、既存root、target、auditのupdate/deleteは行わない。
- dry-runとapplyは同じtype-tagged canonical planを使う。applyはlive stateからplanを再生成して承認済みdigestと一致した場合だけ、tenant単位transactionで8 documentをcreateする。
- 複数tenantは全体atomicではない。途中成功後は作成済みdocumentを削除せず、fresh dry-runで成功tenantを`alreadyEquivalent`、残りを`eligibleCreate`として新しいdigestで再開する。activationは別checkpointとする。

### PrivateSettings backup

- `PrivateSettings`を既存logical backupへ追加せず、そのbackupを完全backupと呼ばない。
- 当面の復旧基盤はproject-level managed Firestore backup/PITRとする。ただしAuthentication、Storage、Stripe等を含む全system復旧を意味しない。
- PrivateSettings単独logical restoreは未提供とする。暗号化logical backupを提供する前に、保存先、暗号化、IAM、保持期間、redaction、環境間restore、復旧演習を別承認する。

### SettingAudits restore

- logical restoreは同一company・同一schema・同一document IDのcreate-onlyに限定する。
- 既存同IDがcanonical同値ならskipし、異値なら全対象をwrite 0で停止する。
- update、delete、clear、generic merge restoreを禁止する。保持期間とlegal holdはproject共通audit方針で別途決める。
- 専用実装と復旧演習が完了するまでは、SettingAudits restoreを利用可能と扱わない。

## 理由

- 不明・不正・部分状態を全体停止へ寄せ、推測によるtenant設定の作成や上書きを防げる。
- 秘密metadataを保護契約のないJSON backupへ混入させず、復旧範囲を過大表示しない。
- auditの災害復旧余地を残しながら、restore名目の改変・削除・重複を防げる。

## 代替案

- partial targetへ不足documentだけを追加する案は、既存targetの由来と整合性を証明できないため採用しない。
- `PrivateSettings`を現行logical backupへそのまま含める案は、暗号化・IAM・保持契約がないため採用しない。
- SettingAudits restoreを全面禁止する案は安全だが災害復旧余地を失うため、専用create-only経路に限定して後続実装する。
- generic restoreを継続する案はappend-only監査と両立しないため採用しない。

## 影響

- 利用者: document確定だけでは画面や実dataは変化しない。将来のmigrationは異常が1件でもあれば全体停止となる。
- data: stagingは新規8 documentのcreateだけで、root、既存target、auditを更新・削除しない。PrivateSettingsとSettingAuditsの復旧可能範囲を明示的に限定する。
- implementation: migration plan/digest、target guard、synthetic test、PrivateSettingsを除外したbackup表示、専用audit restoreが後続実装対象となる。backup表示はverified v1だけ除外を断定し、旧・不正metadataはPrivateSettings含有を`UNVERIFIED`とする。SettingAuditsはまずI/Oを持たないlocal-only pure plannerでscope、snapshot、digest、schema、canonical同値性とcreate候補だけを検証し、artifact真正性・保存・apply・復旧演習は別checkpointとする。
- operations: Dev apply、managed backup確認、復旧演習、Rules receipt、maintenance、remote/data操作はそれぞれ別checkpointと承認を必要とする。
- progress: 契約確定だけではCCB-02の実装・検証完了条件を満たさないため、ロードマップ進捗は10%のままとする。

## 移行とロールバック

まずlocalでpure plan、synthetic fixture、digest、停止code、再実行を検証する。pre-containment Rulesのmachine-verifiable receipt、対象manifest、backup確認、dry-run/apply/post-checkが揃うまでremote stagingを許可しない。

apply前の失敗はwrite 0で停止する。途中成功後は作成済みdocumentを削除せず、fresh planで再開する。activation後のrollbackは旧whole-document writerへ戻さず、Settings対応済みの既知releaseへ戻す。PrivateSettingsまたはSettingAuditsの復旧が必要でも、未提供のlogical restoreを即席で実行せず、managed backup/PITRまたは別承認の専用repairを使用する。

## 再検討条件

正式運用のRPO/RTO、法令・社内規程、Stripe再開、backup保存先、鍵管理、保持期間、legal hold、cross-environment recovery、またはmanaged backup/PITRだけでは満たせない復旧要件が確定した場合に再検討する。
