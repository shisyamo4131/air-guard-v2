# Site（現場）マスター実装調査

## メタデータ

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-021、SPEC-DEEP-010
- 最終確認日: 2026-08-11
- 根拠ファイル: `pages/sites/index.vue`、`pages/sites/terminated.vue`、`pages/sites/[id].vue`、`components/Sites/**`、`components/Site/**`、`composables/fetch/useFetchSite.js`、`composables/dataLayers/site/useSitesTerminated.js`、`utils/pageSettings.js`、`firestore.rules`、`air-guard-v2-schemas/src/Site.js`、直接参照するOperationResult/SiteOperationSchedule/Billing PDF箇所

## 入口・暫定権限

Page 3ファイルのroute、query/filter、終了・削除到達性、navigation・error境界のfile単位確認は[Article・Customer・Site pages deep review](article-customer-site-pages-deep-review.md)を参照する。

確認済み方針では、Site権限は`sites:read`/`sites:write`の2種とし、writeは作成、基本情報・Customer・Agreement変更、終了、再有効化、archiveを含む。細分化はせず、UI・Rules・Callable・role presetをこの境界へ揃える。以下は未修正の現行実装である。

| 入口 | 現行UI | pageSettings | Rules |
|---|---|---|---|
| `/sites` | ACTIVE一覧、作成、詳細遷移 | `sites:read` | 同一会社認証Userまたはsuper-userに全read/write |
| `/sites/[id]` | 基本情報・取引先・取極め更新、終了、削除 | `sites:read` | 同上 |
| `/sites/terminated` | TERMINATEDを名称検索し詳細遷移 | `sites:read` | 同上 |

`sites:read`だけで全CRUDとstatus変更へ到達する。権限分割は暫定実装で、正式仕様とは扱わない。

## データ契約

- 保存先は会社prefix配下の`Sites/{docId}`。`useAutonumber=false`で、通常作成はFirestore生成ID。
- 必須: `name`、`nameKana`、`prefCode`、`city`、`address`、`securityType`、`status`。`customerId`未設定時は`customerName`が必要。
- 任意: `customerId`、`customerName`、`code`、`hasAbbreviation`、`abbreviation`、`zipcode`、`building`、`siteNumber`、工期開始/終了日、`location`、`remarks`、`agreementsV2`。
- `customer`はhiddenの埋込みCustomer。`customerId`を指定したcreate時と、customerId変更時にCustomerを取得して格納する。
- statusのdefaultは`ACTIVE`。値は`ACTIVE`（稼働中）と`TERMINATED`（終了）。
- 読み取り専用プロパティ: `fullAddress`、`prefecture`、`isTemporary`、`hasConstructionPeriod`、開始/終了日有無。ゲッター: `displayName`（略称使用時はabbreviation、その他はname）。
- `getValidAgreement`はshiftType一致を日付降順にし、指定日以前の最新`agreementsV2`を返す。該当なしはnull。
- 工期は両端がある場合に開始≦終了を相互validationする。片端だけも許容される。
- token検索fieldは`name`と`nameKana`。code、略称、取引先名、住所、現場番号は対象外。

## CRUD・validation

- 作成wizardは取引先名を入力してCustomer N-gram検索し、候補選択または取引先未設定の仮登録を許す。次に現場名、住所、警備種別、工期等を入力する。
- create時にcustomerIdとcustomerNameが両方なければ失敗する。customerIdがあれば同じ会社prefixのCustomer存在確認とCustomer埋込みを行う。
- customerId設定後は未設定へ戻せないが、別Customerへの変更は禁止されていない。変更時は埋込みcustomerを更新する。
- 基本情報更新は専用CustomInputでcode、名称、略称、住所、警備種別、現場番号、工期、備考を編集する。取引先はcustomerIdだけを別editorで変更する。
- 作成wizardは`hasAbbreviation/abbreviation/siteNumber/remarks`を入力しないが、作成後の基本編集では入力できる。
- code/name等の一意性validationはない。
- 汎用managerは`create/update/delete`を直接呼ぶ。削除はschemaのhasMany参照を確認してlogical archiveする。

## 検索・表示

- ACTIVE一覧はstatus queryをlive購読し、customerIdとsecurityTypeをclient filterする。テーブル初期sortはcode降順。
- 一覧表示はcode、`displayName`、live取得したCustomer略称、securityType、工期。
- TERMINATED一覧は検索文字列がある時だけN-gram検索し、status=TERMINATEDを追加する。空検索では0件。
- Site AutocompleteはN-gram検索にstatus constraintを付けないため、ACTIVE/TERMINATEDの両方が候補になり得る。
- TERMINATED詳細でも基本編集、取引先変更、取極め編集、削除、再度の「稼働終了」buttonが表示される。再終了はschemaがエラーにするが、再有効化経路は確認できない。

