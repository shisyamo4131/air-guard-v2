# Employee・Outsourcer・Attendance pages deep review

## メタデータ

- 状態: 実装調査
- 対象チェックポイント: SPEC-DEEP-011
- 最終確認日: 2026-08-11
- 対象: `pages/employees/**`、`pages/outsourcers/**`、`pages/attendances/**`の6ファイル
- 境界: 直接manager/data facadeだけを照合し、schema・Rules・child全体・runtimeは再調査していない。

## route・権限・データ

| route | pageSettings | query / 表示 | 操作 |
| --- | --- | --- | --- |
| `/employees` | `employees:read` | ACTIVE Employee、検索、氏名カナ昇順、全件表示 | create、detail遷移 |
| `/employees/resigned` | `employees:read` | search非空時だけRESIGNED検索 | detail遷移。共通managerのcreate UIも残る |
| `/employees/[id]` | `employees:read` | 基本・国籍・User・3保険・警備員情報・資格 | 各field update、退職、User管理、delete |
| `/outsourcers` | `outsourcers:read` | ACTIVE、空検索updatedAt desc/limit 10、検索時code desc | inline create/update/delete |
| `/attendances` | `developer` | Company modeによりDailyAttendanceまたはDailyOperationsByEmployee、月・全従業員・calendar/statistics | 表示のみ |
| `/attendances/export` | `developer` | 月次DailyAttendance、従業員、打刻preview・除外 | browser CSV download |

全pageは独自`definePageMeta`を持たずpageSettings/global middlewareに依存する。Employee/Outsourcerはread permissionだけでmutation UIへ到達する。Attendanceはdeveloper固定で、本人自己閲覧・同社勤怠管理者という確認済み将来境界を実装していない。

## Employee・PII・雇用状態

ACTIVE一覧は`useDocuments`で全件取得し、managerへ`items-per-page=-1`を渡す。氏名、カナ等を一覧表示し、取得limit/paginationを設けない。page固有loading/errorはない。

退職者検索はwatchごとに非同期fetchし、空検索は0件とする。loading/error/cancel/request generationがなく、連続検索の古い応答が新結果を上書きし得る。共通`EmployeesManager`はplus/create actionを常時描画するため、退職者検索routeでも新規Employee作成入口が表示される。

詳細はroute paramをsetup時に固定し、EmployeeとemployeeId一致Userを別経路で購読する。基本住所・連絡先、国籍、保険、警備員登録、資格というPII/労務情報を同一`employees:read` routeで表示・編集する。本人用field projectionや労務担当限定はない。

RESIGNED時はalertを表示し、退職buttonとUserManagerだけを隠すが、基本・国籍・保険・警備員・資格updateとdeleteは残る。退職/delete buttonのdisabledはlinked `userDocs[0]`でなく空の基底`user.isAdmin`を参照するため、紐付Userがadminでも保護が働かない候補である。delete dialogは在職中と断定し、RESIGNED detailでも同じ文言を表示する。route param変更watch、not-found、page loading/errorはない。

## Outsourcer

ACTIVE constraintに空検索時updatedAt desc/limit 10、検索時code descを加える。manager page sizeは20なので空検索では10件しか取得せず20件表示設定と一致しない。独立detail routeはなく、manager内でcreate/update/deleteする。`outsourcers:read`とmutation guardは分離されない。終了/archive/restore専用routeはなく、page自身はloading/error/double-submitを管理しない。

## Attendance・self/manager・export

`/attendances`は`useFetch`をorigin provideし、Companyの`attendanceManagementMode`をchildへ渡す。modeをcomponent keyにも使うため変更時にIndexを再mountする。Indexは全従業員を左paneへ並べ、選択者の月次calendar/statisticsを表示する。caller UIDとemployeeIdの自己限定はpageにない。

月変更queryのloadingはemployee選択resetにだけ使われ、page/Indexには明示loading/error/retry UIがない。固定幅196px employee pane、中央calendar、300px summaryを横並びにし、mobile分岐はない。現画面に手動create/edit/delete、休暇・振休等の操作はない。

Export pageもdeveloper固定で、全従業員のcode/name、打刻日時、除外理由をpreviewする。employee取得中または0行ならbuttonをdisable/loadingにするが、CSV生成/download中のsingle-flight、error feedback、permission再確認、個人情報持出し確認・auditはない。file作用はchild utilityがbrowser downloadとして実行し、page自身は外部送信しない。

## navigation・cleanup・error

- Employee create/detail、退職/delete完了はrouter push/replaceする。Outsourcerは同一page内編集、Attendanceは同一page内月/従業員選択である。
- Employee detailのUser subscriptionだけ明示unsubscribe/initializeする。data-layer購読はcomposable lifecycleへ依存する。
- Employee/Outsourcer CRUDのloading/error/validationはAir manager、Attendance query errorはdata/application composableへ委ねられ、page単位のerror boundaryはない。
- 6pageにroute leave時のdirty guard、page-level retry、二重submit latchはない。

## 矛盾・未使用候補・テスト

- `employees:read`/`outsourcers:read`だけでcreate/update/delete/退職へ到達する。
- linked admin User保護が`userDocs[0].isAdmin`でなく初期instanceを参照する候補がある。
- 退職者routeにもcreate action、RESIGNED detailにも多くのedit/delete actionが残る。
- Outsourcer limit 10とpage size 20が不一致。
- Employee page末尾に空のCOMPUTED sectionがある。
- Attendance Indexのcomment outされたEmployeeSelect blockは現routeから未到達。
- 6 pageを直接対象とするroute/component testは静的検索で確認できなかった。

## 台帳対応

- Employee: FUT-0075、0077、0078。PII read/write、退職後操作、admin-linked delete guard。
- Outsourcer: FUT-0085、0087、0088。read/write、ACTIVE/終了/archive、query/page size。
- Attendance: FUT-0039、0040、0130、0131。self/manager/Functions ownership、query race/error、responsive、CSV PII/検証。
- 新規FUT/CONFは追加しない。既存のactor・保持・勤怠workflow判断はコード事実だけでは解消しない。

## 未確認範囲

Rules/schemaの再読、Air manager内部、User subscription返却型のruntime挙動、実data量、CSV実生成、browser、Emulator、freee取込、responsive/accessibilityは未確認である。
