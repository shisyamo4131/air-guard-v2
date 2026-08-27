# Company設定改修ロードマップ

## メタデータ

- 状態: Planned（計画済み・未着手）
- 現在の進捗: 0%
- 基準日: 2026-08-27
- 調査基準commit: `c8718a82c43a05d3ea70f928747333ef985e77db`
- 親ロードマップ: [AirGuardV2 正式運用準備](airguard-v2.md)
- 実装調査: [Company（自社情報・会社設定）](../implementation/company-settings.md)
- 確認事項: [未決定事項台帳](../implementation/pending-confirmations.md) の CONF-0074〜CONF-0087、CONF-0111、CONF-0115、CONF-0129、CONF-0134
- 加点方式: マイルストーン単位。部分加点なし。

## 目的

Company root documentをtenant anchorとして維持しながら、会社設定を機能単位の安全な操作へ分解する。画面上の入口だけでなく、actor、field ownership、validation、同時更新、監査、履歴再現性、外部連携、移行と復旧を一貫させる。

このロードマップは「Companyの全CUDを一律にFunctionsへ移す」ことを前提にしない。単純なreadや安全なfield更新はClientを選択できるが、server-owned field、複数document整合、外部作用、秘密性、履歴再現性が必要な操作は専用server境界を候補とし、機能ごとに決定する。

## 対象範囲

### 対象

- `Companies/{companyId}`のschema、Rules、client store・plugin・設定画面・更新経路
- 初期Company作成、root欠損時のsession挙動、停止・修復・decommission境界
- 会社基本情報、住所、連絡先、適格請求書番号、振込先
- `minuteInterval`、`roundSetting`、`firstDayOfWeek`、`attendanceManagementMode`
- `agreementsV2`、`siteOrder`、`scheduleOrder`
- `maintenance*`、`stripeCustomerId`、`subscription`、geocoding
- Company設定を参照する請求・PDF/CSV・税計算・勤怠・配置・予定・認証初期化・管理運用
- 互換移行、Rules切替、Emulator回帰、Dev受入れ、rollback

関連Schemas packageまたは別repositoryのAdmin SDK変更が必要な場合は、このrepositoryの承認を流用せず、対象repository、release順、後方互換性、rollbackを提示して別途承認を得る。

### 対象外

- Customer、Site、Employee、Outsourcer等のmaster CRUDそのものの全面改修
- StripeのProd有効化、tenantの実削除、実data repair、Prod migration・deploy
- Company設定と無関係な全collectionの共通CRUD基盤化

ただし、後続master CRUDで手戻りを起こさないため、Siteの取極め・表示順、Employeeの勤怠方式・利用人数、請求先snapshotなど、Companyとの接点は本ロードマップで契約を固定する。

## 確認済みの現在状態

| 領域 | 主なfield・経路 | 主な利用先 | 現在の問題 |
|---|---|---|---|
| tenant anchor・初期作成 | Company doc ID、Auth claim、User.companyId、`createAdminAccount` | 認証初期化、全subcollection path | Company/User transactionとAuth claimが非atomic。root欠損時も子documentが残り得る。一般clientのroot create/deleteは拒否済みだが、運用停止・修復は未確定。 |
| 会社・請求元情報 | 会社名、住所、電話、invoiceNumber、振込先 | Company設定、請求PDF・帳票 | 同一tenantの有効な本登録User全員がrootをread/update可能。過去帳票はlive Company値で再生成され、当時値を再現できない。画面の住所編集fieldも不完全。 |
| 運用既定値 | minuteInterval、roundSetting、firstDayOfWeek、attendanceManagementMode | time picker、process-global丸め、OperationResult CSV、請求・税、calendar、勤怠data経路 | UI属性以外の強制validationがなく、変更の発効時点・既存dataへの作用・rollbackが未定。丸めは請求・税・帳票・CSVの再現性へ影響する。 |
| 取極め・表示順 | agreementsV2、siteOrder、scheduleOrder | Company設定、配置、予定 | Company既定取極めの実consumerを確認できずmanual記述と不一致。表示順更新に専用permission・revision・参照整合性がない。 |
| maintenance | maintenanceMode、reason、時刻・actor | client middleware、Admin運用 | UI redirectであり排他lockではない。server writeを停止せず、field名にもclient schemaとAdmin SDKの不一致がある。root全体更新で上書きされ得る。 |
| Stripe・利用制限 | stripeCustomerId、subscription、employeeLimit、StripeData | checkout表示、webhook、Employee数表示 | hiddenでもclient read/update可能。Functions exportは停止中だが、再有効化前にprice/origin、冪等性、event順序、tenant mapping、人数制限のserver強制が必要。 |
| 位置情報 | 住所、location/geopoint、geocoding Callable | Company直接consumerは未確認。geocoding保存経路のみ確認 | geocode失敗でもlocationをnullにして保存を継続し得る。現在公開中のCallableに認証、App Check、rate/input制限がない。 |
| 保存方式 | `Company.update()`、Firestore adapterのdocument全体set | 設定、取極め、表示順、外部同期 | revision・preconditionなし。古い画面が別機能の更新を上書きでき、schemaが知らないserver fieldを消す可能性がある。 |