## 参照関係・変更影響

- Customer所属は`customerId`と埋込み`customer`の二重保持。Customer master自体の更新ではSiteの埋込みcustomerを同期しない。一覧はlive Customerを別取得する一方、詳細の取引先表示と取極めcutoff-dateは埋込みcustomerを使うため表示・処理時点が混在する。
- 確認済み方針ではSiteのCustomer変更を許すが、既存OperationResultの`customerId`はsnapshotとして自動変更しない。現行コードでも空updateは再同期せず、`groupKey`変更時だけ同期する。将来の明示的なCustomer/Agreement再適用では利用者が対象OperationResultを選び、old/new値とBilling影響を表示し、発行済み請求書を除外して監査する。空updateへ隠れた再同期意味は持たせない。
- SiteOperationScheduleはsiteIdを保持し、作成/一部処理でSiteの存在と仮登録でないことを確認する。Site名等は直接snapshotしない。
- OperationResultは作成時またはgroup key変更時にSiteからcustomerIdと適用取極めを取り込み、その後は保存済み値を使う。SiteのCustomer・取極め変更が既存実績へ自動反映される契約ではない。
- Billing集計keyはcustomerId、siteId、billingDateを使う。請求書PDFは生成時にlive Siteを取得してSite名を表示し、欠損時は「不明な現場」とするため、Site名変更は過去Billingの再生成表示にも反映される。
- schema上の削除guard対象はSiteOperationSchedules、OperationResults、ArrangementNotifications。AgreementはSite内配列として保存される。

## 削除・無効化

- `terminate()`はdoc読込済み、未TERMINATED、JST当日以降のSiteOperationScheduleが0件であることを確認してstatusを更新する。過去schedule、OperationResult、ArrangementNotification等は終了を妨げない。
- 終了後も詳細画面の編集・削除機能はstatusで抑止されない。再有効化method/UIは確認できない。
- 確認済み方針ではTERMINATEDをread-only・新規選択不可とし、履歴参照と限定された監査付き訂正だけを許す。同一Customerでの再有効化は`sites:write`と理由を必須とする。Customer変更は上記方針を使い、Agreementは自動再有効化しない。archiveは誤登録等に限定し、通常利用者のrestoreは提供しない。
- deleteは3 collectionのsiteId参照を順にtransaction外queryし、存在すれば拒否する。参照確認とarchive transactionの間に参照が追加される競合余地がある。
- logical deleteは`Sites_archive/{docId}`へcopy後に元を削除する。adapterにはrestore APIがある一方、確認dialogは「復元することはできません」と表示し、Site UIからrestoreする経路は見つからない。

## Rules・tenant境界

- `Companies/{companyId}/Sites/{docId}`と`Sites_archive`は、pathのcompanyIdが認証User claimと一致するかsuper-userなら全read/write。
- Rulesはfield、role、status transition、customerIdが同一会社Customerを指すこと、hasMany参照を検証しない。schema経由では同じprefixでCustomerをfetchするが、直接writeでは埋込みcustomerとの整合も強制されない。
- tenant境界はcollection pathに依存し、document内companyIdはSite契約にない。

## 矛盾・未使用候補

- customerIdは「従属先変更不可」とする下流コメントがある一方、Site.beforeUpdateは別Customerへの変更を許す。
- Customer master更新後、Site内の埋込みcustomerはstaleになり得て、一覧と詳細で参照するCustomer時点が異なる。
- TERMINATED SiteもAutocompleteで選択可能で、詳細では編集・削除・再終了buttonが表示される。
- restore APIが存在するlogical deleteなのに、UIは復元不能と断定する。
- create wizardで略称、現場番号、備考は入力できず、作成後編集が必要。
- deprecated `agreements` getter/setterと`getAgreement`が互換用に残る。

## 将来要対応

- FUT-0060: 確定したSite read/write権限をUI・Rules・Callable・presetへ実装する。
- FUT-0061: 明示的なCustomer/Agreement再適用とBilling移動・監査を実装する。
- FUT-0062: TERMINATEDのread-only、新規選択禁止、監査付き再有効化を実装する。
- FUT-0063: Site archiveと参照guardを競合安全にする。
- FUT-0064: Site master変更の下流snapshot/live境界を確定する。
- FUT-0059: geocoding失敗・0座標の証拠へSiteを追記した。

## 要確認事項

- CONF-0046〜CONF-0050を`pending-confirmations.md`へ登録した。

## 未確認範囲

- Site配下のSchedule/Agreement編集内部、OperationResult/Billing同期内部、他のPDF・画面。
- 汎用Air managerの全validation/失敗表示、必要Firestore index、実データ、Emulator・ブラウザ動作。
- 既存stale埋込みCustomerの件数、TERMINATED/archived Siteの正式運用。
