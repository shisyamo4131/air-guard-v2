# Outsourcer（外注先）マスター（実装調査）

## メタデータ

- 状態: FGA-05通常保存整合のLocal実装・検証完了 / Dev未反映
- 対象セグメント: SPEC-SEG-026、SPEC-DEEP-011、SPEC-DEEP-033
- 最終確認日: 2026-09-12
- 根拠ファイル: `pages/outsourcers/index.vue`、`components/Outsourcer/Manager/index.vue`、`components/Outsourcers/Manager/index.vue`、`components/Outsourcer/CustomInput.vue`、`components/Outsourcers/Iterator/index.vue`、`components/Outsourcer/Autocomplete.vue`、`composables/dataLayers/outsourcer/useOutsourcerListPagination.js`、`composables/dataLayers/outsourcer/useOutsourcersInRange.js`、`composables/fetch/useFetchOutsourcer.js`、`utils/pageSettings.js`、`firestore.rules`、`test/domain/outsourcer-ui-source-contract.test.mjs`、`test/local/codex-local-harness.test.mjs`、schemas `src/Outsourcer.js`、client adapterの標準`create`／`update`

## 入口・権限

Pageのroute、query、CRUD・状態境界のfile単位確認は[Employee・Outsourcer・Attendance pages deep review](employee-outsourcer-attendance-pages-deep-review.md)を参照する。

対象7 componentのprops/emits、list/card/autocomplete/tagの公開契約、caller、loading/error/accessibilityは[Outsourcer components deep review](outsourcer-components-deep-review.md)を参照する。

## ユーザー確認済み・承認済み方針

- Outsourcerは、ある特定の協力会社を表す会社masterである。外注警備員個人masterではない。
- 配置では同じOutsourcerを別々の明細として複数回登録できる現行方式を維持する。過去に試行して廃止したOutsourcerと人数の集約方式は再採用しない。
- OUT-01で採用した会社管理者またはstrict `manager`への作成・編集制限は、FGA-05で通常業務のtenant共通権限へ置換した。client直接deleteとarchive writeの停止は維持する。
- OUT-02で採用した部分更新、独立dialog、同一field競合拒否は、FGA-05でmodel標準保存とdocument単位last-write-winsへ置換した。項目・型・長さはmodelが検査する。
- OUT-03では、statusをCustomerと同じ説明用フラグとし、一覧検索・Autocomplete・配置・稼働実績その他の選択へ影響させない。終了日・理由・履歴や関連dataの自動変更は追加しない。
- OUT-04では、Outsourcerを通常productからarchive／restore／物理deleteせず、live masterとして保持する。現行UI・application action・Rulesがこの契約を満たすため、製品runtimeは変更しない。
- OUT-05では、codeを任意・手動・重複可・検索外とし、通常一覧20件server cursor、名称検索20件memory pagination、外注先専用renderer、契約終了表示を確定・実装した。
- OUT-06では、通常UIの一配置を`amount=1`の独立明細とし、raw `id`はmaster取得、`workerId`は行・mutation・通知identityへ使う契約を固定した。削除後にindexを詰めず、再追加は最大index+1、並べ替えと実績化は明細identityを維持する。WorkersTableのVue keyを`worker.id`から`worker.workerId`へ修正した。

- `/outsourcers`はpageSettingsで`outsourcers:read`を要求する既存のnavigation UXを維持する。到達後の通常作成・編集とAutocomplete内作成はroleで制限しない。
- 単数`OutsourcerManager`は`AirItemManager`、複数形`OutsourcersManager`は`AirArrayManager`を包み、前者は一つのOutsourcer instance、後者は全要素がOutsourcer instanceの配列を受け取る。
- Managerは全actorへ削除を非表示・無効化し、渡されたdelete handlerを呼ばない。
- Rulesはlive create/updateを同一tenantの有効な本登録Userへrole非依存で許可し、actor UIDの一致を要求する。live deleteとarchive writeは全て拒否し、live/archive readの既存tenant境界を維持する。
- OUT-05は対象test 25/25、domain 953/953、local Emulator 147/147、専用local UI build、文書検証、独立reviewを完了したlocal実装である。OUT-01/02のRules・保存契約を維持し、Dev/Prod Rulesと実dataは未変更・未確認である。
- OUT-06は対象test 48/48、domain 961/961、専用local UI build、文書検証、独立reviewを完了したlocal実装である。Rules・index・schema・package・migration・dataは変更していないため、local Emulator suiteはverification policyに基づき省略した。
- FGA-05では通常CREATE・UPDATEを共通Managerとmodel標準保存へ戻し、role制限、専用writer、部分transaction、競合拒否を撤去した。対象test 8件、domain 1,448件、Local Emulator 178件、固定commit `fed8449e`の専用Local UI buildに合格した。Dev／Prodとremote dataは未変更である。

## データ契約

