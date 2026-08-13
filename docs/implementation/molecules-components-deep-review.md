# Shared molecules components deep review

## メタデータ

- 状態: 実装調査（SPEC-DEEP-028、deep-reviewed）
- 最終確認日: 2026-08-11
- 対象: `components/molecules/**` の12ファイル
- 根拠: 対象12ファイル、静的caller、直接依存の`useKatakanaFilter`・`useFloatingWindow`・`SiteOperationScheduleDetail`
- 関連: [共通UI components](shared-ui-components.md)、[Atoms core controls deep review](atoms-core-deep-review.md)、[Atoms buttons / chips deep review](atoms-buttons-chips-deep-review.md)、[Arrangements components deep review](arrangements-manager-components-deep-review.md)

## 公開契約一覧

| ファイル | props / model / emits / slots | 実装責務と境界 |
| --- | --- | --- |
| `Actions/props.js` | `disabled=false`、`loading=false`の共通props定義 | Actions 3種に共有される定義のみ。副作用なし。 |
| `Actions/Edit.vue` | disabled/loading、`click:edit`。attrsは編集buttonへmerge | loadingもdisabledとしてbuttonを抑止するが、後勝ち`$attrs`で上書き可能。handlerはemitのみ。 |
| `Actions/SelectCancel.vue` | disabled/loading、`click:select`/`click:cancel` | Select/Cancelへ同一`$attrs`を両方bind。cancelはloading時disabled、selectはdisabled/loadingを反映。 |
| `Actions/SubmitCancel.vue` | disabled/loading、`click:submit`/`click:cancel` | Submit/Cancelへ同一`$attrs`を両方bind。submitはloading時disabled、cancelもloading時disabled。 |
| `ActivatorCard.vue` | color/density/disabled/hideEditBtn/icon/item/noPadding/title、`click:edit`、toolbar/header/default/footer/actions slots | v-cardへattrs、toolbar actionを内包。edit button自身のpermission/loadingは持たず、親handlerへ委譲。 |
| `BtnKatakanaFilter.vue` | numeric `v-model`（default 0）、items配列 | items indexをbutton valueとして縦型toggle表示。selection更新のみ。 |
| `cards/SelectCancel.vue` | modelValue/title/subtitle、`update:modelValue`、activator/default slots | fullscreen dialog内で内部modelを編集し、select時だけemit、cancel/close時に元値へ戻す。 |
| `FloatingTitleCard.vue` | color/prependIcon/title、attrs、非title/prepend slots | v-cardへattrsとslotを透過し、浮遊chipでタイトルを表示。actionや保存は持たない。 |
| `FloatingWindow.vue` | isVisible/title/initialX/Y/width/height、`close`/`move`、default slot | document mouse/touch listenerでheader drag、画面境界内へclampし位置をemit。unmount時listenerを解除。 |
| `MonthSelector.vue` | Date `modelValue`、`update:modelValue`、`from`/`to`/`date-range` | JST/dayjsで月初・月末を計算し、前月/翌月buttonで複数eventを発火。 |
| `WorkerSelector.vue` | converter/convertedItemKey/employees/outsourcers/isDraggable、`tab-changed`、employee/outsourcer及びtag slots | Employee/outsourcerをScheduleDetailへ変換し、カタカナfilter・drag clone表示。選択/保存は親へslotで委譲。 |
| `WorkerTag.vue` | start/end time、label/highlight/loading/removable/removeIcon/size/variant、`click:remove`、Tag関連slots | Tagへ表示/削除を委譲し、footerに勤務時刻を追加。removal自体の保存は親責務。 |

## Action・dialog・submit契約

- Actionsはclickを同期emitするだけで、async処理、例外、retry、permission、監査を持たない。loadingが親から反映される前の二重clickをcomponent自身は抑止しない。
- `SelectCancel`/`SubmitCancel`は同じ`$attrs` objectを二つのbuttonへmergeするため、callerのdisabled/loading/onClick/aria属性が双方へ適用され得る。computedで設定したemit handlerもcaller attrsで上書きされ得る。
- `cards/SelectCancel`は内部modelをdialog中だけ保持し、dialog close watcherでprops値へ戻す。default slotへrefと`modelValue`/update handlerを渡すが、update handlerは`internalValue = newVal`というconst再代入になっており、値変更時に実行時例外となるコード契約である。静的callerは見つからず、到達性は未確認である。
- `ActivatorCard`のdefault edit buttonはicon-onlyでaria-labelを自身では追加しない。`hideEditBtn`がfalseなら親の明示permissionに関係なく表示される。

