# Outsourcer（外注先）マスター（実装調査）

## メタデータ

- 状態: 実装調査 / OUT-01 local実装・検証完了
- 対象セグメント: SPEC-SEG-026、SPEC-DEEP-011、SPEC-DEEP-033
- 最終確認日: 2026-09-04
- 根拠ファイル: `pages/outsourcers/index.vue`、`components/Outsourcers/Manager/index.vue`、`components/Outsourcers/Iterator/index.vue`、`components/Outsourcer/Autocomplete.vue`、`components/Outsourcer/Card/index.vue`、`components/Outsourcer/ListItem/index.vue`、`composables/dataLayers/outsourcer/useOutsourcersInRange.js`、`composables/fetch/useFetchOutsourcer.js`、`utils/pageSettings.js`、`firestore.rules`、schemas `src/Outsourcer.js`、`src/Operation.js`、`src/ArrangementNotification.js`、`src/constants/contract-status.js`、client adapter `delete/hasChild`

## 入口・権限

Pageのroute、query、CRUD・状態境界のfile単位確認は[Employee・Outsourcer・Attendance pages deep review](employee-outsourcer-attendance-pages-deep-review.md)を参照する。

対象7 componentのprops/emits、list/card/autocomplete/tagの公開契約、caller、loading/error/accessibilityは[Outsourcer components deep review](outsourcer-components-deep-review.md)を参照する。

## ユーザー確認済み・承認済み方針

- Outsourcerは、ある特定の協力会社を表す会社masterである。外注警備員個人masterではない。
- 配置では同じOutsourcerを別々の明細として複数回登録できる現行方式を維持する。過去に試行して廃止したOutsourcerと人数の集約方式は再採用しない。
- OUT-01では、作成・編集を同社の有効な本登録会社管理者またはstrict `manager`に限定し、client直接deleteとarchive writeを停止する。archive/restoreの正式運用は未決定である。

- `/outsourcers`はpageSettingsで`outsourcers:read`を要求し、同一tenantの有効な本登録Userのread境界を維持する。
- OUT-01のlocal実装では、一覧Managerと`creatable=true`の`OutsourcerAutocomplete`が同じ純粋policyを使い、会社管理者またはexact `manager`以外へ作成・編集入口を表示しない。create/update transport直前にも同じactor状態を再評価する。
- Managerは全actorへ削除を非表示・無効化し、渡されたdelete handlerを呼ばない。
- Rulesはlive create/updateを同一tenantの有効な本登録会社管理者またはnon-super-userのexact `manager`へ限定し、live deleteとarchive writeを全て拒否する。live/archive readは既存境界を維持する。広いfallbackから両collectionを除外する。
- OUT-01はdomain 927/927、local Emulator 146/146、専用local UI build、独立security/code reviewを完了したlocal実装である。Dev/Prod Rulesと実dataは未変更・未確認である。field、status、document shapeはまだRulesで強制せず、OUT-02へ残す。

## データ契約

| 項目 | 実装契約 |
|---|---|
| path | `Companies/{companyId}/Outsourcers/{docId}`。doc IDは自動生成、独自採番なし |
| `code` | 任意。表示上「外注先コード」。英数字入力、最大10文字の共通field定義。重複検証なし |
| `name` | 必須。外注先名 |
| `nameKana` | 必須。検索token対象 |
| `displayName` | 必須。略称。共通定義は最大6文字 |
| `contractStatus` | 必須。default `ACTIVE`。値候補は`ACTIVE`（契約中）/`TERMINATED`（契約終了） |
| `remarks` | 任意。共通複数行定義は最大200文字 |
| system fields | FireModelのdocId、作成・更新時刻等。Outsourcer固有の読み取り専用プロパティ/getterはない |

会社住所、担当者、電話/email、契約開始・終了日、外注警備員個人、資格、個人連絡先、所属IDはOutsourcer schemaに存在しない。

## CRUD・validation

