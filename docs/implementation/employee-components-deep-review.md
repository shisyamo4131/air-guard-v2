# Employee components deep review

## メタデータ

- 状態: 実装調査（SPEC-DEEP-025、deep-reviewed）
- 最終確認日: 2026-08-11
- 対象: `components/Employee/*.vue`、`Activator/**`、`Card/**`、`ListItem/**`、`Manager/**`、`ScheduleCalendar/**` の10ファイル
- 根拠: 対象10ファイル、直接callerの `pages/employees/[id].vue`・`components/Employees/Iterator/index.vue`・`components/OperationResult/Worker/CustomInput.vue`・`components/DailyAttendance/Index/index.vue`、直接fetch/schemaの `useFetchEmployee`・`Employee`・`User`
- 関連: [Employee master](employee-master.md)、[User / Auth lifecycle](user-auth-lifecycle.md)、[認可model](authorization-model.md)、[Employee pages deep review](employee-outsourcer-attendance-pages-deep-review.md)

## component / public API

| ファイル | props / emits / 公開契約 | 状態・副作用 |
| --- | --- | --- |
| `Activator/Base.vue` | required `item: Employee`、任意title、`click:edit`。基本PIIを表示し、managerへ18 edit keysを`defineExpose`する。 | display only。編集iconは常時表示され、component自身はpermission/loadingを判定しない。required `address`は表示するがexposed edit keysに含まれない。 |
| `Activator/Nationality.vue` | required `item: Employee`、任意title、`click:edit`。国籍・在留・就労制限7 keysを公開する。 | 非外国人の空nationalityは「日本」と表示する。permission/loading/errorは親へ委譲する。 |
| `Activator/SecurityGuard.vue` | required `item: Employee`、任意title、`click:edit`。警備員登録、血液型、緊急連絡先、本籍9 keysを公開する。 | 未登録時にも登録actionを表示する。高感度PIIをmaskせず表示し、追加permissionを持たない。 |
| `Autocomplete.vue` | creatable、label、itemTitle/value、returnObjectと`update:model-value`。N-gram APIの最新結果だけを表示する。 | status filterを追加せず、RESIGNEDも候補になり得る。現callerはOperationResult worker入力でcreatable=false。create icon branchは静的caller未確認。 |
| `Card/index.vue` | required `employee: Employee`、選択/詳細/編集表示flags、`click:select/edit/detail`。 | unknown genderで`GENDER[value].color`を直接参照して例外になり得る。icon-only actionsに固有labelを付けない。 |
| `ListItem/index.vue` | required `item: Object`を受け、raw/plainを内部Employeeへdeep watchして初期化する。emitsなし、attrsをlist itemへ透過する。 | ACTIVE/RESIGNED/その他でiconを分岐し、入社/退社日と外国人氏名を表示する。loading/error stateなし。OutsourcerAutocompleteからも誤用される既知境界がある。 |
| `Manager/index.vue` | required `doc: Employee`、create/update/delete handlerを差替え可能。全slotを`air-item-manager`へ透過する。 | 保存、validation、dialog、loading/error/double-submitは基底manager/modelへ委譲し、自身にpermission/rollback処理はない。 |
| `ScheduleCalendar/index.vue` | required `employeeId`。ArrangementNotificationを購読し、日付降順・shift順にlist表示する。 | queryは`where id == employeeId`で`isEmployee`/`employeeId`を使わず、raw IDが同じoutsourcer通知を混在させ得る。empty/loading/error表示、明示unsubscribe、callerは確認できない。 |
| `Select.vue` | items、labelと全attrs/slotsを`air-select`へ透過する。 | `code - fullName`で表示し、`item.code.localeCompare`でsortする。codeは任意のためnull/undefinedで例外になり得る。現行唯一のtag callerはcomment内で未到達である。 |
| `UserManager.vue` | required employee/user objectsを受け、User作成・削除を`air-item-manager`へ委譲する。 | Employee値からemployeeId/companyId付きtemporary Userを作り、email global check後にclient createする。updateは禁止、roles/tagSizeはeditorから除外、non-admin deleteだけをcustom buttonで公開する。 |

## PII・validation・権限境界

