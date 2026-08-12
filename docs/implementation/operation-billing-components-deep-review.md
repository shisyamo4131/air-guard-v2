# OperationBilling components deep review

- 状態: 実装調査
- 対象セグメント: SPEC-DEEP-029、SPEC-DEEP-039b — `components/OperationBilling/**` 10 filesと旧root composables
- 最終確認日: 2026-08-12
- 根拠ファイル: `components/OperationBilling/**` 10 files、直接callerの`pages/billings/operations/[id].vue`・`components/OperationBillings/DataTable/index.vue`、直接契約の`useBaseManager`・`MoleculesActivatorCard`・schemas `OperationBilling`/`OperationResult`
- 制約: AirItemManager package内部、runtime/UI、Firestore/Functions実行、Rules再検証は対象外

## 責務・公開契約

| file | props / expose / event | 確認済み責務 |
| --- | --- | --- |
| `Activator/Agreement.vue` | `item: OperationBilling`、`customInput`をexpose | 取極めkey・請求日・非請求alertを表示し、Agreement専用入力componentを公開する。 |
| `Activator/Base/index.vue` | `item: OperationBilling`、`customInput`をexpose | live Site/Customer、日付・勤務区分・時間・人員・備考を表示し、基本入力componentを公開する。 |
| `Activator/Base/BtnToggleLock.vue` | `item: OperationBilling`、`$attrs`をbuttonへ透過 | 現在値に応じたlock/unlockを即時実行する。 |
| `Activator/BillingItems.vue` | propsなし、`customInput`をexpose | original/adjusted請求明細tableと調整入力componentを公開する。 |
| `CustomInput/index.vue` | `componentAttrs` | Site、日付、勤務区分、時刻、休憩、人員、資格要否、作業内容、備考を編集する。 |
| `CustomInput/Agreement.vue` | `componentAttrs`, `item` | Siteの`agreementsV2`から取極めをreturn-objectで選択し、`billingDateAt`も手動編集する。 |
| `CustomInput/Adjust.vue` | `componentAttrs`, `item`, `updateProperties` | `useAdjusted`、基本/資格の数量・残業時間・単価・残業単価を編集し、original値の一括copyを提供する。 |
| `Manager/index.vue` | `doc`, `customInput` | 同一OperationResults documentのupdateだけをAirItemManagerへ委譲し、create/deleteを同期throwで拒否する。 |
| `Table/BillingDetail.vue` | `item: OperationBilling` | `useAdjusted`に応じoriginal/adjustedを選び、基本/資格・通常/残業の数量、単価、金額、合計をreadonly表示する。 |
| `UnbillableIcon.vue` | `message`、`$attrs`をtooltipへ透過 | `isBillable=false`の一覧警告iconを表示する。 |

各componentは独自emitを宣言しない。編集用componentはAirItemManagerから渡される`updateProperties`と`componentAttrs`に保存前draft更新・field状態を委譲し、managerは`item.update()`を呼ぶ。create/delete専用APIは存在しない。

## 取極め・請求日・手動調整

- `Agreement.vue`はSite ID変更をwatchしてSiteを取得し、候補を`cachedSites[siteId].agreementsV2`全件とする。日付・勤務区分filterはなく、承認済みの非制限手動選択方針と一致する。
- `OperationResult.agreement` setterはkeyが変わると`refreshBillingDateAt()`を呼び、`dateAt`と`agreement.cutoffDate`から請求日を更新する。取極めなし、日付なし、不正cutoffではnullになる。請求日は取極めなしでも入力componentから直接設定できる。
- `isBillable`は`billingDateAt != null && customerIdあり`だけで決まり、agreement、正の金額、`useAdjusted`、lockは条件ではない。
- 調整画面は数量と単価の2 tabを持つ。originalからのcopyは数量4 fieldまたは単価4 fieldを一括更新する。残業時間はHourInputを介して分で保存する。
- schemaは数量・単価をnumberとして検査するが、有限値・非負・上限・小数精度を制限しない。残業時間だけ15分倍数も検査するため、負の15分倍数は通る。これはFUT-0034の既存判断事項である。
- `sales`はoriginalとadjustedを常に算出し、`useAdjusted`が表示・`salesAmount`の採用側を切り替える。各通常額と残業額へ`RoundSetting.apply`を個別適用する。component内にtax入力・tax表示はなく、`taxRate`はschema getter、税集約は下流Billing/PDFの責務である。

## 保存・lock・Functions境界

- 詳細pageは同じlive `OperationBilling` instanceを3つのManagerと稼働外売上Managerへ渡す。OperationBillingはOperationResult subclassでcollectionも`OperationResults`のままである。
- Managerのsaveは引数なしの`item.update()`であり、field allowlist、version/precondition、client transactionをcomponent内に持たない。FunctionsのBilling集約はOperationResult update commit後のtriggerで非同期に実行され、画面saveと同一transactionではない。
- `OperationBilling._shouldCheckLock()`はfalseで、lock中も請求担当者によるupdateを許す。これはlockをcontroller側の稼働編集停止とする確認済み方針に一致する。
- `toggleLock()`はlocal `isLocked`を先に反転して同じdocumentをupdateする。buttonはglobal loadingを登録するが、component自身のdisabled latch、確認、失敗rollback/refetch、desired-value/version条件はない。FUT-0050の既存riskを再確認した。
- Agreement/BillingItems/Base component自身にはpermission判定がない。routeは暫定`billings:read`で到達し、server enforcement差はFUT-0031で継続管理する。