| 項目 | 実装契約 |
|---|---|
| path | `Companies/{companyId}/Outsourcers/{docId}`。doc IDは自動生成、独自採番なし |
| `code` | 任意の手動入力。表示上「外注先コード」。英数字入力、最大10文字の共通field定義。重複可、自動採番・一意制約・検索対象なし |
| `name` | 必須、最大20文字。検索token対象 |
| `nameKana` | 必須、最大40文字。検索token対象 |
| `displayName` | 必須。略称。共通定義は最大6文字 |
| `contractStatus` | 必須。default `ACTIVE`。値候補は`ACTIVE`（契約中）/`TERMINATED`（契約終了） |
| `remarks` | 任意。共通複数行定義は最大200文字 |
| `tokenMap` | nullまたは最大512件のmap。各値はtrue。name/nameKana/displayName変更時に正規writerが再生成する |
| system fields | `docId`はpathと一致、`uid`は実行者、`createdAt/updatedAt`はrequest時刻。更新時はdocId/createdAtを不変とする |

会社住所、担当者、電話/email、契約開始・終了日、外注警備員個人、資格、個人連絡先、所属IDはOutsourcer schemaに存在しない。

## CRUD・validation

- Managerはbase Managerの既定dialog、draft、validation、mode、error処理を使い、Outsourcer modelの標準`create()`／`update()`を直接呼ぶ。delete handlerは常に拒否し、既存adapterのdeleteへ到達させない。
- createは画面でstatusを入力させず、Outsourcer modelの既定`ACTIVE`で保存する。code一意性、名称重複、契約日整合は追加しない。
- 更新は編集したOutsourcer document全体を保存する。先に保存された別画面の変更を理由に拒否せず、後の保存内容へ置き換えるdocument単位last-write-winsである。保存後はlistenerの最新documentへ収束する。
- contract終了・再開は編集で`contractStatus`を切り替える可逆なフラグ変更である。終了日時・理由・履歴は保存せず、関連dataを自動変更しない。
- schemaの`logicalDelete=true`と既存adapterには同一doc IDを`Outsourcers_archive`へtransactionでcopyしてactive collectionから削除する経路が残るが、OUT-01のUIとRulesからは到達できず、OUT-04で正規経路として使用しないと確定した。

## archive・restore

- 通常の製品UI、application action、Callableにarchive、restore、物理delete入口はない。live Outsourcerは誤登録・重複・取引終了を含めて保持する。
- live deleteとarchive client CUDはRulesで拒否される。既存archiveの同一tenant readは維持する。
- generic adapterの参照guardはSiteOperationSchedulesとOperationResultsだけで、ArrangementNotificationsを含まない。参照確認後の並行参照作成とgeneric restoreのactive同ID上書きも防げないため、正規経路に採用しない。
- 配置予定、稼働実績、配置通知、請求表示、帳票はlive IDを参照する。live保持により名称解決を維持し、新しい参照barrier、archive envelope、restore、migrationを追加しない。
- 将来削除・匿名化が具体的に必要になった場合は、全参照catalog、並行writer、監査、same-ID競合、restore、既存archiveを別checkpointで設計する。[ADR 0050](../decisions/0050-outsourcer-live-retention-without-archive.md)を参照する。

## 検索・状態

- 一覧の通常表示はstatusで絞らず、`updatedAt desc`、同値時document ID descで21件を取得して20件表示する。現在pageだけをlive購読し、前pageのserver cursorは画面内memoryだけに保持する。
- 検索もstatusで絞らず、正規化後1〜40文字の`name`、`nameKana`、`displayName`由来tokenを使う。codeは検索対象外である。検索queryはtoken equalityだけとし、一致結果をlive購読してclientで`nameKana`、document ID順にsortし、20件ずつmemory paginationする。
- 検索入力なしは通常一覧へ戻り、範囲外入力ではqueryを実行せず案内する。作成・更新後は先頭pageへ戻し、読込失敗は表示中pageを維持して再試行できる。重複loadと古いlistener callbackは反映しない。
- 配置用`useOutsourcersInRange`は全statusをlive購読する。引数`from/to`はvalidity確認と再購読triggerにだけ使い、期間filterしない。
- 汎用Autocompleteも追加status条件を渡さず、ACTIVE／TERMINATEDの双方を候補にする。正規化後1〜40文字だけを検索し、最大50件取得と外注先専用ListItemを使う。作成導線は単数`OutsourcerManager`を使い、保存したinstanceをcacheへ加える。保存済み配置・実績のID直接取得もstatusを条件にしない。

## 所属関係

- 現行モデルは外注会社（外注先）だけを表し、「外注警備員」個人のcollection/classは確認できない。
- 外注先と個人警備員の所属、一意な個人ID、氏名、資格、連絡先、在籍/契約状態を管理する契約は存在しない。
- Schedule/OperationResultの`outsourcers`はOperationDetail配列で、`id`にOutsourcer doc ID、`isEmployee=false`を持つ。同じ外注先を複数人配置するとindexを増やし、workerIdは`outsourcerId:index`となる。これは個人の永続IDではない。

