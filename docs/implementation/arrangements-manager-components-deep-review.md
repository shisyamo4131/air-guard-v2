# ArrangementsManager components deep review

## メタデータ

- 状態: 実装調査（file本文deep review）
- 対象checkpoint: SPEC-DEEP-015
- 最終確認日: 2026-08-11
- 対象: `components/Arrangements/**` のexact 10 files
- 境界: 直接callerの`pages/arrangements-manager.vue`、range data facade、arrangement actions、schedule actions、実効人数utilityだけを照合した。子component本文、Rules、runtime、PDF生成は未確認。

## file別公開契約

| file | responsibility / props / emits | query・mutation・error | UI・到達性 |
| --- | --- | --- | --- |
| `WorkerSelector.vue` | employees、outsourcers、`isEmployeeArranged`をMoleculesWorkerSelectorへ渡す。emitなし。 | employeeの配置済み判定はtag variantを`disabled`にするだけ。 | headerコメントはinject取得と記すが実装はprops。`isDraggable=true`で、選択禁止をこのwrapperは強制しない。 |
| `Manager/WeekdayActions.vue` | column/isSelected、focus/PDF/text/jump-listの4 emit。 | 外部作用は親handlerへ委譲。 | tooltipあり。PDF buttonにloading/single-flight/permission属性なし。 |
| `Manager/useSelectableDate.js` | `selectedDate` computed API。 | 同じdateを再設定するとnullへtoggle。 | validation/format正規化なし。Manager専用の実利用のみ。 |
| `Manager/useIndex.js` | range data、各dialog/table/card/worker tagのfacade attrsを返す。 | drag reorderはschedule transaction action、単体worker update/notify/PDF/order更新は外部actionsへ委譲。日別集計と連勤warning lookupを組立。 | actor permission、error feedback、row action single-flightを自ら強制しない。 |
| `Manager/Table.vue` | `selectedDate`により選択日以外のcell scopeをdisabled化するOperationSchedulesTable wrapper。 | なし。 | `selectedDate`はattrsからrawに読む。focused day自身は操作可能で、loading/concurrency抑止とは別。 |
| `Manager/SpeedDial.vue` | 3 internal click emitを定義する。 | open local stateだけ。 | 親は`v-bind`で`onClick:*` listenersを渡すが、componentは`$attrs`をroot/内部buttonへbindしない。internal emit listenerが親へ接続されず、並替え・予定追加・作業員window actionが到達しない候補。icon-only buttonにtext/aria-labelなし。 |
| `Manager/index.vue` | required Date start/endを受け、table、dialogs、schedule/notification/worker manager refsを構成。 | security report dialog stateをlocal管理。 | `/arrangements-manager`が唯一の直接caller。pageはdesktop14/mobile4日+前日offsetを一度だけ決め、viewport変更に追随しない。 |
| `Manager/DailyStatusSummary.vue` | summaryの5状態・needsReviewを表示。 | なし。 | aria group/labelあり。summary missingは0扱いでデータ未取得と0件を区別しない。 |
| `Manager/DailyHeaderSummary.vue` | required/assigned/differenceを表示。 | なし。 | aria labelあり。summary missingは0/充足と表示し、loading/errorと区別しない。 |
| `Manager/CommandTextDialog.vue` | string `modelValue`、`update:modelValue` emit、readonly text dialog。 | close時null emit。 | textのcopy専用UI。空stringはdialogを閉じる。focus restore/error表示なし。 |

## 集計・期間・mutation境界

- `useArrangementsInRange`は表示範囲だけのscheduleと、前後各1日の連勤判定用scheduleを分離して購読する。日別集計はschedule.dateごとにrequiredを加算し、通知優先のOJT/外注amountを用いてassignedを算出する。通知不存在かつflag falseはprovisional、flag/document/unknown statusの不整合はneedsReviewである。
- range facadeのgroupKey indexは同一site/shift/dateで後方scheduleが前方を上書きする。duplicate groupKeyは表示/lookupで明示エラーにしない。
- drag `updateSchedules`はdate/site/shift/displayOrderを正規化してtransaction内の複数updateへ委譲する。一方、worker/card単体update、notify、PDF、site order更新は別actionであり、Manager facadeに共通loading、rollback、結果表示、世代管理はない。
- weekday PDF/text、notify、worker detail、security report、duplicate、schedule作成・編集は下位component/composableへdelegationし、この10 filesはtransaction境界を開始しない。

## 権限・通知・responsive/accessibility

- component層にはrole/permission判定がない。route/page・Rules・serverが実認可境界である。
- worker notification clickはgeneric ArrangementNotification managerへ渡す。通知生成/配送はschedule action/Functions境界で、managerは結果・重複を集計しない。
- focused dateは他日cellをdisabledにするが、同日内の多重操作、notify/PDF/SpeedDialの連打、別tab更新は抑止しない。
- 日別summaryにはaria labelがある。WeekdayActionsはtooltipを持つ。SpeedDialとsecurity report closeはicon-onlyで明示accessible nameがない。

## 矛盾・未使用候補

- WorkerSelectorのinject記述はprops実装と矛盾する。
- SpeedDialの3 custom event listener未接続は、親から渡したactionsが実行されない具体的候補である（FUT-0169）。
- `useSelectableDate`の将来汎用化コメントに対し、repository-wide static searchで対象Manager以外のcallerはない。
- daily summaryは未取得/不整合を部分的にneedsReviewへ示すが、summary prop absentは0/充足として表示する。

## 将来要対応・要確認

- FUT-0070、FUT-0071、FUT-0073、FUT-0158へ本checkpointの権限・transaction・error/多重実行の根拠を統合した。
- FUT-0169をSpeedDial custom event到達性の実装修正候補として追加した。
- 既存CONF-0056〜CONF-0060、CONF-0133の上位判断に統合し、新規CONFは追加しない。

## 未確認範囲

- table/card/drag/dialog子component、PDF/text/notifyの内部、Rules/Functions、実data、runtime responsive/keyboard/focus、transaction競合、テスト。