## 直接caller・到達性

- `/billings/operations/[id]`はBase、Agreement、BillingItemsをそれぞれ別の`OperationBillingManager` activator slotへ置く。`UnbillableIcon`はOperationBillings一覧tableで`!item.isBillable`時に使われる。
- `OperationBillingManager`は`customInput` propのdefaultとしてBase入力を宣言するが、templateで`AirItemManager`へ`:custom-input="props.customInput"`を渡していない。page側も`custom-input`を指定しない。
- 3 activatorは各専用`customInput`を`defineExpose`するが、Manager側にtemplate ref・expose参照・prop転送がない。比較対象のOperationResult/OperationBillings managersはAir managerへ`custom-input`を明示的に渡す。
- したがって、現行sourceからはBase/Agreement/Adjust専用入力をAirItemManager update dialogへ結ぶ静的経路を確認できない。AirItemManagerの未確認fallbackがschema fieldを生成する可能性は残るが、exposed専用componentの到達性を保証しない。FUT-0174へ登録した。
- 旧`useOperationBillingManager`にはrepo内callerがなく、現行pageは`useDocument`とcomponent managerを使う。未使用/legacy候補であり、lock helperも現在のbuttonからは呼ばれない。

## Loading・error・並行性

- update dialogのclone、validation、submit latch、rollback、error表示はAirItemManager package境界であり、本scopeのsourceだけでは確認できない。`useBaseManager`は単一booleanの`isLoading`とlogger callbackを渡す。
- Managerは同一documentのfull model updateを3 cardから許すが、component自身にversion/preconditionやcard間排他はない。実際のwrite field mask・clone mergeはadapter/AirItemManager未確認のため、lost updateは仮説に留める。
- Site/Agreement取得失敗はcomponent固有のerror/empty表示を持たず、未取得・欠損・失敗を空候補または「読み込み中...」表示から区別できない。
- BillingDetailは表示専用で、tax・稼働外売上を含まない。表示合計はworker売上だけで、document全体の`salesAmount`とは稼働外売上がある場合に一致しない。card見出しは「請求明細」であるため、利用者が総額と誤認する余地はFUT-0174と同じUI結線/表示契約で追跡する。

## Accessibility・test・未使用候補

- lock buttonは文言を持つが即時作用の確認dialogはない。UnbillableIconはtooltipへactivator propsを渡すものの、source上で独立した`aria-label`は宣言しない。
- BillingDetail tableにcaptionはない。Adjustment画面の矢印iconは装飾用途だが`aria-hidden`指定はsourceにない。
- 対象10component名・主要methodを直接検証するrepository testは見つからなかった。
- `Manager.customInput`、3 activatorのexposed `customInput`、`useOperationBillingManager`は現行caller結線上の未使用候補である。削除可否は、custom-input転送修正とAirItemManager fallback確認後に決める。

## 確認済み事実と推測の分離

- 確認済み: Managerに`:custom-input` bindingがない、pageにも指定がない、activator exposeの参照がない、比較managerにはbindingがある。
- 未確認/推測: runtimeでどのinputが実際に開くか、AirItemManagerがschema自動inputへfallbackするか、同時card編集でfull-document lost updateが再現するか。
- 確認済み: lock中OperationBilling updateはschema overrideで許可され、toggle失敗時local rollbackはない。
- 未確認/推測: global overlayが連打を完全に遮断するか、subscriptionが失敗後local stateを自動復元するか。

## 将来要対応・要確認事項

- FUT-0031（暫定read/write境界）、FUT-0034（調整値range）、FUT-0050（lock競合/rollback）へ本segmentのfile-level evidenceを追記した。
- FUT-0174でcustom-input結線、worker-only明細と総額表示の区別、direct component testを追跡する。
- 新規CONFは追加しない。正式permissionはCONF-0019、負数・税・roundingはCONF-0021/0039、invoice-issued後immutableはCONF-0033系の上位判断に統合済みである。

## 未確認範囲

### SPEC-DEEP-039b追加確認

- 旧`useOperationBillingManager`と`useOperationBillingsManager`は静的callerがなく、現行page/component経路から未到達である。前者のtoggleLockはerrorを吸収しlocal rollbackをせず、後者はOperationBilling createを許すattrsと相対`operation-billings/{id}`遷移を持つため、現行model/page contractと一致しない。
- 旧一覧managerの`set`はtruthy stringのsiteIdだけを採用し、null/emptyで既存filterをclearできない。date range変更時は再subscribeするが、permission/network/not-foundを独立表示せずloggerへ委譲する。
- これらは即時削除ではなく、外部/dynamic consumer確認後に現行component managerへ統合または明示deprecated化する候補である。

- AirItemManager/Air input package内部、adapterのupdate field mask、runtime dialog/input、UI/Emulator、Rules enforcement。
- OperationResult/Billing Functions本文、Billing tax/PDF、invoice lifecycleは既存文書を参照し再読していない。
- 実dataにおける負数・0円・大量値、同時tab、network failure、trigger retry。
