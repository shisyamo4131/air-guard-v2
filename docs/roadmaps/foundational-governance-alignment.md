# 根本ガバナンス整合phaseロードマップ

- 状態: In progress
- 開始日: 2026-09-09
- 現在の進捗: 10%
- 目的: 利用者が提示するプロジェクト固有の根本ルールを正本へ反映し、既存機能を新ルールへ小さく安全に整合させる。
- 実装順: Customer管理 → Site管理 → Employee管理 → Outsourcer管理 → その他transaction系機能。
- 進捗方式: milestone weightは工程完了の比率であり工数見積りではない。合計100。各機能milestoneは、着手時に利用者と合意した小checkpointへweightを配分し、各checkpointの実装、必須検証、必要なmigration、固定commitのDev反映・受入れが完了した場合だけ部分加点できる。ルール整理だけ、local実装だけ、未承認Dev待ちは製品milestoneへ加点しない。

## フェーズ原則

- 新しいルールごとに、project governanceとしての妥当性、正本、既存仕様・ADR・実装との矛盾、互換性、migration、rollback、testを確認してから反映する。利用者は2026-09-09にルール提示完了を明示し、FGA-01を完了した。後続の新規ルール追加は別の仕様変更として同じ確認を行う。
- 製品改修は機能順を守りつつ、対象operation、変更規模、data・外部作用・破壊性に応じて利用者と小checkpointを決める。一つのcheckpointで安全にreview・rollback・Dev受入れできない場合はさらに分割する。
- 各checkpointは `現行挙動と全reader/writer確認 → 変更契約・例外分類・data互換・rollback・test合意 → 実装 → 影響別自動検証 → 必要な環境検証 → 固定commitのDev反映・受入れ → 文書・証拠・Git closeout` の順で閉じる。
- 破壊的変更、data migration、Dev/Prod、remote read/write、外部作用、pushは既存runbookに従い個別承認する。このphase、branch、前checkpointの承認を後続操作へ拡張しない。
- branchはphaseの作業境界であり、未完了checkpointをまとめてDevへ出す根拠にしない。Dev反映方法とmain統合単位は各checkpointの開始時に決める。

## Milestones

| マイルストーン | 重み | 得点 | 状態 | 完了条件 |
|---|---:|---:|---|---|
| FGA-01 新ルールの検証・ガバナンス反映 | 10 | 10 | Completed | 利用者が提示完了を明示し、全ルールの正本、相互整合、置換ADR、実装差、検証が揃う |
| FGA-02 Customer管理 | 18 | 0 | In progress | Customerの全通常operationと例外を小checkpointで整合し、必要なdata処置とDev受入れまで完了する |
| FGA-03 Site管理 | 18 | 0 | Not started | Customer完了後、Siteの全通常operationと例外を同条件で完了する |
| FGA-04 Employee管理 | 18 | 0 | Not started | Site完了後、Employeeの機微情報分離を含む通常operationと例外を同条件で完了する |
| FGA-05 Outsourcer管理 | 16 | 0 | Not started | Employee完了後、Outsourcerの全通常operationと例外を同条件で完了する |
| FGA-06 その他transaction系機能 | 20 | 0 | Not started | master完了後、残るtransaction、Rules、Callable、data互換を小checkpointで整合し、Dev受入れとphase closeoutを完了する |

## 現在地

