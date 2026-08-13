# Employees / Insurance components deep review

## メタデータ

- 状態: 実装調査（SPEC-DEEP-027、deep-reviewed）
- 最終確認日: 2026-08-11
- 対象: `components/Employees/**` 2ファイル、`components/Insurance/**` 9ファイル
- 根拠: 対象11ファイル、直接callerの`pages/employees/{index,resigned,[id]}.vue`、直接schemaの`Employee`・`Insurance`・insurance status定義
- 関連: [Employee保険管理](employee-insurance.md)、[Employee master](employee-master.md)、[Employee components deep review](employee-components-deep-review.md)

## component / public API

| ファイル | props / emits / 公開契約 | 処理・副作用境界 |
| --- | --- | --- |
| `Employees/Iterator/index.vue` | `employees`、`hideDefaultFooter`、`showCreate/Detail/Edit`、`click:create/detail/edit`。未宣言attrsはroot `air-data-iterator`へfallthroughする。 | EmployeeCardへdocとselect/detail/edit handlerを渡す。no-dataだけcreate表示を`showCreate`で制御する。宣言済み`hideDefaultFooter`をrootへbindせず、JSDocの`item`/`footer` slotも転送しない。 |
| `Employees/Manager/index.vue` | `docs`、CRUD handler、search、page size、sort、`showCreate`、`update:search`、`click:detail`。 | AirArrayManagerへEmployee schemaとCRUDを渡し、create時だけToRegistを使う。toolbar plusは`showCreate`にかかわらず表示し、detailだけIteratorへ明示する。 |
| `Insurance/Status/Chip.vue` | required `status`、`isProcessing`。 | status定義をv-chip attrsへ変換し、unknownは`N/A`、processingは「手続中」を付加する。 |
| `Insurance/Transition/Manager.vue` | required object model、title、activator slot。 | Menu actionをcustom inputとschema methodへmapし、clone入力から元Insuranceを同期mutationする。Employee保存は親の`submit:complete` listenerへ委譲する。 |
| `Insurance/Transition/Menu/index.vue` | required Insurance、6つの`click:*` event、activator slot。 | `_canTransitionTo`、processing、history、enrolled状態で各actionをdisabledにする。 |
| `Input/Enroll.vue` | required item/updateProperties、componentAttrs。 | NOT_ENROLLED/EXEMPTから加入。processingへ切替時numberをnull化し、加入日・processing・番号を入力する。 |
| `Input/Enrolled.vue` | required item/updateProperties、componentAttrs。 | processing中加入の番号確定。useDefaults key先頭に空白があり、このcomponentのglobal defaults名と一致しない候補がある。 |
| `Input/CancelEnrollment.vue` | required item/updateProperties、componentAttrs。 | processing中加入の取下げ確認だけを表示し、入力fieldを持たない。 |
| `Input/Exempt.vue` | required item/updateProperties、componentAttrs。 | 未加入からは確認のみ、完了加入からは喪失日・理由を入力するがUIのrequired指定はない。 |
| `Input/Loss.vue` | required item/updateProperties、componentAttrs。 | 加入から喪失日・理由・退職flagを入力し、退職ONで理由を「退職」にする。 |
| `Input/Rollback.vue` | required item/updateProperties、componentAttrs。 | history末尾の状態をpreviewする。更新fieldはなく、schema rollbackがhistoryをpopする。 |

## Employees一覧・検索・選択・CRUD

- 在職pageはACTIVE query、退職pageはresigned queryをManagerへ渡し、Manager自身はquery/filterを所有しない。searchは300ms delayed inputから親refへemitし、fetch、loading、error、cacheはpage/data layerの責務である。
- `itemsPerPage`と`sortBy`はIteratorで未宣言のためroot iteratorへattrs fallthroughする。一方、`hideDefaultFooter`はIteratorが宣言して消費するがrootへbindしないため、caller指定が描画へ届かない。
- Managerのtoolbar plusは`showCreate=false`でも常時表示する。`showCreate`はIteratorのno-data actionだけを制御するため、在職・退職pageの双方にcreate入口が残る。create/update/deleteのpermission、loading、error、rollbackはAirArrayManagerまたはpageへ委譲される。
- Iteratorの選択はroot iteratorのslot `select()`からEmployeeCardへ結線する。`modelValue`、`selectStrategy`等は未宣言attrsとしてrootへ渡り得るが、JSDocにあるcustom `item`/`footer` slotは実装上forwardされない。
- 一覧の氏名・役職等はEmployeeCardへ委譲し、保険番号・履歴を一覧列には出さない。詳細遷移後は生年月日、住所、国籍、保険等を同じEmployee documentから取得する。