- Managerは認可再評価後に既存の`item.create(item)`と`item.update(item)`へ委譲する。delete handlerはOUT-01で常に拒否し、既存adapterへ到達させない。
- `name`、`nameKana`、`displayName`、`contractStatus`のみrequired。code一意性、名称重複、status遷移、契約日整合のOutsourcer固有validationはない。
- 更新はdocument全体の通常updateで、revision/version/preconditionをUIから渡さない。複数User同時編集は後勝ちになり得る。
- contract終了は専用methodではなく、編集で`contractStatus=TERMINATED`にするだけである。終了日時・理由・履歴は保存しない。
- schemaの`logicalDelete=true`と既存adapterには同一doc IDを`Outsourcers_archive`へtransactionでcopyしてactive collectionから削除する経路が残るが、OUT-01のUIとRulesからは到達できない。

## 検索・状態

- 一覧の通常表示は`contractStatus=ACTIVE`、`updatedAt desc`、limit 10。画面側DataIteratorは20件設定で、query limitとの値が一致しない。
- 検索時もACTIVE条件を維持し、token検索後`code desc`を使用する。tokenFieldsは`name`、`nameKana`、`displayName`で、codeはtoken検索対象外。
- 配置用`useOutsourcersInRange`もACTIVEだけをlive購読するが、引数`from/to`はvalidity確認と再購読triggerにだけ使い、期間filterしない。
- 汎用AutocompleteのN-gram検索は追加status条件を渡さないため、利用箇所によってはTERMINATED外注先が候補へ到達し得る。

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
- archiveのRulesは同一tenantの有効な本登録Userのreadだけを維持し、client writeを全拒否する。復元UI、終了からarchiveへの正式手順、保持/匿名化policyは未決定である。

## Rules・tenant・security

- path tenant境界はcompany claimで制限されるが、documentにcompanyId fieldはなく、所属はpathだけで表現する。
- 同一会社の有効な本登録Userは一覧と備考を含むlive/archiveを読める。live書込みは会社管理者またはexact `manager`だけで、archive直接改変は全clientで拒否する。
- 現行schemaに個人外注警備員の機微情報はない。将来追加する場合は会社masterと個人情報を同じ広いRulesに載せない設計が必要となる。
- client-side requiredはまだRulesで強制されず、許可writerは直接writeで欠損fieldや任意statusを保存できる。live deleteとarchive writeは拒否するため、clientによるlive/archive移動はOUT-01で停止した。

## 矛盾・未使用候補

- Outsourcerは協力会社masterであり、外注警備員個人masterは持たない。同一会社の重複配置は明細indexで区別する現行契約で、人数集約方式は採用しない。
- `useOutsourcersInRange`の`from/to`は期間選定に未使用で、契約開始/終了日fieldもない。
- `OutsourcerAutocomplete`のdefault item slotは`EmployeeListItem`を描画しており、名称表示は動作し得るが型・責務上の取り違え候補である。
- `OutsourcerListItem`は静的callerを確認できず、Autocompleteのdefault rendererにも使われないlegacy候補である。Nuxt auto-registration等の動的到達性は未確認のため、未使用とは断定しない。
- 一覧query limit 10とManager itemsPerPage 20が不一致。
- OUT-01前はManagerのtoolbar plusが`showCreate=false`でも表示された。OUT-01後はwrite actorにだけ表示する。Iteratorのdeclared `hideDefaultFooter`がrootへ渡らない点は未変更である。
- codeは一覧header・sortに使うがtoken検索対象外かつ任意・非一意である。

## 将来要対応

- FUT-0085〜FUT-0089を`future-actions.md`へ登録した。

## 要確認事項

- CONF-0070はOUT-01の作成・編集actorとclient破壊操作停止まで部分回答、CONF-0071は協力会社master・重複配置維持として回答済みである。CONF-0072〜CONF-0073は未回答である。

## 未確認範囲

- 実データの重複、archive、参照件数、既存の外注警備員管理運用。
- Schedule、ArrangementNotification、OperationResultの業務処理本文と帳票表示。
- FireModel validationの実行UI差、Rules test、同時操作の実再現、復元用保守手順。
