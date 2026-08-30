# SiteOrder / SiteShiftTypeOrder 実装調査

## メタデータ

- 状態: Current implementation + historical investigation
- 対象セグメント: SPEC-SEG-052、SPEC-DEEP-035、SPEC-DEEP-039b
- 最終確認日: 2026-08-30
- 根拠ファイル: schemas `src/SiteOrder.js`、`src/Company.js`、`composables/dataLayers/siteShiftTypeOrder/*`、`composables/application/siteShiftTypeOrder/useSiteShiftTypeOrderActions.js`、`components/SiteShiftTypeOrder/**`、`components/Draggable/SiteShiftTypeOrder/index.vue`、`components/Arrangements/Manager/**`、`components/OperationSchedules/Manager/index.vue`、`utils/pageSettings.js`、`firestore.rules`

## 責務と保存契約

### 2026-08-30 現行実装

- 保存先は引き続きCompany rootの`siteOrder`と`scheduleOrder`であり、document分割は行っていない。保存itemはexact `{siteId, shiftType}`、各配列最大2000件、pair一意で、computed `key`は送信しない。
- `updateCompanyArrangement` CallableがidentityからCompanyを導出し、一度に一方のfieldとserver `updatedAt`・`uid`だけをtransaction updateする。同値はwrite 0で、live Companyをclient側で先行変更しない。
- actorは同社の有効な本登録non-super-userで、会社管理者、または既知preset由来のfield別permissionを持つUserとする。`siteOrder`は`sites:write`、`scheduleOrder`は`site-operation-schedules:write`。直接permission文字列、未知role、temporary、disabled、他社、super-userは拒否する。
- Rulesは`agreementsV2`、`siteOrder`、`scheduleOrder`のclient直接変更を全actorへ拒否する。対象外のCompany field互換updateはCPU-05まで維持する。
- reorder formは独立draftを使い、dirty中の外部更新を黙って反映せず保存を止める。自分の保存reflectionは競合扱いしない。保存中はdrag、保存、取消、再読込、sort/removeを停止し、失敗時はdialogとdraftを維持する。
- missing/deleted/非active Siteは表示から除外し、次の明示保存時だけorderから除去する。Site取得失敗は安全側で保存を止める。
- 完全に同時な許可actor同士の保存はrevisionを持たず後commit優先となる。詳細は[ADR 0035](../decisions/0035-company-display-order-update-boundary.md)を正とする。

以下は2026-08-12時点の旧whole-document writer調査であり、上記の現行実装に置換された箇所を履歴として残す。

`SiteOrder`は現場と勤務区分の組を表す値objectで、保存fieldは必須の`siteId`と`shiftType`である。ゲッター`key`は`${siteId}_${shiftType}`を返す。Company documentのhidden配列`siteOrder`が配置管理用、`scheduleOrder`が稼働予定管理用で、いずれも`customClass: SiteOrder`としてhydrateされる。独立collection、`SiteShiftTypeOrder` class、`ScheduleOrder` classは確認できず、保存単位はCompany document全体である。

| 種別 | Company field | 直接利用画面 | 補完元 |
| --- | --- | --- | --- |
| `ARRANGEMENT` | `siteOrder` | `/arrangements-manager` | 対象期間の配置予定group |
| `SCHEDULE` | `scheduleOrder` | `/operation-schedules` | 対象期間の稼働予定 |

両routeはpageSettings上`site-operation-schedules:read`で到達する。並べ替え専用write permissionはない。Firestore RulesはCompany root documentを、claim companyIdがdoc IDと一致する全認証Userまたはsuper-userへread/write許可し、配列field、key、重複、参照Site、actorを検証しない。

## 初期化・補完・表示

1. `useSiteShiftTypeOrder`がtypeに応じてCompanyの保存配列を返す。不明typeでは空配列を返す。
2. `useSiteShiftTypeOrderEnriched`は保存済み各entryのSiteを取得し、予定等の`enrichmentOrders`を`SiteOrder`へ変換する。
3. 保存配列にないkeyは、補完元の出現順で末尾へ追加して画面へ返す。この補完は表示だけで、自動保存されない。
4. reorder formは入力を新しい`SiteOrder` instanceへcloneし、key列の順序だけで変更有無を判定する。
5. `vuedraggable`が配列順を変更し、submit時に配列全体を親へemitする。

補完元はSet/Mapでkeyを一意化するため、同じsiteId/shiftTypeの複数予定は表示順entry 1件へ集約される。一方、保存配列内の重複は除去されず、そのまま表示配列へ残る。保存済みだが現在の補完元にないentryも削除されず先頭側に残る。

Siteが削除・archive・取得失敗となってもorder entryを除去する処理はない。ListItemはSite取得中と欠損を区別せず`...loading`を表示し続け得る。表示ListはVue keyにorder keyではなくindexを使用する。

## drag・更新・削除

- reorder formはdraft配列を持ち、cancelで最新propsから再初期化する。submit buttonは変更がない場合またはloading中にdisabledとなる。
- draggable本体にはloading/disabledが渡らないため、保存中もdraftのdrag操作は静的には可能である。
- action `update`はCompany instanceの対象配列を先に置換し、`company.update()`を呼ぶ。例外はloggerへ記録して吸収し、呼出し元へ失敗を返さず、旧配列へrollbackしない。
- dialogは`closeOnSubmit: true`でactionを使うため、保存失敗でも上位がrejectを検知できず閉じる可能性がある。
- `remove`はkey一致をfilterして配列全体を同じupdate経路へ渡す。重複keyがあれば全件除去する。
- transaction、batch、revision、Firestore preconditionはこの経路にない。Company document単位の同時更新は後勝ちとなり、別端末の並べ替えや会社設定更新との競合を検出しない。