## 最優先の横断リスク

1. **actor不一致**: `/settings/company`は会社管理者・super-user向けだが、Rulesは同一tenantの有効な本登録User全員へ全field updateを許可する。
2. **field ownership混在**: 利用者編集field、運用field、server-owned field、外部連携fieldが同じdocumentにあり、readの秘密性とwrite制御を分離できない。
3. **全体保存競合**: 設定、取極め、並び順、maintenance、Stripeが互いのfieldを失わせ得る。field制限だけを先に厳格化すると既存の全体保存が失敗するため、操作別writeを先に互換導入する必要がある。
4. **履歴再現性**: 会社情報と丸め方式をlive参照する帳票・計算は、設定変更後に過去結果が変わり得る。
5. **運用境界の過大評価**: maintenanceは利用者画面の抑止であり、排他lock、server停止、drain、backup/restore lockではない。

## 実装前の判断ゲート

次を一つの巨大判断にせず、該当マイルストーンの実装前に確定する。確定前は現行挙動を実装事実として扱い、仕様へ昇格しない。

1. 会社管理者、strict role permission、super-user support procedureのread/write actor matrix。銀行・請求・subscription等を全Userへ読ませるかも決める。
2. root documentに残すtenant anchor fieldと、機能別subdocumentまたはserver projectionへ分離するfield。
3. 各既存`Company.update()` callerを対応する業務操作へ割り当て、操作別allowlist、型・長さ・enum・相関・正規化、state transition、snapshot、参照整合、未知field、既存legacy値の扱いを決める。
4. revision/precondition、監査対象、競合時の拒否・再読込・merge方針。
5. 会社・請求元情報、丸め、勤怠方式の発効時点と、請求・勤怠・帳票へ保存するsnapshot。
6. Company既定取極めを実際にSiteへ継承するか、未使用機能として廃止するか。表示順の参照切れ修復方法。
7. maintenanceを通知、書込gate、drain、migration/restore lockのどこまで担わせるか。
8. Stripeを再有効化する条件、price/origin allowlist、event ledger、人数制限、解約・reconcile。
9. legacy Company documentの互換期間、migration、dry-run、停止条件、rollback。

## 手戻りを抑える実施順序

```text
現状fixture・全業務操作の契約確定
  → field ownershipとpackage/client/functions契約の一致
  → server-owned field containmentと共通mutation基盤
  → 各業務単位で操作別writeへ移行し全体保存を撤去
  → 対応する制限的Rulesへ段階切替
  → 請求・勤怠・取極め・表示順の下流契約へ引渡し
  → maintenance・外部連携・修復
  → migration、Dev受入れ、旧経路撤去
```

releaseでは、互換API、必要なmigration、client、制限的Rules、remote検証の順を固定する。先にRulesだけを狭めて現行clientを停止させない。server-owned fieldを分離するまでは、Company全体setを新規追加しない。

## マイルストーン

| マイルストーン | 重み | 得点 | 状態 | 完了条件 |
|---|---:|---:|---|---|
| COM-01 現状証拠・判断基準線 | 10 | 0 | Not started | actor/field/consumer/writer matrix、全`Company.update()` callerと業務操作の対応、state・snapshot・参照整合、代表Dev fixture、CONF依存、互換・rollback方針を利用者承認済み仕様へ反映する。 |
| COM-02 data・field・package契約 | 10 | 0 | Not started | Company fieldをtenant anchor、利用者設定、運用、server-owned、snapshotへ分類し、Schemas package・client・Functions・Admin SDKの名前、default、validationを一致させる。未知fieldを失わない移行策を検証する。 |
| COM-03 server-owned containmentとmutation基盤 | 20 | 0 | Not started | root create/delete拒否を維持し、server-owned fieldをclient差分から保護する。共通actor・tenant・field diff・current state・precondition・audit境界を用意するが、未確定の業務semanticsを仮API化しない。同社一般User、管理者、permission actor、super-user、他社、無効Userの陰性testを通す。 |
| COM-04 会社・請求元情報 | 10 | 0 | Not started | 承認済み操作契約に基づいて対象の全体setを撤去し、住所editor、invoiceNumber正規化、口座情報の閲覧・編集actor、現在公開中のgeocodingの認証・abuse防止・失敗動作を実装・検証する。Company側はissuer snapshot schema・source・revision・互換契約を確定し、実際のsnapshot writeは請求確定・訂正・取消・再発行lifecycleの承認済み実装へ引き渡す。 |
| COM-05 運用既定値と履歴再現性 | 15 | 0 | Not started | 承認済み操作契約に基づいて対象の全体setを撤去し、minuteInterval、roundSetting、firstDayOfWeek、attendanceManagementModeのvalidation、発効時点、既存data、計算・勤怠・帳票snapshot、変更監査、rollbackを検証する。process-global設定のaccount切替・未設定時resetも確認する。 |
| COM-06 取極め・表示順とmaster接点 | 10 | 0 | Not started | Company既定取極めの採否、Siteへの継承、siteOrder/scheduleOrderのpermission・参照整合性・競合処理を先に確定してから、対象の全体setを撤去する。後続Site/master CRUDが依存できる契約とtestを残す。 |
| COM-07 tenant anchor・maintenance | 10 | 0 | Not started | root欠損・claim失敗・orphan子dataの検知と修復、停止/decommission境界を定める。maintenanceの通知とserver write gate等を分離し、field名、actor、開始・解除・失敗時復旧を検証する。 |
| COM-08 外部連携・利用制限・復旧境界 | 10 | 0 | Not started | Stripeを再有効化できるserver-owned subscription契約、冪等性、allowlist、event順序、reconcileと、Employee側が利用するentitlement projection・上限判定interface・競合契約を設計・検証する。Employee作成時の実強制は後続Employee master roadmapへ引き渡す。正式backup scopeの不足を別運用課題へ接続する。 |
| COM-09 migration・回帰・Dev受入れ | 5 | 0 | Not started | dry-run、backup、rollback、停止条件を固定し、local自動test、Emulator、固定commit build、bounded Dev release、管理者と非管理者のUI受入れ、remote陰性検証を完了する。旧全体保存経路0件を確認する。 |
| **合計** | **100** | **0** |  |  |

