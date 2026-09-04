# Outsourcer（外注先）マスター（実装調査）

## メタデータ

- 状態: 実装調査 / OUT-05 local実装・検証完了
- 対象セグメント: SPEC-SEG-026、SPEC-DEEP-011、SPEC-DEEP-033
- 最終確認日: 2026-09-04
- 根拠ファイル: `pages/outsourcers/index.vue`、`components/Outsourcers/Manager/index.vue`、`components/Outsourcer/CreateDialog.vue`、`components/Outsourcer/Editor.vue`、`composables/application/outsourcer/useOutsourcerActions.js`、`composables/domain/outsourcer/outsourcerOperations.js`、`utils/outsourcer/outsourcerWriter.js`、`utils/outsourcer/outsourcerDocumentContract.js`、`components/Outsourcers/Iterator/index.vue`、`components/Outsourcer/Autocomplete.vue`、`composables/dataLayers/outsourcer/useOutsourcersInRange.js`、`composables/fetch/useFetchOutsourcer.js`、`utils/pageSettings.js`、`firestore.rules`、schemas `src/Outsourcer.js`、`src/Operation.js`、`src/ArrangementNotification.js`、`src/constants/contract-status.js`、client adapter `delete/hasChild`

## 入口・権限

Pageのroute、query、CRUD・状態境界のfile単位確認は[Employee・Outsourcer・Attendance pages deep review](employee-outsourcer-attendance-pages-deep-review.md)を参照する。

対象7 componentのprops/emits、list/card/autocomplete/tagの公開契約、caller、loading/error/accessibilityは[Outsourcer components deep review](outsourcer-components-deep-review.md)を参照する。

## ユーザー確認済み・承認済み方針

- Outsourcerは、ある特定の協力会社を表す会社masterである。外注警備員個人masterではない。
- 配置では同じOutsourcerを別々の明細として複数回登録できる現行方式を維持する。過去に試行して廃止したOutsourcerと人数の集約方式は再採用しない。
- OUT-01では、作成・編集を同社の有効な本登録会社管理者またはstrict `manager`に限定し、client直接deleteとarchive writeを停止した。この暫定停止はOUT-04で通常productの正式な非archive方針になった。
- OUT-02では、exact document、型・長さ、system metadata、部分更新、名称変更時のtoken再生成、独立draftと同一field競合拒否を確定した。
- OUT-03では、statusをCustomerと同じ説明用フラグとし、一覧検索・Autocomplete・配置・稼働実績その他の選択へ影響させない。終了日・理由・履歴や関連dataの自動変更は追加しない。
- OUT-04では、Outsourcerを通常productからarchive／restore／物理deleteせず、live masterとして保持する。現行UI・application action・Rulesがこの契約を満たすため、製品runtimeは変更しない。
- OUT-05では、codeを任意・手動・重複可・検索外とし、通常一覧20件server cursor、名称検索20件memory pagination、外注先専用renderer、契約終了表示を確定・実装した。

- `/outsourcers`はpageSettingsで`outsourcers:read`を要求し、同一tenantの有効な本登録Userのread境界を維持する。
- OUT-01のlocal実装では、一覧Managerと`creatable=true`の`OutsourcerAutocomplete`が同じ純粋policyを使い、会社管理者またはexact `manager`以外へ作成・編集入口を表示しない。create/update transport直前にも同じactor状態を再評価する。
- Managerは全actorへ削除を非表示・無効化し、渡されたdelete handlerを呼ばない。
- Rulesはlive create/updateを同一tenantの有効な本登録会社管理者またはnon-super-userのexact `manager`へ限定し、live deleteとarchive writeを全て拒否する。live/archive readは既存境界を維持する。広いfallbackから両collectionを除外する。
- OUT-05は対象test 25/25、domain 953/953、local Emulator 147/147、専用local UI build、文書検証、独立reviewを完了したlocal実装である。OUT-01/02のRules・保存契約を維持し、Dev/Prod Rulesと実dataは未変更・未確認である。

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

