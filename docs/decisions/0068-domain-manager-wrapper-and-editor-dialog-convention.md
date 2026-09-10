# ADR 0068: Domain Manager wrapperとdata編集dialog規約

- 日付: 2026-09-10
- 状態: Superseded
- 置換先: [ADR 0069](0069-domain-manager-editable-state-ownership.md)
- 対象: Customer、Site、Employee、OutsourcerのCRUD component、一覧・選択UI、data編集dialog
- 関連仕様: [Pageとcomponentの構成](../specification.md#pageとcomponentの構成)、[Firestoreドキュメントの同時更新](../specification.md#firestoreドキュメントの同時更新)
- 適用計画: [根本ガバナンス整合phase](../roadmaps/foundational-governance-alignment.md)
- 既存判断との関係: ADR 0066のManager利用を、対象masterの提供済み通常C/U/Dではdomain wrapperを使う規則へ具体化・強化する。document単位last-write-winsと例外operationの保護は変更しない。

> 単数・複数形Managerを画面の「単一document／collection・一覧・選択」という見た目で分類した点と、Autocomplete内Createを複数形Managerへ割り当てた点は誤りだった。現行判断は、editable stateの所有単位を基準とする[ADR 0069](0069-domain-manager-editable-state-ownership.md)を参照する。480px既定、例外operation、listener・cache、認可境界の判断はADR 0069へ継承した。

## 背景

AirGuardV2には`AirItemManager`と`AirArrayManager`を直接または間接に利用するcomponentがある一方、独自dialog、独自一覧、operation拒否用の互換shellも混在している。Customerの通常Updateは`CustomerManager`から`AirItemManager`へ接続済みだが、Createは一覧・Autocompleteから専用dialogを直接呼び、複数形`CustomersManager`は存在しない。Site、Employee、Outsourcerにも同じ責務名で統一された単数・複数形Managerが揃っていない。

利用者は、単一documentとcollectionの文脈を区別したdomain Managerを共通入口にし、選択UI内で作成する場合も同じoperation・schema・状態管理を再利用する方針を採用した。また、通常のdata編集dialogは480pxを基本とし、広いdialogは内容上の必要性がある場合に限定する。

## 決定

### Domain Manager

- Customer、Site、Employee、Outsourcerで製品が提供する通常のdocument create・update・deleteは、利用文脈に対応するdomain Managerを画面上の共通入口とする。
- 単一documentの詳細・編集文脈では`CustomerManager`、`SiteManager`、`EmployeeManager`、`OutsourcerManager`が`AirItemManager`をラップする。
- collection・一覧・選択文脈では`CustomersManager`、`SitesManager`、`EmployeesManager`、`OutsourcersManager`が`AirArrayManager`をラップする。
- 各Managerはその文脈で製品が提供するoperationだけを扱い、単数・複数形の双方に全C/U/Dを実装することを要求しない。将来、単一document文脈で通常Createを提供する場合は単数Managerを入口とする。
- 単数Managerと複数形Managerを相互に入れ子にすることは必須にしない。両者は同じdomain application operation、FireModel/Class schema、validation、error・loading、保存後のlistener正本化を共有し、利用場所ごとに保存契約を複製しない。
- page、一覧、document選択componentからbase Managerまたはmodel CRUDを直接呼ぶ経路は既定にしない。domain Managerで表現できない確認済み理由がある場合は、対象checkpointで例外、影響、testを示す。
- Autocomplete等のdocument選択UIがその場で新規作成を提供する場合は、複数形Managerのcreate入口を使用し、Firestore commitの成功が確認でき、割当済みdocument IDを持つ作成結果だけを選択する。list listenerの受信を選択前の必須待機にはせず、その後、主対象document・listはreal-time listenerを表示正本として収束する。IDから補完する従属先の名称・詳細だけは、tenant scopeを分離した`useFetch`共有cacheを優先して更新できる。作成前draft、未確定ID、結果不明のwriteを選択済み正本として扱わない。
- ManagerはUIとoperation orchestrationの責務であり、認証・認可・tenant、Firestore Rules、server validationの代替または境界にしない。

### 例外operation

- 本ADRは、全domainでcreate・update・deleteを一律に提供する決定ではない。提供しないoperationはManager上でも表示・到達させない。
- archive・復旧・物理削除、Authentication・Company・User、機微・機密情報、Stripe・請求確定、順序が重要な状態遷移等は通常CRUDの例外とする。Managerから開始する場合も、専用UI・Callableとoperation固有のactor、従属検査、transaction・precondition、idempotency、監査へ委譲する。
- Customerの削除相当操作は既存のarchive専用Callableへ委譲する。generic client deleteまたは物理削除を開放せず、archiveの参照barrierと安全条件を維持する。
- Outsourcerでarchive・restore・物理deleteを提供しない現行仕様は維持する。

### Data編集dialog

- 通常のdata編集dialogは`max-width: 480px`を既定とする。
- 項目の可読性、複数列・表・複数step、またはresponsive layout上の必要性が確認できる場合は、component固有の理由をもってより広い幅へ上書きできる。
- 確認専用dialog、viewer、selector等の非編集UIはこの既定の対象外とする。
- archive・復旧・物理削除等の例外operationのdialog幅は480pxへ自動拘束せず、操作固有の安全な確認内容、可読性、responsive・accessibilityを基準に決める。

## 理由

domain Managerを入口にすると、詳細、一覧、Autocomplete等の利用場所が異なっても、schema、保存、listener、error・loadingを同じ契約へ集約できる。単数・複数形の文脈を分けることで、単一documentの操作とcollection状態の責務を曖昧にせず、無意味な入れ子も避けられる。

480pxを通常編集の既定にすると、小さな業務formの視線移動と画面間の一貫性を保てる。一方、表や複数列等の確認済み必要性にはcomponent固有の幅を認め、既定値のために操作性を損なわない。

## 代替案

- 各画面がbase Managerやmodel CRUDを直接使う案: 同じdomainのoperation・validation・error処理が利用場所ごとに分岐するため採用しない。
- 複数形Managerが必ず単数Managerを内部に配置する案: `AirArrayManager`の既存責務と重複し、component構造を不必要に固定するため採用しない。
- すべてのdeleteをManagerのgeneric deleteへ接続する案: archive・物理削除等の認可、参照、監査、冪等性を失うため採用しない。
- すべてのdialogを480pxへ固定する案: 表、複数列、複数stepの操作性を損なうため採用しない。

## 影響と互換性

- Customerの既存Updateは単数`CustomerManager`の基礎として維持でき、同Managerに利用されないCreateを追加しない。collection・一覧・選択文脈のCreate、複数形`CustomersManager`、一覧・Autocomplete接続、archive入口の所有、480px幅は未実装差としてFGA-02で扱う。
- Site、Employee、Outsourcerの既存Manager名、独自一覧・dialog、互換shellは、各feature milestoneで新しい構造へ段階移行する。一括置換しない。
- document形状、Firestore Rules、Functions、schema、data、Company・Userのwriter、例外operationのserver境界は本ADRだけでは変更しない。
- Manager経路への変更後も、通常更新のdocument単位last-write-wins、保存後のlistener収束、schema・server管理field・派生fieldの整合を維持する。

## 移行

Customer、Site、Employee、Outsourcerの順で小checkpointへ分ける。各domainで、単数Manager、複数形Manager、一覧、Autocomplete等の選択UI、提供operation、例外operation、dialog幅を棚卸しする。Customerでは、既存Updateを担う単数`CustomerManager`を480px既定へ整合し、次にcollection・一覧・選択文脈のCreateを担う`CustomersManager`を新設して一覧・Autocompleteへ接続する。単数`CustomerManager`に未使用Createを追加せず、archive入口の所有を整理してから利用者Local検証とDev受入れへ進む。

## rollback

文書変更は対象commitのGit revertで戻せる。製品実装はdomain・checkpoint単位のcommitを戻し、旧入口、listener、例外Callableの到達性を確認する。Manager移行後に作成・更新したdocumentは既存schemaを維持するため通常はdata rollbackを要しないが、実効schemaまたはdata変更が生じるcheckpointでは別のmigration・rollbackを定める。archive等の不可逆作用はcode revertだけで復元できるとは扱わない。

## 検証

- 各対象domainで、単一document文脈が単数Manager、collection・一覧・選択文脈が複数形Managerを通ることを確認する。
- 同じdomainの各入口が同じapplication operation、schema、error・loading、listener正本契約を使用し、base Managerまたはmodel CRUDへの未承認直接経路がないことを確認する。
- Autocomplete内createはcommit成功と割当済みdocument IDを含む結果を確認してから選択し、list listenerを不必要に待たないこと、失敗・結果不明時にdraftや未確定IDを選択しないことを確認する。その後、主対象document・listはlistenerへ収束し、従属先の名称・詳細だけがtenant scopeを分離した`useFetch`共有cacheを優先することを確認する。
- 通常data編集dialogは480px既定、幅を拡張するcomponentは理由とresponsive表示を確認する。
- Customer archive等の例外はgeneric deleteへ到達せず、既存の認可、従属検査、監査、冪等性と拒否時write 0を維持する。
- project rule、仕様、ADR、roadmap、実装、test、manual、CHANGELOGのうち影響した面を、選択済みverification policyのgateで確認する。

## 再検討条件

Air managerの公開contractが変わった場合、domain operationの共有により単数・複数形の分離が不合理になった場合、選択UI内createがlistener収束前の即時選択を必要とする場合、または480px既定が複数domainで継続的に操作性を損なう場合。