## 下流参照

- SiteOperationScheduleとOperationResultは`outsourcers`の埋込みOperationDetailと、そこから保存される読み取り専用`outsourcerIds`を持つ。名称等のOutsourcer master全体をsnapshotする契約ではなく、表示側はIDからlive masterを取得する箇所がある。
- ArrangementNotificationは`id`、`index`、`isEmployee=false`を引き継ぎ、`outsourcerId`を導出する。通知ごとのworkerIdはindexを含む。
- ArrangementNotificationのdocument IDはschedule IDと`workerId`の組であり、同じOutsourcerの重複配置を個別に扱う。ScheduleからOperationResultへの変換は各OperationDetailをmapし、重複排除や人数集約を行わない。
- masterの名称・略称変更はID参照表示へ反映され得る一方、既存Schedule/ResultのOperationDetailを一括更新する処理は本範囲にない。
- masterをarchiveするとlive pathのID取得は失敗し得る。過去データが名称snapshotを持つかは利用先ごとに異なり、本調査では内部へ進んでいない。

## 削除・archive

- 既存adapterの`hasMany` guardはSiteOperationSchedulesとOperationResultsの`outsourcerIds array-contains docId`を検索し、1件でもあれば削除を拒否する。ただしOUT-01ではclient delete自体を停止しており、このguardは通常UIから実行されない。
- ArrangementNotificationsはhasMany対象外で、通知だけが残る場合の削除guardはない。
- guard queryはdelete transaction外の`getDocs`であり、確認直後の並行参照作成との競合余地がadapter自身のコメントに明記される。
- archiveのRulesは同一tenantの有効な本登録Userのreadだけを維持し、client writeを全拒否する。復元UIと終了からarchiveへの手順は設けない。法令・運用上の削除または匿名化が将来必要になった場合の保持条件は別checkpointで決める。

## Rules・tenant・security

- path tenant境界はcompany claimで制限されるが、documentにcompanyId fieldはなく、所属はpathだけで表現する。
- 同一会社の有効な本登録Userは一覧と備考を含むlive/archiveを読める。live通常書込みもrole非依存で許可し、archive直接改変は全clientで拒否する。
- 現行schemaに個人外注警備員の機微情報はない。将来追加する場合は会社masterと個人情報を同じ広いRulesに載せない設計が必要となる。
- Rulesは同一tenantの有効な本登録Userとactor UIDを通常write境界とし、項目・型・長さ・状態・通常metadata・tokenMapはOutsourcer modelへ委ねる。これにより正規applicationを介さない同一tenant requestの項目汚染はRules単独では防がない。これはADR 0065で受け入れた通常master共通境界である。live deleteとarchive writeは引き続き拒否する。

## 矛盾・未使用候補

- Outsourcerは協力会社masterであり、外注警備員個人masterは持たない。同一会社の重複配置は明細indexで区別する現行契約で、人数集約方式は採用しない。
- `useOutsourcersInRange`の`from/to`は期間選定に未使用で、契約開始/終了日fieldも設けない。
- OUT-05で`OutsourcerAutocomplete`は専用`OutsourcerListItem`を使うようになり、通常一覧と検索結果はどちらも20件単位、Iteratorは`hideDefaultFooter`と件数設定を内部iteratorへ転送する。OUT-05以前の調査記述は現行実装には該当しない。
- codeは一覧の識別表示に使うが、sort・token検索対象ではなく任意・非一意である。
- schemaの低レベル`addWorker`はcallerが渡した`amount`を受け入れる。通常UIは`amount`を渡さず既定値1となるが、全callerでの`amount=1`強制は未実装である。package・Rules・data validationへ広げる場合は別承認を要する。

## 将来要対応

- FUT-0085〜FUT-0089を`future-actions.md`へ登録した。

## 要確認事項

- CONF-0070はOUT-01の作成・編集actorとclient破壊操作停止まで部分回答、CONF-0071は協力会社master・重複配置維持、CONF-0072は通常productでarchive／restore／物理deleteを提供しない方針、CONF-0073はcode・検索・pagination・表示契約として回答済みである。OUT-02の保存data契約、OUT-03のstatus非制限、OUT-05の検索表示、OUT-06の配置identityも確定・local実装済みである。

## 未確認範囲

- 実データの重複、archive、参照件数、既存の外注警備員管理運用。
- 実Firestore transaction上の通知作成・実績化、実browser DOM、帳票表示。
- Dev/Prodでの旧client併存、既存document適合性、複数browserによる同時操作の実UI再現、復元用保守手順。
- FGA-05のDev反映とCodex専用tenantでの作成・更新・再読込・見た目確認。