- Managerは専用create/editorとaction/writerを使う。actionはOUT-01のactor policyを保存開始時とtransport直前に再評価する。delete handlerは常に拒否し、既存adapterへ到達させない。
- createはexact 11 fieldだけを保存し、画面でstatusを入力させず`ACTIVE`を強制する。code一意性、名称重複、契約日整合は本範囲で追加しない。
- 更新はtransaction内で最新documentを読み、利用者が変更したfieldだけを保存する。名称系変更時だけtokenMapを追加更新し、変更なしはwrite 0とする。
- 編集draftとbaselineはlive itemから独立させる。同じ変更fieldが外部でも変わった場合はconflictとして保存せず、入力を保持して再読込を促す。別fieldの外部変更は最新値を維持してmergeする。
- contract終了・再開は編集で`contractStatus`を切り替える可逆なフラグ変更である。終了日時・理由・履歴は保存せず、関連dataを自動変更しない。
- schemaの`logicalDelete=true`と既存adapterには同一doc IDを`Outsourcers_archive`へtransactionでcopyしてactive collectionから削除する経路が残るが、OUT-01のUIとRulesからは到達できず、OUT-04で正規経路として使用しないと確定した。

## archive・restore

- 通常の製品UI、application action、Callableにarchive、restore、物理delete入口はない。live Outsourcerは誤登録・重複・取引終了を含めて保持する。
- live deleteとarchive client CUDはRulesで拒否される。既存archiveの同一tenant readは維持する。
- generic adapterの参照guardはSiteOperationSchedulesとOperationResultsだけで、ArrangementNotificationsを含まない。参照確認後の並行参照作成とgeneric restoreのactive同ID上書きも防げないため、正規経路に採用しない。
- 配置予定、稼働実績、配置通知、請求表示、帳票はlive IDを参照する。live保持により名称解決を維持し、新しい参照barrier、archive envelope、restore、migrationを追加しない。
- 将来削除・匿名化が具体的に必要になった場合は、全参照catalog、並行writer、監査、same-ID競合、restore、既存archiveを別checkpointで設計する。[ADR 0050](../decisions/0050-outsourcer-live-retention-without-archive.md)を参照する。

## 検索・状態

- 一覧の通常表示はstatusで絞らず、`nameKana asc`、同値時document ID ascで21件を取得して20件表示する。現在pageだけをlive購読し、前pageのserver cursorは画面内memoryだけに保持する。
- 検索もstatusで絞らず、正規化後2〜40文字の`name`、`nameKana`、`displayName`由来tokenを使う。codeは検索対象外である。検索queryはtoken equalityだけとし、一致結果をlive購読してclientで`nameKana`、document ID順にsortし、20件ずつmemory paginationする。
- 検索入力なしは通常一覧へ戻り、範囲外入力ではqueryを実行せず案内する。作成・更新後は先頭pageへ戻し、読込失敗は表示中pageを維持して再試行できる。重複loadと古いlistener callbackは反映しない。
- 配置用`useOutsourcersInRange`は全statusをlive購読する。引数`from/to`はvalidity確認と再購読triggerにだけ使い、期間filterしない。
- 汎用Autocompleteも追加status条件を渡さず、ACTIVE／TERMINATEDの双方を候補にする。正規化後2〜40文字だけを検索し、最大50件取得と外注先専用ListItemを使う。保存済み配置・実績のID直接取得もstatusを条件にしない。

## 所属関係

- 現行モデルは外注会社（外注先）だけを表し、「外注警備員」個人のcollection/classは確認できない。
- 外注先と個人警備員の所属、一意な個人ID、氏名、資格、連絡先、在籍/契約状態を管理する契約は存在しない。
- Schedule/OperationResultの`outsourcers`はOperationDetail配列で、`id`にOutsourcer doc ID、`isEmployee=false`を持つ。同じ外注先を複数人配置するとindexを増やし、workerIdは`outsourcerId:index`となる。これは個人の永続IDではない。

## 下流参照