## 必須検証matrix

- actor: 会社管理者、権限preset、権限なしUser、super-user、無効User、他tenant、未認証。
- write: 許可fieldだけ、server-owned field混入、未知field、必須field欠損、enum/範囲、stale revision、同時tab、Functions/webhook競合。
- read: 銀行・請求・Stripe・maintenance fieldの必要最小開示。Firestore Rulesでfield非表示にできない制約も含める。
- 下流: 請求確定・再生成、PDF/CSV、税・丸め、勤怠方式切替、calendar、配置・予定順、取極め継承。
- lifecycle: 初期作成のclaim失敗、root欠損、orphan、停止、maintenance中write、解除失敗、repair再実行。
- 外部: geocodingの未認証・他tenant・過長入力・rate/App Check・provider失敗・privacy log、Stripe重複event・順不同event・不正price/origin・entitlement競合。Employee作成時の上限未満・到達・並行作成・既存超過・trial/grace/expiredは後続Employee側testへ引き渡す。
- migration: legacy値、field名不一致、dry-run digest、再実行、部分失敗、rollback、Rules切替順。

各test、validator、build、migration check、Dev検証はcommand、結果、独立exit statusを記録する。画面非表示だけを認可証拠にしない。

## 停止・rollback条件

- 現在のCompany documentにschemaで復元できないfield、型、field名差異が見つかった。
- client、Functions、Admin SDKのいずれかが旧全体保存を続け、server-owned field消失を防げない。
- 請求・勤怠・配置・予定の既存結果が設定変更で意図せず変わる。
- migration digest、対象会社、対象field、write件数が承認済みcheckpointと一致しない。
- maintenance解除、root/session復旧、Stripe reconcile、Rules rollbackのいずれかを実証できない。
- actor matrixに未決定の経路があるままwrite権限を拡張する必要が生じた。

停止時は新旧経路を混在させず、直前の互換releaseへ戻す。migrationはcreate-onlyまたはbefore snapshotから復元可能なfield単位を優先し、rootやsubcollectionの推測削除は行わない。

## 後続master CRUDへの引渡し条件

Company改修の全完了を待たず、次の契約が確定・検証された時点で対応するmaster機能を並行計画できる。

- Customer・Outsourcer: tenant actor matrix、共通validation、監査・競合の採否。
- Site: Company既定取極め、siteOrder、終了・再有効化時の参照整合性。
- Employee: attendanceManagementMode、subscription entitlement・employeeLimit判定interface、User lifecycleとの境界。Employee作成時の上限強制と競合testはEmployee側で完成させる。
- 請求・transaction系: issuer snapshot schema・source・revision、roundSettingの発効・履歴再現性。snapshot書込時点はdraft・確定・取消・訂正・再発行を含むBilling lifecycle側で完成させる。

master CRUDの実装順は、Company側の依存契約と各masterの参照関係を確認した別ロードマップで確定する。この文書だけで一律Client CUDまたは一律Functions CUDを決定しない。

## 進捗履歴

| 日付 | 進捗 | 変化 | 理由と証拠 |
|---|---:|---:|---|
| 2026-08-27 | 0% | 基準線 | client、server、Rules/security、下流依存の4系統を独立調査し、影響範囲、判断ゲート、実施順、検証・rollback条件を設定した。実装・仕様決定・test・Dev受入れは未着手のため得点0とした。 |
