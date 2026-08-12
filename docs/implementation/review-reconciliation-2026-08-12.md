# 2026-08-12 ソースレビュー統合記録

- 状態: 調査証拠の台帳統合
- 最終確認日: 2026-08-12
- 対象: アプリ基盤、認証・認可、Cloud Functions、schema、共通UI package、Admin SDK
- 制約: 静的source reviewのみ。runtime、Emulator、browser、remote deployment、外部service、実data、secretは未確認である。

この文書は確認済み仕様の正本ではない。2026-08-12までに完了したread-only checkpointを、既存FUT/CONF、coverage、roadmapへ重複なく反映するための横断証拠である。仕様と承認済みADRに反する現行挙動は、実装事実として記録しても正式要件へ昇格しない。

## 調査範囲とcoverage

主repoの531-file deep-review母数では、schema `src` 75 files、components 46 files、root composables 18 files、application composables 12 files、auth/domain/transforms composables 8 files、data layer 26 files、fetch/overlay/storage 11 files、PDF/utils/service 13 filesを追加でAへ昇格した。外部packageであるAirVuetifyとAdmin SDK、ならびにadapter packageの調査は重要な境界証拠だが、531 filesへは加算しない。

| 指標 | 変更前 | 変更後 | 備考 |
| --- | ---: | ---: | --- |
| A Deep-reviewed | 310 | 519 | schema `src` 75 files、components 46 files、root/application/auth/domain/transforms/data layer/fetch/overlay/storage/PDF/utils/service 134 filesを昇格 |
| B Flow-reviewed | 43 | 0 | 全対象をAへ昇格 |
| C Mapped-only | 166 | 0 | 全対象をAへ昇格 |
| D Generated/config/test/asset | 11 | 11 | 変更なし |
| E External boundary | 1 | 1 | 変更なし |
| 残B/C | 209 | 0 | 残0 execution checkpoints |

別packageでは、AirFirebase base/adapters 6 paths、schema runtime 76 paths、AirVuetify runtime 43 paths、Admin SDK runtime 14 pathsを排他的に調査した。これらは主repoの公式source母数とは別に保持する。

## 確認済みの重要問題

### 認証・認可・テナント分離

- temporary invitationはmailbox所有確認前に通常clientからaccount setupでき、token email一致だけでは第三者取得を防げない。
- tenant配下の偽造User document IDをglobal Auth UIDとして扱うtrigger chainがあり、他tenant Authの更新・disable・削除へ到達し得る。
- disable/enable callable、履歴全再構築callable、未認証の事前登録照会にactor・tenant・情報最小化の不足がある。
- Firestore Rulesは同一tenant内のCompany、Users、OperationResults等を広く書込み可能にし、locked OperationResultやserver-owned fieldを保護しない。
- SecurityReport Storageはobject pathが分かる任意authenticated userによる他tenant objectのread/create/update/deleteを許す。folder listの実際の挙動は未検証である。
- `admin_users`はauthenticated userへglobal read/writeを許すが、用途、実data、callerは確認できず、影響評価が未完了である。
- FcmTokenはdocument ID、token、uid、companyId、既存ownerの結合が不足し、logout/token rotation時のcleanupもない。

### データ整合性・請求・派生同期

- FireModelのcreate/updateはfull-document set/upsertで、create-must-not-exist、update-must-exist、merge mask、revision preconditionがない。未知fieldと同時更新を失い得る。
- hidden/readOnlyはUI metadataで、enumerableな派生値も保存される。type、enum、nested valueのvalidationは限定的である。
- OperationResult lockは現在値をfalseへ変えるとmodel guardを回避でき、Rules/direct writeも拒否しない。これは仕様とADR 0003に反する。
- agreementなしresultの理由・許可flagがなく、billing eligibilityがagreementの妥当性を要求しない。site変更時に同じagreement keyだと以前のsite単価を保持し得る。
- Billing同一keyの通常追加・更新・削除はtransactionalでなく、確定・支払済み状態もFunctions/Rulesに強制されない。請求書はimmutable artifactでなく、masterの現在値とsnapshotを混在させる。
- OperationResult同期はBilling、DailyAttendance、DailyOperationByEmployee、SiteEmployeeHistoryを順に処理し、後段失敗時に前段だけが残る。event ledger、全体reconcile、順序逆転防止がない。
- 非請求result削除はBilling key生成で失敗して後続cleanupを止め得る。独立cleanup triggerはprojection syncとの順序がなく、scheduleをphysical deleteして通知cleanupを迂回し得る。
- Functionsではtenant RoundSettingを初期化せず、DailyOperationは`Math.round`を使うため、client・server・履歴再計算の金額が一致しない可能性がある。

### lifecycle・UI・入力