- SiteOperationScheduleとOperationResultは`outsourcers`の埋込みOperationDetailと、そこから保存される読み取り専用`outsourcerIds`を持つ。名称等のOutsourcer master全体をsnapshotする契約ではなく、表示側はIDからlive masterを取得する箇所がある。
- ArrangementNotificationは`id`、`index`、`isEmployee=false`を引き継ぎ、`outsourcerId`を導出する。通知ごとのworkerIdはindexを含む。
- masterの名称・略称変更はID参照表示へ反映され得る一方、既存Schedule/ResultのOperationDetailを一括更新する処理は本範囲にない。
- masterをarchiveするとlive pathのID取得は失敗し得る。過去データが名称snapshotを持つかは利用先ごとに異なり、本調査では内部へ進んでいない。

## 削除・archive

- 既存adapterの`hasMany` guardはSiteOperationSchedulesとOperationResultsの`outsourcerIds array-contains docId`を検索し、1件でもあれば削除を拒否する。ただしOUT-01ではclient delete自体を停止しており、このguardは通常UIから実行されない。
- ArrangementNotificationsはhasMany対象外で、通知だけが残る場合の削除guardはない。
- guard queryはdelete transaction外の`getDocs`であり、確認直後の並行参照作成との競合余地がadapter自身のコメントに明記される。
- archiveのRulesは同一tenantの有効な本登録Userのreadだけを維持し、client writeを全拒否する。復元UIと終了からarchiveへの手順は設けない。法令・運用上の削除または匿名化が将来必要になった場合の保持条件は別checkpointで決める。

## Rules・tenant・security

- path tenant境界はcompany claimで制限されるが、documentにcompanyId fieldはなく、所属はpathだけで表現する。
- 同一会社の有効な本登録Userは一覧と備考を含むlive/archiveを読める。live書込みは会社管理者またはexact `manager`だけで、archive直接改変は全clientで拒否する。
- 現行schemaに個人外注警備員の機微情報はない。将来追加する場合は会社masterと個人情報を同じ広いRulesに載せない設計が必要となる。
- Rulesはexact 11 field、型・長さ、`ACTIVE/TERMINATED`、create時ACTIVE、path一致docId、actor uid、request時刻、docId/createdAt不変、変更可能fieldと名称変更時のtokenMap条件を強制する。tokenMapの件数・値は検証するが、名称との意味的一致まではRulesで完全再計算できない。live deleteとarchive writeは引き続き拒否する。

## 矛盾・未使用候補

- Outsourcerは協力会社masterであり、外注警備員個人masterは持たない。同一会社の重複配置は明細indexで区別する現行契約で、人数集約方式は採用しない。
- `useOutsourcersInRange`の`from/to`は期間選定に未使用で、契約開始/終了日fieldも設けない。
- `OutsourcerAutocomplete`のdefault item slotは`EmployeeListItem`を描画しており、名称表示は動作し得るが型・責務上の取り違え候補である。
- `OutsourcerListItem`は静的callerを確認できず、Autocompleteのdefault rendererにも使われないlegacy候補である。Nuxt auto-registration等の動的到達性は未確認のため、未使用とは断定しない。
- 一覧query limit 10とManager itemsPerPage 20が不一致。
- OUT-01前はManagerのtoolbar plusが`showCreate=false`でも表示された。OUT-01後はwrite actorにだけ表示する。Iteratorのdeclared `hideDefaultFooter`がrootへ渡らない点は未変更である。
- codeは一覧header・sortに使うがtoken検索対象外かつ任意・非一意である。

## 将来要対応

- FUT-0085〜FUT-0089を`future-actions.md`へ登録した。

## 要確認事項

- CONF-0070はOUT-01の作成・編集actorとclient破壊操作停止まで部分回答、CONF-0071は協力会社master・重複配置維持、CONF-0072は通常productでarchive／restore／物理deleteを提供しない方針、CONF-0073はcode・検索・pagination・表示契約として回答済みである。OUT-02の保存data契約、OUT-03のstatus非制限、OUT-05の検索表示も確定・local実装済みである。

## 未確認範囲

- 実データの重複、archive、参照件数、既存の外注警備員管理運用。
- Schedule、ArrangementNotification、OperationResultの業務処理本文と帳票表示。
- Dev/Prodでの旧client併存、既存document適合性、複数browserによる同時操作の実UI再現、復元用保守手順。