## Insurance現在値・履歴・状態遷移

- Employeeは雇用・健康・厚生年金を各1つのembedded Insurance instanceとして保持する。種別固有fieldはなく、property名で種別を区別する。
- 現在値はstatus、previousStatus、enrollmentDateAt、number、isProcessing。喪失日・理由・退職flagは遷移入力後に初期化され、完了加入の喪失時だけhistory entryへ保存する。
- enroll/enrolled/cancel/exempt/loss/rollbackの前提はschema methodが再検証する。ただしfuture/order date、番号format/length、履歴上限、revision、actor/time/reason auditは検証・記録しない。
- processing中lossはMenuとschemaの双方が許可し履歴をpushする一方、processing中exemptは加入実態なしとして履歴を残さない。Rollbackは末尾entryを破壊的にpopする。
- Rollback previewはDate instanceだけをlocal timezoneの`getFullYear/getMonth/getDate`で表示する。他input/ManagerのJST/dayjs表示とtimezone実装が異なる。

## 保存・失敗・並行性

- `/employees/[id]`は3 Managerの`submit:complete`でそれぞれ`doc.update()`を呼ぶ。component固有のpermission、single-flight、version check、transaction、auditはない。
- Managerの`handleUpdate`は元Insuranceを先に同期mutationする。親のasync event listenerによるFirestore保存が失敗した場合、history push/popを含むローカル状態を戻す処理、再fetch、明示retryは対象componentにない。
- 3 Managerは同じEmployee documentを独立に編集する。別tab・別UserのEmployee全体更新とのmerge/revision guardがなく、保険または他PIIのlost update候補がある。
- inputの状態条件を満たさない場合はalertを出すがsubmit自体のdisableをcomponentで強制しない。schema methodのthrowとAirItemManagerのerror表示・dialog保持に依存する。

## Permission・PII・accessibility

- Employee routeは`employees:read`で到達し、Employees create入口と3 Insurance Managerに追加write permission/disabled判定がない。Rulesは同一会社認証UserへEmployee全field read/writeを許すため、UI guardもserver field allowlistも労務情報を分離しない。
- 被保険者番号、加入/喪失日・理由、履歴はEmployeeの住所・連絡先等と同じdocumentにあり、mask、目的別projection、閲覧監査を持たない。RESIGNED EmployeeでもManagerは操作可能である。
- Employees/Insuranceのplus・vertical menuはicon-onlyでcomponent固有aria-labelを持たない。Rollbackの比較cardは視覚情報中心で、履歴破壊操作の監査情報は提示しない。

## 矛盾・未使用候補・tests

- Insurance Managerは`useDefaults(_props, "EmployeeManager")`、Enrolled inputは先頭空白付き`" InsuranceTransitionInputEnrolled"`を使い、意図したcomponent defaults namespaceと一致しない候補である。
- `Enroll` JSDocのnumber条件は実装と逆、Lossの「LOSSへ遷移」は存在しないstatus、EmployeesIteratorのitem/footer slotとhideDefaultFooterはJSDocと実装が一致しない。
- Input 6ファイルの`updateProperties`はEnroll/Lossのwatch以外で未使用、componentAttrsは確認のみのinputでも公開される。公開契約の統一目的か不要propかはAirItemManager側を未確認のため断定しない。
- 対象11ファイルを直接指定するrepository testは静的検索で見つからなかった。

## 将来要対応・既存台帳への統合

- PII/read-write境界はFUT-0075、保険履歴・validation・rollbackはFUT-0159、一覧API/create/footer/slotはFUT-0170、icon accessibilityはFUT-0115へ証拠を統合する。
- 利用者判断は既存CONF-0061（Employee PII・保険actor/保持/訂正）へ統合し、新しいCONFを追加しない。

## 未確認範囲

- AirArrayManager/AirItemManager/AirDataIterator内部のsubmit待機、event forwarding、loading/error/dialog lifecycle。
- runtimeの二重submit、保存失敗、別tab競合、Rules直接write、既存history品質、行政/給与連携。