- Siteは既存customerIdから別customerIdへ変更でき、現行仕様の変更禁止と衝突する。
- Employee退職処理がUser削除を介してAuth削除へ結合し、退職とAuthentication削除を分離する現行仕様と衝突する。
- Air managerのfunction-valued `disableSubmit`引数がcaller契約と異なり、locked OperationResultの標準submit UIを止めない。disableUpdate/disableDeleteはerror記録後もcallbackを続行する。
- managerはsubmit single-flight、final-step validation、live更新とのdraft conflict、canonical server result取込みを保証しない。
- TextField debounce、Autocomplete、郵便番号lookupにはlatest-request/flush/cancel契約がなく、古い結果や未反映入力を保存し得る。
- TimePickerInputのdisabled/readonly/rules等はinputでなくdialogへ流れ、date-time controlにはinvalid/null/timezone/seconds contractがない。
- 共通UI packageには自動testがなく、icon操作、required表示、dialog、loadingのaccessibility完了証拠もない。

### 通知・運用・復旧

- ArrangementNotificationの実日付計算、休憩初期値、timestamp field、状態遷移に不整合がある。通知生成・配送はevent replayで重複し得る。
- FCM送信結果のlogにraw tokenが含まれる経路がある。
- Admin SDKのbackupは固定一階層catalogと一部Authだけで、nested collection、Storage、Rules/index/config、完全なAuth状態を含まない。consistent point-in-time snapshotでもない。
- backup artifactと復旧時temporary passwordは平文で、version、checksum、complete marker、暗号化、retentionがない。
- Admin CLI/libraryのenvironment、output、restore引数契約が実装と一致せず、operator identity、target tenant、artifact integrity、二者承認、durable audit、rollback/resumeを強制しない。
- Admin migrationはRulesとlockを迂回してOperationResultを更新できるが、承認済み例外、migration ledger、reconcile gateがない。

## 台帳への整理

既存原因は既存FUTへ統合し、新しい独立原因だけFUT-0177〜FUT-0183へ追加した。新しいCONFは作らず、判断は既存canonical groupへ統合する。

| 領域 | 主なFUT |
| --- | --- |
| 認証・actor・tenant・列挙 | FUT-0080〜0084、FUT-0151、FUT-0165、FUT-0177 |
| locked result・請求・派生同期 | FUT-0029〜0031、FUT-0045〜0052、FUT-0153、FUT-0160 |
| Storage・通知・token | FUT-0008〜0012、FUT-0018〜0027、FUT-0105〜0109 |
| schema/base/adapter | FUT-0144〜0146、FUT-0166、FUT-0179、FUT-0180 |
| UI manager/control | FUT-0113〜0117、FUT-0136〜0139、FUT-0167、FUT-0181、FUT-0182 |
| Admin backup/operator/migration | FUT-0147〜0150、FUT-0153、FUT-0163、FUT-0183 |
| plugin/bootstrap | FUT-0003、FUT-0004、FUT-0096、FUT-0178 |

## 要判断事項の優先グループ

| 優先 | 判断テーマ | canonical CONF | 判断しない間の扱い |
| ---: | --- | --- | --- |
| 1 | 正式role、permission、special role、Callable actor/tenant | CONF-0111、CONF-0129 | 現行UI/claimを正式認可とみなさず、Rules/Functionsをfail-safeに扱う |
| 2 | invitation/account setup、mailbox確認、User/Auth identity | CONF-0067、CONF-0113 | verified emailまたは一回限りinvite proofなしの強い操作を承認しない |
| 3 | Billing発行後の変更、lock解除、訂正・取消 | CONF-0033ほか保留中のBilling群 | 仕様/ADRのlocked拒否を優先し、Admin例外を暗黙承認しない |
| 4 | backup scope、RPO/RTO、restore semantics、実行権限 | CONF-0124〜CONF-0127 | 現行artifactを完全backupやproduction-ready復旧と呼ばない |
| 5 | archive/retention/privacy/log | CONF-0115、CONF-0123、CONF-0126 | 平文credentialやraw token/個人data logを安全とみなさない |
| 6 | retry、event reconciliation、SLO、manual replay | CONF-0130 | 部分成功を完了とみなさず、再構築結果を監査不能のまま確定しない |
| 7 | UI error/loading、edit conflict、date/time入力 | CONF-0114、CONF-0116、CONF-0138 | UI無効化・validationをauthorizationや永続化保証とみなさない |

## 未確認範囲

- remote/deployed Rules、Functions、IAM、App Check、package version、実data shapeと既存不整合件数。
- EmulatorでのRules、transaction retry/order、trigger replay、500件境界、Storage list semantics。
- browserでのNuxt/Vuetify挙動、mobile、keyboard、screen reader、FCM、postal/geocoding、PDF/CSV render。
- production backup/restore drill、RPO/RTO、法的保持期間、Stripe本番運用。
- dependency vulnerability、build、application test、real service side effect。