## 日付・選択・workerデータ

- `MonthSelector`は初期mount時にfrom/to/date-rangeをemitせず、prev/next操作時だけ発火する。`to`はJST月末の時刻を含むDateであり、invalid Date、DST、月範囲上限の防御はない。
- `BtnKatakanaFilter`はitems配列のindexをmodelに保存し、items変更時の選択index補正はしない。items空配列でもmandatory toggleとmodel default 0を保持する。
- `WorkerSelector`のconverter defaultは`SiteOperationScheduleDetail({id,isEmployee})`、`convertedItemKey` defaultは`workerId`。employee/outsourcerを別mapへ蓄積し、filter後にconverted objectを並べる。props arrayから除去されたidをmapからcleanupする処理はないが、表示結果は現props配列から再構成される。
- `WorkerSelector`は`tab-changed`を宣言するがactiveTab変更時にemitしていない。選択や保存のemitはなく、dragはclone-onlyで、worker mutationは親slot/Arrangement managerへ委譲する。
- `WorkerTag`はstart/end timeを必須stringとして表示し、labelは空白文字列を拒否する。`size`/`variant`にvalidatorがあるが、実際のremove actionはTagへ委譲する。

## FloatingWindow lifecycle・accessibility

- `useFloatingWindow` callerはArrangements Managerで、attrsの`isVisible`、initial position、onClose、onMoveを渡す。FloatingWindowはmousedown/touchstartだけでdrag開始し、mousemove/touchmoveをdocumentへ登録してunmount時に解除する。
- closeはicon-only buttonから`close`をemitする。Escape、keyboard drag、focus management、aria-label、visible=falseへのdrag listener即時停止はない。表示/位置状態はcomposable側が所有し、componentはv-modelを提供しない。
- `FloatingTitleCard`はtitle/prepend slotを除外して残りのslotsをv-cardへ再送する。titleがundefinedでもchip自体を描画し、空ラベルになる可能性がある。

## 直接caller・到達性

- 静的callerはActionsがCustomer/Site/Employee/OperationResult/Agreement等の編集・submit formで利用され、MonthSelectorがOperationResult、Billing、Attendance、Schedule、CustomerBillingで利用される。
- `FloatingWindow`はArrangements Managerのworker selector、`WorkerSelector`はArrangements worker selector wrapper、`WorkerTag`はworker display wrapper、`ActivatorCard`はOperationResult/OperationBilling activatorから到達する。
- `cards/SelectCancel`、`BtnKatakanaFilter`、`FloatingTitleCard`はそれぞれ静的callerが限定的またはcallerが見つからないものがあり、Nuxt auto-registration/dynamic component経路は未確認である。`BtnKatakanaFilter`はWorkerSelector内部から到達する。

## 矛盾・未使用候補・tests

- `cards/SelectCancel`の内部model update const再代入、`WorkerSelector`の宣言のみで未発火のtab-changed、`MonthSelector`の初期range未通知、`Employees/Actions`以外の共通actionでattrs後勝ちmergeを確認した。
- `FloatingWindow`のdocument listener cleanupは実装されるが、hidden化中のdrag継続やkeyboard代替は未確認である。
- 対象12ファイルを直接指定するapp testは静的検索で見つからなかった。実際のAir atoms/Vuetify event forwarding、dialog ref、browser drag、dynamic registrationはruntime未確認である。

## 将来要対応・既存台帳への統合

- icon/keyboard/focusはFUT-0115、Actionsのdouble-click・attrs分配はFUT-0117、一覧/selection/dialogの公開契約と`cards/SelectCancel`はFUT-0170へ統合する。新規FUT/CONFは追加しない。

## 未確認範囲

- Air atoms、Vuetify、AirData等の下位componentがattrs・event・loadingを補正する実際の挙動。
- runtimeのdouble click、dialog close/reset、invalid Date、drag/touch/keyboard、async handler failure。
- Nuxt auto-registrationやdynamic componentによる静的検索外caller、Rules/Firestore/実data、外部環境。
