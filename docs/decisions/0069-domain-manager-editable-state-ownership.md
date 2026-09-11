# ADR 0069: Editable state所有単位によるDomain Manager分類

- 日付: 2026-09-10
- 状態: Accepted
- 対象: Firestore上の通常のmaster dataを扱うCRUD component、一覧・選択UI、data編集dialog。Customer、Site、Employee、Outsourcerを最初の適用例とする
- 関連仕様: [Pageとcomponentの構成](../specification.md#pageとcomponentの構成)、[Firestoreドキュメントの同時更新](../specification.md#firestoreドキュメントの同時更新)
- 適用計画: [根本ガバナンス整合phase](../roadmaps/foundational-governance-alignment.md)
- 既存判断との関係: [ADR 0068](0068-domain-manager-wrapper-and-editor-dialog-convention.md)全体を置き換える。editable state所有と選択dispatchの判断を訂正し、480px既定、例外operation、listener・cache、認可境界は本ADRへ引き継ぐ

## 背景

ADR 0068は、単一documentの詳細・編集を単数Manager、collection・一覧・選択UIを複数形Managerと分類した。しかし、`AirItemManager`は外部から渡された一つのinstanceを編集し、`AirArrayManager`は配列と一覧の行選択dispatchを所有する。AirArrayManagerは、選択instanceを内部editorで編集するだけでなく、`beforeEdit`でcollection固有の詳細画面へ遷移してdialogを抑止できる。選択UIであるAutocompleteが新規instanceを生成する場合まで複数形Managerに割り当てると、配列を所有しない場所へ`AirArrayManager`を置くことになり、base Managerの実際の責務と一致しない。

## 決定

### Domain Managerの分類

- Firestore上の通常のmaster dataで提供するC/U/Dは、editable stateを所有する単位に対応するdomain Managerを共通入口とする。
- 外部から渡された既存の単一instance、またはその場で生成した新規instanceを編集する場合は、単数形domain Managerが`AirItemManager`をラップする。Customerの`CustomerManager`、Siteの`SiteManager`、Employeeの`EmployeeManager`、Outsourcerの`OutsourcerManager`を最初の適用例とする。
- collection・list自身が配列と行選択dispatchを所有する場合は、複数形domain Managerが`AirArrayManager`をラップする。Customerの`CustomersManager`、Siteの`SitesManager`、Employeeの`EmployeesManager`、Outsourcerの`OutsourcersManager`を最初の適用例とする。
- 複数形Managerは、`AirArrayManager.beforeEdit`がtrueを返す場合は選択instanceを内部editorで編集する。collection固有の詳細画面を使う場合は、`beforeEdit`内でnavigationしてfalseを返し、内部dialogを開かない。page・listはどちらの場合も行選択を複数形Manager／AirArrayManagerへ渡し、直接detail routeまたはeditorへ迂回しない。
- 画面がdocument選択UIであること、またはCreateを提供することだけでは複数形Managerに分類しない。各Managerはそのstate所有文脈で提供するoperationだけを扱い、双方に全C/U/Dを実装する必要はない。
- 単数形Managerと複数形Managerは相互に内包しない。各Managerが対応するbase Managerの編集state、dialog、validation、submit、error・loading、または選択dispatchを完結して所有し、domain application operation、FireModel/Class schema、error・loading、listener正本契約を共有する。
- page、list、document選択componentがbase Managerまたはmodel CRUDを直接呼ぶ経路は既定にせず、domain Managerで表現できない確認済み理由がある場合だけ例外、影響、testを定める。

### Editorと入力component

- domain Managerはbase Managerの既定editor、form validation、loading、submit、edit mode管理を使用する。baseで満たせない確認済み要件がない限り`editor` slot全体を上書きせず、同じ責務をdomain側へ再実装しない。
- base Managerが発行するerror・error clear・loading eventは、event契約へ適合する既存composableまたは同等の薄いadapterでアプリ標準の通知・logging・loading経路へ接続する。特定helperの使用自体を必須にせず、Manager固有のerror state・表示や二重処理を増やさない。
- 完成形ではManager固有の`customInput`が入力field、配置、順序を所有し、base Managerから受けるitem、`updateProperties`、edit mode、disabled状態、schema由来component属性を使用する。edit mode別に入力componentを変える場合は`customInput` resolverを使う。
- `includedKeys`はSchema定義順から対象fieldを絞る暫定的な簡易入力機能であり、配列指定順を画面順序の契約にしない。既存Customerは段階移行中の例外として当面使用できるが、後続masterの完成形と新規domain Managerは`customInput`を既定とする。`customInput`使用時は同componentがfieldと順序を所有し、`includedKeys`による絞込みへ依存しない。

### Activatorとmode

- 単数domain Managerはbase Managerのactivator slot propsを原則そのままpass-throughし、callerが用途に対応する`toCreate`、`toUpdate`、必要なら`toDelete`を直接呼ぶ。slot propsにmethodが存在することは、そのoperationを製品として許可することを意味せず、非提供operationは`beforeEdit`、disable・hide props、handler等のbase契約で拒否する。wrapper独自の`operation` prop、単一`open`関数、doc ID等の先行検査でedit modeを再管理しない。
- wrapperはfresh create instanceの生成、listener由来update instanceの接続、許可operation、domain handlerとerror表示を薄く接続できる。base Managerのmode、validation、submit、loadingは複製しない。複数形Managerはheader・tableの標準dispatchと`beforeEdit`を使い、標準dispatchを置き換える場合は確認済み理由を示す。
- 通常CRUDの変更可能な主対象はlistener由来instanceをManagerの`modelValue`へ直接接続する。listener更新によって編集中draftが最新document全体へ置き換わることを許容し、編集中だけ固定するsnapshotや入力消失警告を設けない。

### Autocomplete

- Autocomplete内Createは、配列を所有しないその場の新規単一instance編集であるため、単数ManagerをCREATE modeで開く。
- Firestore commit成功と割当済みdocument IDを持つ作成結果だけを選択する。listener受信を選択前の必須待機にはせず、draft、未確定ID、結果不明のwriteを選択済み正本にしない。
- 将来、選択済み既存documentをAutocompleteから編集する場合も、`useFetch` cacheのinstanceを直接変更せず、主対象のreal-time listenerから受けた単一instanceを単数ManagerのUPDATEへ渡す。
- 保存後の変更可能な主対象document・listはlistenerを表示正本として収束する。IDから補完する従属先の名称・詳細だけは、tenant scopeを分離した`useFetch`共有cacheを優先できる。

### 維持する境界

- 通常data編集dialogは`max-width: 480px`を既定とし、可読性、複数列・表・複数step、responsive・accessibility上の確認済み理由がある場合だけ広げる。確認専用dialog、viewer、selectorは対象外とし、archive等の例外operationは操作固有に幅を決める。
- archive・復旧・物理削除、Authentication・Company・User、機微・機密情報、Stripe・請求確定、順序依存状態遷移は通常CRUDの例外である。generic deleteを開放せず、専用UI・Callable、actor、従属検査、transaction・precondition、idempotency、監査を維持する。
- ManagerはUIとoperation orchestrationの責務であり、認証・認可・tenant、Firestore Rules、server validationの境界にしない。document形状、Rules、Functions、schema、data、Company・Userのwriterは本ADRでは変更しない。

## 理由

editable stateの所有単位を基準にすると、base Managerの実装責務とdomain wrapperの名前が一致する。Autocompleteの新規作成に不要な配列管理を持ち込まず、collection/listではAirArrayManagerが配列と行選択dispatchを一つの責務として完結できる。選択後の内部editorと詳細navigationは`beforeEdit`で切り替えられ、画面構成を一律に固定しない。単数・複数形を入れ子にしないため、同じstateを二つのManagerが競合して所有しない。

## 代替案

- 選択UIを一律に複数形Managerへ割り当てる案: Autocomplete内Createは配列と行選択を所有しないため採用しない。
- 複数形Managerが単数Managerを内包する案: AirArrayManager自身の選択dispatch・内部editor責務と重複するため採用しない。
- 各利用場所がbase Managerまたはmodel CRUDを直接使う案: domain operation、schema、error・loading契約が分岐するため採用しない。

## 影響と互換性

- commit `9bd4d43c23bf113790add10691dc91b7445a99d4`のCustomer実装は、一覧Createを`CustomersManager`へ接続した点は維持できる。一方、Autocomplete内Createを`CustomersManager`へ接続した点は本ADRと不一致であり、`CustomerManager`のCREATEへ移す必要がある。Customer一覧はpageが行選択から直接detail routeへ遷移しており、`CustomersManager`／`AirArrayManager.beforeEdit`を経由していないため、選択dispatchの実装差として直す。
- [旧利用者Local検証記録](../verification/fga-02-customer-manager-user-local.md)は当時の実装に対するimmutable receiptとして保持し、訂正後のruntime証拠へ読み替えない。
- Site、Employee、Outsourcerと後続の対象masterは、各feature milestoneで通常masterに該当するoperationとeditable state所有者を確認して段階移行し、一括置換しない。
- 現行`AirItemManager`はreactiveな`modelValue`をdeep watchして編集中itemへ反映する。一方、`AirArrayManager`は配列から選択したitemを内部editorへ渡した後、listenerによる配列更新を編集中itemへ再同期しない。Customer一覧は`beforeEdit`で詳細へ遷移して内部UPDATE editorを使わないため本checkpointの阻害要因ではないが、一覧内dialogでUPDATEする後続masterはAirVuetify3またはdomain wrapperで同じlistener直接接続契約を確立してから完了する。
- 保存schemaとoperationは変えないため、この分類訂正だけではdata migrationを要しない。

## 移行

現在のCustomerは、一覧Createだけを`CustomersManager`へ接続し、行選択はpageが直接detail routeへ遷移する。目標では、一覧の行選択を`CustomersManager`／AirArrayManagerへ渡し、`beforeEdit`でdetail navigationを実行してfalseを返す。`CustomersManager`から`CustomerManager`は呼ばない。別途、`CustomerManager`へCREATE modeと作成結果eventを追加し、Autocomplete内Createを同Managerへ接続する。既存の詳細Updateはlistener由来の単一Customerを`CustomerManager`へ渡す。Customerの訂正後、Site、Employee、Outsourcerの順で同じ所有基準を適用し、後続の通常masterも着手時に対象operationと例外を確認して同じ基準へ段階移行する。

## rollback

文書変更は対象commitのGit revertで戻せる。製品実装の訂正はCustomer checkpoint単位で戻せるが、ADR 0068の誤分類を現行規則として復活させず、不具合時は単数ManagerのCREATE接続をforward correctionする。保存schemaは維持するため通常data rollbackを要しない。archive等の例外作用はcode revertだけで復元できるとは扱わない。

## 検証

- 各対象masterで、単数Managerが外部既存instanceと新規instance、複数形Managerが配列と行選択dispatchを所有することをsource contractで確認する。
- Customers一覧は行選択を`CustomersManager`内のAirArrayManagerへ渡し、`beforeEdit`のdetail navigationとfalseによるdialog抑止を使うことを確認する。Autocomplete内Createは`CustomerManager`内のAirItemManagerを通り、両Managerを相互に内包しないことを確認する。
- Create成功時は割当済みdocument IDを含むcommit確定結果だけを選択し、失敗・結果不明時に選択しないことを確認する。
- listener由来instanceをManagerへ直接接続し、編集中のlistener更新でdraftが最新document全体へ置き換わること、固定snapshot・入力消失警告・競合拒否を設けないことを確認する。保存後の主対象もlistenerへ収束し、従属補完以外で`useFetch` cacheを変更可能documentの正本にしない。
- base Managerの既定editor、validation、loading、submit、mode管理を使い、`customInput`がfieldと順序を所有することを確認する。Customerの暫定`includedKeys`はSchema順依存を受容し、activator callerがoperation別methodを選ぶことを確認する。
- 480px、archive専用境界、generic delete拒否、schema・Rules・data非変更を維持する。

## 再検討条件

AirItemManagerまたはAirArrayManagerのstate所有・editor契約が変わった場合、同じeditable stateを相互に内包する構造が必要になった場合、またはlistenerとcacheの正本境界を別仕様で変更した場合。
