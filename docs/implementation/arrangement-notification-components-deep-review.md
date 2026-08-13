# ArrangementNotification components deep review

## メタデータ

- 状態: 実装調査（file本文deep review）
- 対象checkpoint: SPEC-DEEP-014
- 最終確認日: 2026-08-11
- 対象: `components/ArrangementNotification/**`、`components/ArrangementNotifications/**`、`components/ArrangementNotificationStatus/**` のexact 10 files
- 境界: 直接schema、status enum、`useBaseManager`、3つの直接callerだけを照合した。AirItem/ArrayManager内部、Rules実行、Functions、runtime/UIは未確認。

## file別公開契約

| file | props / emits / responsibility | mutation・side effect | validation・error・到達性 |
| --- | --- | --- | --- |
| `ArrangementNotificationStatus/ChipGroup/index.vue` | `chipProps`とattrsを受け、全4 statusの選択chipを表示。emitなし。 | 親v-modelを`v-chip-group` attrsへ透過。 | status候補を常に全表示する。permission/loading/errorは親責務。 |
| `ArrangementNotification/TransitionBtn/index.vue` | `type` (`next`/`prev`)とnotificationを受けるbutton wrapper。 | なし。 | 不明status/targetなしはdisabled。ただし呼出しはnextのみで、loading/actor制限は受けない。 |
| `ArrangementNotifications/Manager/index.vue` | `modelValue`配列を日付・勤務区分でcopy-sortし、従業員向け順方向遷移とARRIVED時の下番入力を提供。 | before editでscheduleをfetch。next methodを`item.clone()`で実行し、下番だけ別managerの編集済itemへ`toLeaved()`。 | local/global loadingは設定するがtemplateの遷移buttonへdisabled/loadingを結線しない。失敗はloggerへ渡すだけで利用者向けerror/retryなし。dashboardが`auth.employeeId`だけを表示条件にこのmanagerを呼ぶ。 |
| `ArrangementNotification/ListItem/index.vue` | notificationと表示flagを受け、日時・現場・status/messageを表示。 | propからlocal `ArrangementNotification`へinitialize。 | siteはcache参照だけで自身はfetchしない。cache未準備時はloading文字列、日時欠損時は現在時刻を表示するため欠損を隠す。 |
| `ArrangementNotification/ListItem/useMessage.js` | notification statusからtext/icon/colorを返すpure composable。 | なし。 | unknown statusをerror messageへ正規化する。 |
| `ArrangementNotification/Status/Chip.vue` | required statusをchip表示。 | なし。 | unknownをgrey/`N/A`に正規化する。 |
| `ArrangementNotification/Chip/index.vue` | optional ArrangementNotificationをchip表示。未指定なら仮配置を表示。 | なし。 | notificationがある未知statusではdefinition undefinedをspread後に`.title`参照しthrowし得る。 |
| `ArrangementNotification/Manager/index.vue` | `doc`、`customInput`、`includesStatus`を受ける管理側AirItemManager wrapper。create/deleteを禁止し`toCreate`/`toUpdate`/`toDelete`をexpose。 | 編集後の選択statusで`toArranged`/`toConfirmed`/`toArrived`/`toLeaved`を呼ぶ。 | component内actor/tenant/transition-origin/field allowlistなし。全status選択により任意遷移へ到達し、custom inputで資格/OJTを同一保存に含める。 |
| `ArrangementNotification/Manager/toLeaved.vue` | required `siteOperationScheduleId`を受ける下番input wrapper。 | actual start/end、翌日、breakを編集するAirItemManager。 | `siteOperationScheduleId`はtemplate/scriptで未使用。input validation/loading/errorは基底managerへ委譲。 |
| `ArrangementNotification/CustomInput/index.vue` | `componentAttrs`、`includesStatus`、notification itemを受け、管理用詳細・status・actual time・qualification/OJTを表示・結線。 | item changeごとにsite/employee/outsourcer fetchを開始。LEAVED時だけactual fields、常時資格/OJTをmodelへ結線。 | fetch失敗/取消/競合を扱わない。statusをARRANGED/CONFIRMED/ARRIVEDへ変更するとschema transitionがactual値を予定値/60分へ上書きする説明はない。 |

## 状態・時刻・通知の境界

- 従業員表示はenumのnextだけを示すが、管理用managerは選択statusをそのまま専用methodへdispatchする。上下番確定callerは編集開始時に`LEAVED`を代入して`toLeaved()`へ到達する。これらは承認済みの主体別境界をUIだけでは強制しない。
- `toArranged`、`toConfirmed`、`toArrived`はactual start/endを予定値、actual breakを60分へ書き戻す。`toLeaved`入力はinstance propertyを直接編集し、宣言済み`timeOptions`は使わない。
- UI components自体は通知送信を呼ばない。ArrangementNotification status更新後の通知生成・配送はtrigger側境界であり、componentはstatus updateのcommit成功後に起こる通知失敗を表示・rollbackしない。
- いずれのcomponentもtransaction、server idempotency key、append-only history、actor/before-after auditを持たない。

## caller・permission・accessibility

- dashboardは`auth.employeeId`がtruthyなら従業員managerを表示するが、対象notificationの本人性はcomponentで再検証しない。
- 配置管理`Arrangements/Manager`はgeneric managerをrefで使用し、上下番確定`OperationResult/Generator/Detail`も同managerへLEAVEDを強制して渡す。真正な認可は上位page/Rules/serverに依存する。
- アイコン/状態のVuetify既定accessibility以外に、transition confirmation、status上書き・fixed 60 breakの説明、失敗後focus、row-only lockの実装はない。

## 矛盾・未使用候補

- `ArrangementNotificationChip`だけが未知statusを安全に扱わず、同系のListItem/StatusChipと契約が異なる。
- `Manager.toLeaved`の`siteOperationScheduleId`、TransitionBtnの`prev`、schema `toLeaved`の`timeOptions`は確認したcallerで未使用。
- generic managerはcreate/delete禁止としつつ、外部ref向け`toCreate`/`toDelete`を公開する。確認したcallerは`toUpdate`のみだが、外部利用を静的に否定できない。
- `ListItem`はsite cache未準備と日時field欠損をplaceholder/現在時刻として表示し、データ欠損とloadingを区別しない。

## 将来要対応・要確認

- FUT-0018、FUT-0021、FUT-0022、FUT-0025、FUT-0026へ本checkpointの根拠を統合した。
- 既存CONF-0012、CONF-0015〜0017、CONF-0030の承認済み方針に対応する。新規CONFは追加しない。

## 未確認範囲

- AirItem/ArrayManagerのdialog confirmation、validate、single-flight、rollback、error snackbar、exposed API。
- Rules・server actor validation、status history/notification trigger実行、実データ・複数tab・offline。
- component単体/統合testはrepo-wide static検索で確認できない。