- Baseは氏名・生年月日・自宅住所・電話・email・備考を、Nationalityは国籍・在留資格・在留期限・就労制限を、SecurityGuardは血液型・緊急連絡先・本籍を表示する。mask、field別role、本人判定、audit表示は対象componentにない。
- 3 Activatorのedit action、User登録/削除、退職、Employee archive削除は、`employees:read`だけのdetail pageから到達する。実際のRulesも同一company認証UserへEmployees/Usersの広いwriteを許し、componentの表示制御はserver enforcementではない。
- Activatorの`includedKeys`は編集可能fieldを絞るが、schema validationの代替ではない。Baseはrequired addressを含めず、既存住所の番地をdetail editorから変更できない。Nationality/SecurityGuardの条件付きrequired・無効時初期化はEmployee model hookが最終責務を持つ。
- EmployeeCardのgender、EmploymentStatus/ListItemのstatusは保存enumの直接lookupに依存する。旧値・direct write・unknown値に対する共通fallbackはない。

## User/Auth、退職、archive/delete

1. detail pageは`User.employeeId == Employee.docId`をlive購読し、先頭UserだけをUserManagerへ渡す。1 Employee対複数Userの一意制約はない。
2. UserManagerはEmployeeのenumerable値をUserへhydrateし、employeeIdとauth.companyIdを上書きする。Userのrolesは空配列、tagSizeはschema defaultになり、editorでは双方を変更しない。email global availability確認後にtemporary User documentをclient作成する。
3. UserManagerのdelete buttonは実Userの`isAdmin`でdisableされ、User modelもadmin deleteを拒否する。User更新は明示的にthrowする。
4. detail pageの退職/Employee削除buttonは、購読結果ではなく初期空User instanceの`user.isAdmin`を参照するため、admin紐付きでもUI disableが効かない。`toTerminated`は改めてUserをqueryしてadminを拒否するが、Employee archive/deleteは先に完了し得る。
5. 退職はEmployee更新と先頭User document削除をFirestore transactionに入れ、失敗時Employee instanceをrollbackする。Employee logical deleteはactive document削除後のFunctions triggerでUser cleanupする別event境界であり、dialogの「同時に削除」は原子性を意味しない。

## schedule/calendar・検索境界

- EmployeeAutocompleteはN-gram searchをserver resultに委譲し、client filterを無効にする。searchは上限50、status条件なし、同一query cacheあり。OperationResult手動worker追加から到達するため、退職者を新規実績へ選べる候補は既存FUT-0079の範囲である。
- ScheduleCalendarはArrangementNotificationの`id`をemployeeIdと比較する。notificationのemployee識別には専用`employeeId`があるため、employee-only表示でraw worker IDだけを使う実装は既存FUT-0036のmechanical check対象である。
- calendarはindexをVue keyにし、日付/shift順の同値tie-breakを持たない。site取得失敗、購読error、0件を画面上で区別しない。repository内に静的callerがなく、未使用候補である。
- EmployeeSelectはDailyAttendance templateのcomment内にだけ現れ、現行runtime入口は確認できない。

## loading・error・accessibility・tests

- Manager/UserManagerは基底managerへloading/dialog/errorを委譲し、対象file自身にはsingle-flight、error banner、refetch/rollbackがない。Activator/Cardのactionは処理中disableを受け取らない。
- edit/detail/select/createは複数のicon-only controlで、固有のaria-label/titleを渡さない。ScheduleCalendarにはloading/empty/errorとcalendar semanticsがなく、Card selectionはclickだけでkeyboard代替を定義しない。
- 対象10ファイルを直接指定するunit/component testはrepository静的検索で見つからなかった。runtime、Emulator、Auth/Rules、screen reader、二重click、archive-trigger部分失敗は未実施である。

## 将来要対応・既存台帳への統合

- PII表示・編集は [FUT-0075](future-actions.md#fut-0075-employee個人情報の閲覧編集権限を最小化する)、User一意性と退職/delete cleanupは [FUT-0076](future-actions.md#fut-0076-employeeuser-1対1と退職削除cleanupを保証する)へ証拠を追加する。
- Baseのaddress編集欠落は [FUT-0059](future-actions.md#fut-0059-customerの住所status編集とgeocoding境界を整備する)、code sort/退職候補は [FUT-0079](future-actions.md#fut-0079-employee-code派生氏名候補statusの整合を保証する)へ統合する。
- Employee-only schedule queryのraw ID filterは [FUT-0036](future-actions.md#fut-0036-dailyattendance詳細を従業員明細だけに限定する)、unknown enumは [FUT-0166](future-actions.md#fut-0166-enumfield-validationunknown表示を単一contractへ揃える)、icon accessibilityは [FUT-0115](future-actions.md#fut-0115-共通icon操作とdrag-uiのaccessibilityを整備する)へ統合する。
- 新しい利用者判断は追加しない。正式PII権限、User/退職policy、候補statusは既存CONF-0061〜0065、unknown enumはCONF-0137の上位判断を維持する。
