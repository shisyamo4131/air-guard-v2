# OperationSchedules components deep review

- 状態: 実装調査
- 対象チェックポイント: SPEC-DEEP-031
- 最終確認日: 2026-08-11
- 対象: `components/OperationSchedules/**` 11 files
- 根拠: 対象11 filesの全文、`/operation-schedules` route、直接使用するrange/data-layer/selector/duplicator/order action/dialog、`SiteOperationSchedule` schemaのCRUD・notify・duplicate・lock契約、該当Rules
- 制約: runtime、Emulator、実data、Rules実行、Air manager/Draggable内部、Functions、全Schedule child component本文は未実行・未再調査

## file別公開契約

| file | props/emits/責務 | 確認した挙動 |
| --- | --- | --- |
| `Manager/index.vue` | propsなし。月range、schedule購読、selector、duplicate、順序dialogを統合 | `/operation-schedules` routeのroot。`click:cell`だけをTableから購読する |
| `Manager/Toolbar.vue` | inject `dateRangeComposable`、emit `click:sort`/`click:create` | 前後月、順序dialog、新規作成のicon button。inject欠損時はsetupで失敗する |
| `Table/index.vue` | date range、schedules、siteShiftTypeOrder、selectedDate、scrollToRowKey。emit `click:cell`/`click:add-schedule`/`click:remove-site-order`/`update:scrollToRowKey` | slotをHead/Body/Footへ透過し、DOM IDをrow keyから作ってscrollする |
| `Table/Head.vue` | inject props/columns。6 header slots | 日付、曜日、holiday iconを描画するだけ |
| `Table/Foot.vue` | inject columns。footer slot | 日別footerをsticky表示 |
| `Table/Body/index.vue` | columns/rows/schedulesIndex/selectedDate、3 row slotとcell slot、3 action emit | rowごとのadd/remove iconとcell clickを生成する |
| `Table/Body/Row.vue` | columns/rowと4 slots | site/shift row headerと日付cell rowを描画。左fixed row keyをDOM IDに使う |
| `Table/Body/useOperationSchedulesTableBodyModel.js` | cell slot props、Site名、選択blur、remove disabledを返す | rows deep watchでSiteをfetch。remove disableは現在渡されたschedulesのorderKey存在だけを参照 |
| `Table/AddScheduleIcon.vue` | required siteId/shiftType、attrs fallthrough | cacheにSiteがある時だけenabled表示。親へclickをbubbleする表示icon |
| `Table/RemoveSiteOrderIcon.vue` | required siteId/shiftType、attrs fallthrough | row削除を示す表示icon。単体では削除処理を持たない |
| `Table/useOperationSchedulesTableModel.js` | range/column style/rows/indexを返す | rowsはCompany `scheduleOrder`、schedule indexはorderKey/groupKeyで集計 |

対象11 filesに固有のunit/component testはrepo内検索で見つからなかった。component auto-importを使うため、明示import 0件だけでunusedとは判定しない。

## route・query・row生成

- `/operation-schedules` pageはroot `useFetch(..., true)`後に`OperationSchedulesManager`を置くだけで、page自身にloading/error/permission/write guardはない。navigation設定は`site-operation-schedules:read`である。
- ManagerはJST当月を初期rangeにし、debounced from/toの`dateAt` rangeだけでlive購読する。明示`orderBy`、limit、server pagination、customer filter、worker filterはない。
- Companyの`scheduleOrder`をrowの基底にし、対象rangeに実在するscheduleのsiteId/shiftTypeを`SiteOrder`へ変換して欠落rowを表示だけ補う。補完entryはCompanyへ自動保存されない。
- `groupKey` indexは同一Site/shift/dateの複数scheduleを配列・count・requiredPersonnel合計としてslotへ渡す。table自身は複数予定の個別順・worker・customerを表示せず、cell click後のSelectorへ委譲する。
- `statistics` footerはrange内scheduleの`requiredPersonnel`合計である。OJT、資格充足、actual時間、OperationResult/Billing、customerはここで集計しない。

## CRUD・duplicate・notify・Result lock境界

