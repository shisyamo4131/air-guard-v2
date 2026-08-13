# Employee certification / custom-input components deep review

## メタデータ

- 状態: 実装調査（SPEC-DEEP-026、deep-reviewed）
- 最終確認日: 2026-08-11
- 対象: `components/Employee/Certifications/**`、`CustomInput/**`、`Tag/**` の7ファイル
- 根拠: 対象7ファイル、直接callerの `pages/employees/[id].vue`・`components/Employees/Manager/index.vue`・`components/Arrangements/WorkerSelector.vue`、直接schemaの `Certification`・`Employee`、既存manager/tag/fetch契約
- 関連: [Qualification management](qualification-management.md)、[Employee master](employee-master.md)、[Employee components deep review](employee-components-deep-review.md)

## component / public API

| ファイル | props / emits / 公開契約 | mutation・状態境界 |
| --- | --- | --- |
| `Certifications/Manager/index.vue` | props/emitsを独自定義せずattrsを`air-array-manager`へ透過し、schema `Certification`・item key `key`を設定する。 | toolbar plusで`toCreate()`、tableの`click:update`を`toUpdate(item)`へ渡す。delete、loading、error、permission、rollbackは基底managerに委譲する。 |
| `Certifications/Table.vue` | headers、itemsPerPage（既定5）、sortBy（name昇順）。`items`とlistenerはdeclared propsでなくroot `air-data-table`へのattrs fallthroughに依存する。 | typeを列表示せず、name、取得/期限、番号/発行元だけをJST日付文字列で表示する。mobileは1件/page。更新/削除controlを自ら描画しない。 |
| `CustomInput/Resignation.vue` | required `componentAttrs`。入社日readonly、退職日、理由をmanager editorへ結線する。 | client ruleは退職日>=入社日。Date型・理由・admin/User cleanup・confirmation/rollbackはEmployee model/親manager側に委譲する。 |
| `CustomInput/SecurityGuard.vue` | 空ファイルでprops、template、exportなし。 | repository内のstatic import/callerなし。unused/stub候補。 |
| `CustomInput/ToRegist.vue` | `componentAttrs`（既定空object）へ基本Employee fieldのinputを結線する。 | Employee create用にEmployeesManagerが指定する。status、User link、insurance、certification、警備員登録PIIはこのformに含まない。保存/validation/errorはmanager/modelへ委譲する。 |
| `Tag/index.vue` | required `docId`とTag継承props、`click:remove`、複数slotを公開する。 | Label取得をuseIndexへ委譲し、remove actionだけemitする。Employee status/qualification/PIIを表示しない。 |
| `Tag/useIndex.js` | `props.docId`をwatchし、Employee fetch cacheからdisplayNameをlabelにする。 | docId変更時にfetchを起動するが、local loading/error/retry/race guardは持たない。label未解決時のloading表現はTag側契約に依存する。 |

## Certificationデータ契約・編集

- CertificationはEmployee document内の`securityCertifications[]`に埋込み保存され、`name`、`type`、`issueDateAt`がrequired、`issuedBy`、`expirationDateAt`、`serialNumber`が任意である。読み取り専用`key`は可変の`name`をそのまま返す。
- Managerはname keyでarray editを開始する。renameはarray identityを変え、同名、同serial、issue>expiration、失効、取消、更新履歴をmodel/UIで検証・表示しない。Tableはtypeを表示しないため、同名に別type/級/発行元が存在するかを一覧から判断できない。
- employee detailは`EmployeeCertificationsManager v-model="doc.securityCertifications"`の`submit:complete`で`doc.update()`する。資格配列とEmployee基本PII更新は同じEmployee document保存境界であり、独立transaction・audit・conflict resolutionはない。
- Tableに明示delete UIはなく、delete可否と編集dialogのrow actionはAirArrayManager/AirDataTableのattrs/event契約に委ねる。この外部componentの実際のkeyboard/delete/failure behaviorは今回確認していない。
- Schedule/notification/resultの`isQualified`は保有Certification type、期限、serialを参照せず手動booleanである。Manager/Tableの入力は配置適格性を自動計算しない。

## Employee input・退職・PII

- ToRegistはcode、氏名/カナ、display name/カナ、肩書、gender、生年月日、自宅住所、mobile、email、入社日を入力する。statusはformで選ばずmodel defaultを使う。Employee schemaがrequired、外国籍/警備員依存field初期化、geocoding、create validationを担う。
- Resignationは入社日をreadonlyにし、日付・理由入力と「在職中に戻せない」警告を出す。future dateでも即RESIGNEDとなるmodel契約、admin Userの拒否、User deleteとEmployee rollbackはcomponent外である。
- SecurityGuard custom inputは空で、実際の警備員PII編集はemployee detailでActivator SecurityGuardをgeneric EmployeeManagerに渡す経路で行われる。血液型、緊急連絡先、本籍への専用input/confirmationの存在はこの7ファイルから確認できない。
- これらの入力componentにpermission、loading latch、double-submit防止、error message、local rollbackはない。`employees:read`到達性と広いRules writeは正式なPII権限設計ではない。

## Tag・caller・accessibility・未使用候補

- EmployeeTagはArrangements WorkerSelectorとWorker Tag wrapperから到達し、docIdでEmployeeをfetchしてdisplayNameだけを表示する。資格・OJT・statusは親slot/variantの責務である。
- `v-btn icon="mdi-plus"`、Tag inherited remove/drag actionはcomponent固有のaria-labelを追加しない。Certification tableにはcaption、type列、empty/error textを確認できない。
- SecurityGuard custom inputは空かつstatic callerなし、EmployeeTagのfetch失敗/遅延とCertification delete actionはruntime未確認である。対象7ファイルを直接指定するtestはrepository静的検索で見つからなかった。

## 将来要対応・既存台帳への統合

- 保有資格と配置booleanの不連携は [FUT-0124](future-actions.md#fut-0124-保有資格から配置資格判定へ追跡可能な契約を設ける)、mutable name key・期限・type非表示・更新履歴は [FUT-0125](future-actions.md#fut-0125-certificationのidentity重複期限状態を堅牢化する) に統合する。
- 資格番号、警備員登録、緊急連絡先/本籍の閲覧編集境界は [FUT-0126](future-actions.md#fut-0126-従業員資格機微情報の操作別権限と監査を実装する)、icon/Tag accessibilityは [FUT-0115](future-actions.md#fut-0115-共通icon操作とdrag-uiのaccessibilityを整備する) に統合する。
- 新しい利用者判断は追加しない。資格要件/overrideはCONF-0103、資格identity/期限/historyはCONF-0104、機微情報actorはCONF-0105を維持する。