## schema配列API

Company初期化時、両配列に`add/change/remove`が追加される。`siteOrder.add`はkey重複を拒否し、指定indexまたは末尾へ追加する。`change`はindex範囲を検証してspliceし、`remove`はkey一致を1件除く。これらはinstance内変更のみで、別途Company updateが必要である。

`scheduleOrder.add`だけはimportも定義もない`ScheduleOrder`をnewするため、呼ぶとReferenceErrorになる。現行の並べ替えUIは配列全置換を使い、このmethodを直接呼ばないため、現在確認した主要UI保存経路では未到達である。`scheduleOrder`のcustom class自体は`SiteOrder`である。

`SiteOrder.key` setterは`_`でsplitして先頭2要素だけを使う。doc IDにunderscoreが含まれる場合は可逆でないが、確認したUIはkey setterを使わず`siteId`と`shiftType`からinstanceを作る。key文字列を入力として復元する別経路は未確認である。

## 旧実装・未使用候補

- `useSiteOrderManager`は`company.siteOrder`専用の旧dialog/action一体型composableで、定義外の呼出しを検索で確認できなかった。現行画面はtype対応の3 composableを使う。
- `components/organisms/SiteOrderManager.vue`も定義外の利用を検索で確認できず、現行reorder formとは別の旧component候補である。
- SPEC-DEEP-032で同componentの`siteOrder` defineModel、`loading` prop、cancel/submit emit、`vuedraggable`/Actions結線をfile単位で再確認した。保存、permission、validation、rollback、error表示は持たず、直接caller不在というlegacy候補の根拠を補強する。
- ListItemの`fetchSiteComposable` propは宣言されるが、実装は常に`useFetch`から同名localを取得し、propを参照しない。
- schemaの`ScheduleOrder`という名称はコメント/errorと未定義constructorにだけ残り、実在class/exportは確認できない。

## 整合・矛盾・将来要対応

- `company-settings.md`の「Company内の2配列をlive参照」と、`site-operation-schedule.md`のread permissionで予定管理操作へ到達する記録に一致する。
- `FUT-0094`の未定義`ScheduleOrder`は現行UIでは未到達だがschema公開methodとして再確認した。
- Company全体の後勝ち更新、失敗吸収とrollback欠如、重複・欠損・削除Siteの正規化欠如は`FUT-0071`へ証拠を追記する。
- `Draggable/SiteShiftTypeOrder`は`itemKey`とattrsを`vuedraggable`へ渡すだけで、保存中disable・permission・error/rollbackを持たない。ReorderFormのdraft/submit境界を含むfile単位の確認は[Worker / drag components deep review](worker-drag-components-deep-review.md)を参照する。
- 正式な操作権限は`CONF-0056`、同時編集UXは`CONF-0057`の上位判断へ統合し、新規CONFは追加しない。

## 要確認事項参照

- `CONF-0056`: 予定・配置管理の正式操作権限。並べ替えも同じ上位操作権限に含めて判断する必要がある。
- `CONF-0057`: 並べ替え競合時のversion/precondition、警告、再読込方針。

## 未確認範囲

- FireModel `update()`が実際に送るfield粒度とconverterのserialized payload。
- Emulatorでの同時更新、offline queue、再接続、Rules enforcement。
- 実Company document内の重複・欠損・underscore入りSite ID、旧componentの動的参照。
- 並び順の正式な業務権限、競合解決方針、削除Site entryの保持期間は未決定。

## Component境界の追加確認（SPEC-DEEP-035）

reorder formはopen中に親配列を受け取るとdraftを無通知で再初期化する。`loading`はbuttonだけを無効化してdraggable自体を止めず、`submit()`はvalidation・clone・await・error処理なしで内部配列をemitする。`ListItem`の差し替え可能な`fetchSiteComposable` propは同名local変数に隠されて未使用で、欠損Site・取得失敗はいずれも`...loading`のままになる。permission、actor、revision、auditはcomponent内にない。

## 旧useSiteOrderManager追加確認（SPEC-DEEP-039b）

- 静的caller不在を再確認した。旧managerはdialog draftをCompany instanceへ先に全置換してfull updateし、失敗をloggerへ吸収してCompany値をrollback/refetchしない。
- `Company.initialize`時にarrayへ付与される`add/change/remove` helperは、`company.siteOrder = [...internalSiteOrder]`のplain array置換直後には引き継がれない。live subscriptionが再initializeする前に旧managerのpublic add/change/removeを呼ぶとmethod欠損となるlatent境界である。
- public add/change/removeもCompany配列を先にmutationしてからupdateし、version・single-flight・actor/permission・rollbackを持たない。

## order data layer追加確認（SPEC-DEEP-043）

- order typeはmutable plain objectで、未知typeはerrorでなく空配列を返す。保存済み`siteOrder/scheduleOrder`の重複key・invalid entryは検査せずそのまま残す。
- enrichmentはmissing keyだけを`SiteOrder` instanceとして末尾追加するため、保存済みplain objectと補完instanceが混在する。既存重複はSetで検知してもresolved配列から除去しない。
- Site fetchは各entry changeでawaitせず開始され、loading/error/cancelをorder stateへ返さない。missing/deleted Siteを含むorderも保持される。