- toolbarのcreate、cell Selectorのcreate/edit/duplicateは`SiteOperationSchedulesManager`または`SiteOperationScheduleDuplicator`へ渡す。schedule managerはOperationResult linkがあるitemのupdate/deleteをdisableし、schemaの`beforeUpdate`/`beforeDelete`も更新前`operationResultId`を検査する。
- Table rowのadd/remove iconはそれぞれ`click:add-schedule`/`click:remove-site-order`をemitする。しかしこのManagerは`click:cell`しかlistenしていないため、通常routeでは両iconに処理先がない。toolbarとSelectorのcreateは別に到達する。
- Selectorはlocked scheduleにもedit/duplicate pencil/copy buttonを表示する。manager/schemaが後段でupdate/deleteを拒否するが、Selector自身はlock、loading、permissionを表示/disableしない。
- duplicateは元日除外、重複日除去、最大20日、`operationResultId=null`、worker `hasNotification=false`でtransaction createする。元scheduleの`isEditable`はduplicate UI/`set`で検査しないため、実績済みscheduleをtemplateとして複製できる。
- schemaの`notify`は未通知workerのArrangementNotification作成と全worker flag更新をtransaction化する。target Table/Managerはnotify buttonを持たず、通知の操作・結果表示はSelector以外のSchedule/Arrangement UI境界にある。
- Result生成後のschedule lock、Result削除によるlink解除、後続Functionsはtarget component外である。Tableはlocked rowを特別表示せず、calendar event色はschemaの`toEvent()`側に依存する。

## order・削除・並行性

- `scheduleOrder`の並び替えはfullscreen dialogのdraft formからCompany `scheduleOrder`全体を`company.update()`する。actionは新配列をlocal Companyへ先に代入し、errorをloggerへ吸収する。`useManagedDialog`はresolved returnを成功としてcloseするため、保存失敗でもdialogが閉じ、local state rollback/refetchはない。
- `remove-site-order`のdisabledは現在表示rangeの`schedulesIndex.orderKey.has(row.key)`だけで決まる。Managerはeventを未購読なのでこのrouteのremoveは無作用だが、別callerが同APIを結線する場合、range外にしかscheduleがないrowを削除できる契約になる。これはschedule documentを削除せず表示順entryだけを除く。
- schedule createの最大`displayOrder` queryはschema transaction外、Company order更新もversion/preconditionなしである。target componentはreorder submit中にtoolbar/row actionを止めず、別tab/別clientとの競合を検出しない。
- `scrollToRowKey` watcherはDOM targetが未描画でも直ちにnullへresetする。初回購読/非同期row描画との実害はruntime未確認である。

## loading・error・accessibility

- schedule data layerはunmountで購読解除し、range変更で再購読する。Managerのpage/tableはloading、query error、empty、retryを明示表示せず、data layer・Air manager・global error storeへ委譲する。
- rowのSite fetchはdata layer、enriched order、Body watch、iconそれぞれから起こり得る。cache dedup、fetch失敗時の表示、rapid range変更の古い応答抑止は直接確認していない。
- `AddScheduleIcon`/`RemoveSiteOrderIcon`はclickする`v-icon`で、native button、keyboard操作、explicit accessible nameをcomponent自身では持たない。table header/bodyはsemantic table要素を使うが、row actionのkeyboard/focus returnは未確認である。
- selectedDate指定時、対象外のcellは`filter: blur(4px)`になるがdisabledではない。ManagerはselectedDateを渡さないため、通常routeの全cellは選択可能である。

## permission・tenant・validation

- component内にrole/permission/tenant/customer/worker validationはない。routeはread権限だけ、Rulesは同一companyの認証Userまたはsuper-userにScheduleのread/writeを許す。
- scheduleのSite、employee/outsourcer、notification flag、operationResultId、displayOrder、日付・時間・資格のfield ownershipはRulesで検査されない。schema/handlerでのclient-side validationをdirect SDK writeが迂回できる。
- order dialogもCompany documentを全体updateするため、row操作の暫定read permissionと実write許可が分離していない。

## 矛盾・未使用候補

- Table APIはadd/remove row eventを明示するが、通常の`OperationSchedulesManager`は両方をlistenしない。表示iconは現routeで無作用であり、FUT-0176へ登録する。
- Table prop documentationには`cachedSites`が残るが実装propsに存在せず、Site取得はBody/iconの`useFetch`へ移っている。
- `useOperationScheduleTable`は`cachedSites`をattrsへ含めるがTableは受け取らない。互換残置候補であり、動作影響は未確認である。
- `isNotificatedAllWorkers`はschemaにdeprecated aliasとして残る。target11 filesは参照しない。

## 将来要対応と確認事項

- 操作/Rulesの正式分離はFUT-0070、displayOrder・Company order・dialog rollbackはFUT-0071、Result lock強制はFUT-0072、通知flag/rollbackはFUT-0073、duplicate/過去予定/充足基準はFUT-0074へ統合する。
- row actionのevent結線とbutton accessibilityはFUT-0176へ登録する。
- 新規CONFは追加しない。操作権限、order/duplicate/過去予定の業務判断は既存CONF-0056〜0060へ統合済みである。

## 未確認範囲

runtime/Emulator、Air manager/Draggableのsubmit lock、Rules実行、Firestore query index・同時transaction、実data、Site fetch cache、mobile table操作、keyboard/focus、Calendar/Selector/CustomInputの全本文、Functions、下流通知/Result同期は未確認である。sourceで確認したevent未購読・error吸収と、runtime依存の発生可能性は区別した。