- [Firestore document構成](../specification.md#firestoreドキュメントの構成)と[ADR 0064](../decisions/0064-sensitive-firestore-document-boundaries.md)を採用し、Company振込先の現行root同居を未解消の実装差として記録した。
- [通常業務のtenant信頼境界](../specification.md#テナントと認証)と[ADR 0065](../decisions/0065-tenant-trust-normal-business-authorization.md)を採用した。FGA-02-RULES-01ではCustomer通常Rulesからrole・schema・operation field検査を外し、有効な本登録User、tenant、actor UIDへ簡素化した。固定commit `3c67a95e`をFirestore・HostingへDev反映し、会社管理者による合成Customerの作成、更新、再読込後のlistener正本表示まで完了した。[実行証拠](../verification/fga-02-customer-rules-dev.md)を参照する。archive・物理deleteの例外境界、Functions、schema、既存dataの変換は変更していない。
- [Firestoreドキュメントの同時更新](../specification.md#firestoreドキュメントの同時更新)と[ADR 0066](../decisions/0066-pre-production-document-level-last-write-wins.md)を採用した。FGA-02-CUSTOMER-UPDATE-01でCustomer詳細の基本情報と支払条件を共通`AirItemManager`へ移し、26保存fieldのdocument全体を`setDoc`で置換するlast-write-winsをlocal実装した。その後のSIMPLIFY-17で編集中draft固定の判断を訂正し、listener由来instanceをManagerへ直接渡して編集中draftも最新document全体へ置き換える契約へ揃えた。競合拒否・警告・再読込要求は設けない。旧固定local commit `6bf82e5264f72b39c540eb68c96b18690385198e`と後続の利用者Local／Dev証拠は変更前の履歴証拠として保持し、SIMPLIFY-17後のruntime証拠へ読み替えない。archive専用Callable境界を維持し、Rules・schema・data形状は変更していない。
- CompanyとUserは認証・tenant管理の基点としてtenant共通権限とdocument単位last-write-winsの対象外にし、現在の厳密なactor・field・validation・競合制御を維持する。Companyの機微情報分割は別の確定規則として維持する。
- [Component階層・useFetch・表示data・従属参照](../decisions/0067-component-fetch-and-dependent-reference-boundary.md)を採用した。主対象はlistener、従属補完は共有cacheを優先し、missing表示と物理削除時の限定検査を定めた。Customer Manager訂正ではこのlistener・cache境界を維持している。
- FGA-02-MANAGER-GOVERNANCE-01はcommit `25069a79e398ad3fa98b960fb758f18f053238e0`で一度完了したが、単数・複数形Managerを画面の選択文脈で分類した判断に誤りがあり、[ADR 0069](../decisions/0069-domain-manager-editable-state-ownership.md)とgovernance correction commit `b89e5c86`で訂正した。現行基準はeditable stateの所有単位であり、単数Managerは外部既存instanceまたはその場の新規instance、複数形Managerは配列と行選択dispatchを所有する。選択後はAirArrayManagerの`beforeEdit`により内部editorまたは詳細navigationを選び、相互にManagerを内包しない。この基準はCustomer・Site・Employee・OutsourcerだけでなくFirestore上の通常のmaster dataへ適用し、4機能を最初の適用例とする。480px、archive等の例外、listener・cache、server認可境界は変更しない。
- Customer Managerの訂正実装はcommit `79301b04ebaf5aab4898f1c122677780b11d9afc`、一般化したgovernanceを含むreleaseはmerge commit `2eeb502bf163a5952f24a02a2e2f5da58ac26df6`へ固定した。一覧CREATE、`CustomersManager`／AirArrayManagerの`beforeEdit`を経由する詳細navigation、単数`CustomerManager`の詳細UPDATE、480px dialog、listener反映をDevで確認した。[Dev受入れ記録](../verification/fga-02-customer-manager-dev.md)を参照する。Autocompleteのcreatable callerが現行routeにないため、そのruntimeは未確認であり、FGA-02の得点は0のままとする。[訂正後の利用者Local検証記録](../verification/fga-02-customer-manager-correction-user-local.md)と[旧Local検証記録](../verification/fga-02-customer-manager-user-local.md)は履歴証拠として保持する。

## FGA-02 Customer内部checkpoint

| Checkpoint | 状態 | 範囲・完了条件 |
|---|---|---|
| FGA-02-MANAGER-GOVERNANCE-01 | Superseded | commit `25069a79e398ad3fa98b960fb758f18f053238e0`で完了した旧分類。ADR 0069とCORRECTION-09が置き換える |
| FGA-02-MANAGER-GOVERNANCE-CORRECTION-09 | Completed | editable state所有単位、Autocompleteの単数Manager、複数形Managerの配列・選択dispatch、`beforeEdit`による内部編集／詳細遷移をproject rule・仕様・ADRへ訂正し、独立reviewとcomprehensive governance gateを完了した。進捗加点なし |
| FGA-02-MANAGER-GOVERNANCE-SCOPE-10 | Completed | Manager分類をFirestore上の通常のmaster dataへ一般化し、4機能を最初の適用例、Company・User等を例外としてproject rule・仕様・ADRへ反映した。独立reviewとcomprehensive governance gateを完了した。code・Rules・schema・data変更と進捗加点なし |
| FGA-02-CUSTOMER-MANAGER-02 | In progress | 既存Updateの480px・document LWWと、Autocomplete内Createを単数`CustomerManager`へ接続する訂正実装・source/test検証はcommit `79301b04`で完了した。詳細UPDATEと480pxはrelease `2eeb502b`のDevで受入れ済み。現行routeにcreatable callerがなくAutocomplete runtimeは未確認 |
| FGA-02-CUSTOMERS-MANAGER-03 | Completed | 一覧Createと、行選択を`CustomersManager`／AirArrayManagerの`beforeEdit`へ渡して詳細遷移後にfalseでdialogを抑止する実装・source/test・利用者Local確認をcommit `79301b04`で完了し、release `2eeb502b`のDevで作成、listener反映、詳細navigationを受入れた |
| FGA-02-CUSTOMER-ARCHIVE-04 | In progress | archiveを専用dialog・Callableへ委譲し、generic deleteを閉じたsourceと利用者Localの入口・取消を確認した。archive実行、固定commit、Devは未確認 |
| FGA-02-CUSTOMER-LOCAL-05 | In progress | 訂正後の一覧Manager経由詳細遷移、詳細UPDATE dialog、一覧CREATE dialogを利用者Localで確認し、同じManager正常経路をrelease `2eeb502b`のDevで受入れた。Autocomplete Create runtime、失敗経路、archive実行は未確認 |
| FGA-02-CUSTOMER-MANAGER-SIMPLIFY-17 | In progress | Customer両Managerをbase Managerの既定editor・validation・mode・error eventへ戻し、単数activatorの`toCreate`／`toUpdate`、listener直接接続、暫定`includedKeys`、generic delete拒否へ整合した。source・文書・自動testをcommit `900da192de6839180fc9c1d730775ef877ee73e8`へ固定し、利用者Local、Dev反映・受入れは未完了 |
| FGA-02-CUSTOMER-DIRECT-FIREMODEL-18 | In progress | Customer通常CREATE・UPDATEをManagerからFireModel／ClientAdapterへ直接接続し、`useCustomerActions`、専用writer、Manager内permission再判定を撤去した。Autocompleteの作成結果はCustomer instanceを直接通知し、tenant・actor scope中継とManager固有error classも撤去した。Customer Drawer・routeは`customers:write`のUX境界へ変更した。archive専用dialog・Callableと非認可安全検査を維持し、実行直前のclient認可再判定だけを撤去した。追加簡素化後は対象65件、全domain 1,562件、文書・diff gateがlocal成功し、独立reviewは指摘なし。固定commit、利用者Local、Dev反映・受入れは未完了 |
| FGA-02-CUSTOMER-MANAGER-ACTIVATOR-21 | In progress | 単数Managerのactivatorをbase slot propsのpass-throughへ簡素化し、UPDATE開始前のdoc ID検査と`disableUpdate`を撤去した。AutocompleteはDOM eventをitemとして渡さず`toCreate()`を呼び、generic delete拒否を維持する。対象回帰19件、全domain 1,562件、project文書・governance・diff gateがlocal成功し、独立reviewは指摘なし。固定commit、利用者Local、Dev反映・受入れは未完了 |

## 完了条件

- 提示された全ルールが一つのcurrent specificationとproject ruleへ矛盾なく反映され、置換された判断と未決事項が区別されている。
- Customer、Site、Employee、Outsourcer、その他transaction系の順で、承認済み全checkpointが実装・検証・必要なDev受入れまで完了している。
- 現行仕様と実装の既知不整合が0件、または利用者が明示承認した別phaseへ根拠・risk・開始条件付きで移されている。
- 最終差分のchange class union、必須gate、review、verification receipt、Git状態、未検証・残存risk、rollbackがcloseoutされている。
