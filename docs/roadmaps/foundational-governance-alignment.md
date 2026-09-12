# 根本ガバナンス整合phaseロードマップ

- 状態: In progress
- 開始日: 2026-09-09
- 現在の進捗: 64%
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
| FGA-02 Customer管理 | 18 | 18 | Completed | Customerの全通常operationと例外を小checkpointで整合し、必要なdata処置とDev受入れまで完了する |
| FGA-03 Site管理 | 18 | 18 | Completed | Customer完了後、Siteの全通常operationと例外を同条件で完了する |
| FGA-04 Employee管理 | 18 | 18 | Completed | Site完了後、Employeeの情報分類を確定し、通常operationと例外を同条件で完了する |
| FGA-05 Outsourcer管理 | 16 | 0 | In progress | Employee完了後、Outsourcerの全通常operationと例外を同条件で完了する |
| FGA-06 その他transaction系機能 | 20 | 0 | Not started | master完了後、残るtransaction、Rules、Callable、data互換を小checkpointで整合し、Dev受入れとphase closeoutを完了する |

## 現在地

- [Firestore document構成](../specification.md#firestoreドキュメントの構成)と[ADR 0064](../decisions/0064-sensitive-firestore-document-boundaries.md)を採用し、Company振込先の現行root同居を未解消の実装差として記録した。
- [通常業務のtenant信頼境界](../specification.md#テナントと認証)と[ADR 0065](../decisions/0065-tenant-trust-normal-business-authorization.md)を採用した。FGA-02-RULES-01ではCustomer通常Rulesからrole・schema・operation field検査を外し、有効な本登録User、tenant、actor UIDへ簡素化した。固定commit `3c67a95e`をFirestore・HostingへDev反映し、会社管理者による合成Customerの作成、更新、再読込後のlistener正本表示まで完了した。[実行証拠](../verification/fga-02-customer-rules-dev.md)を参照する。archive・物理deleteの例外境界、Functions、schema、既存dataの変換は変更していない。
- [Firestoreドキュメントの同時更新](../specification.md#firestoreドキュメントの同時更新)と[ADR 0066](../decisions/0066-pre-production-document-level-last-write-wins.md)を採用した。FGA-02-CUSTOMER-UPDATE-01でCustomer詳細の基本情報と支払条件を共通`AirItemManager`へ移し、26保存fieldのdocument全体を`setDoc`で置換するlast-write-winsをlocal実装した。その後のSIMPLIFY-17で編集中draft固定の判断を訂正し、listener由来instanceをManagerへ直接渡して編集中draftも最新document全体へ置き換える契約へ揃えた。競合拒否・警告・再読込要求は設けない。旧固定local commit `6bf82e5264f72b39c540eb68c96b18690385198e`と後続の利用者Local／Dev証拠は変更前の履歴証拠として保持し、SIMPLIFY-17後のruntime証拠へ読み替えない。archive専用Callable境界を維持し、Rules・schema・data形状は変更していない。
- CompanyとUserは認証・tenant管理の基点としてtenant共通権限とdocument単位last-write-winsの対象外にし、現在の厳密なactor・field・validation・競合制御を維持する。Companyの機微情報分割は別の確定規則として維持する。
- [Component階層・useFetch・表示data・従属参照](../decisions/0067-component-fetch-and-dependent-reference-boundary.md)を採用した。主対象はlistener、従属補完は共有cacheを優先し、missing表示と物理削除時の限定検査を定めた。Customer Manager訂正ではこのlistener・cache境界を維持している。
- FGA-02-MANAGER-GOVERNANCE-01はcommit `25069a79e398ad3fa98b960fb758f18f053238e0`で一度完了したが、単数・複数形Managerを画面の選択文脈で分類した判断に誤りがあり、[ADR 0069](../decisions/0069-domain-manager-editable-state-ownership.md)とgovernance correction commit `b89e5c86`で訂正した。現行基準はeditable stateの所有単位であり、単数Managerは外部既存instanceまたはその場の新規instance、複数形Managerは配列と行選択dispatchを所有する。選択後はAirArrayManagerの`beforeEdit`により内部editorまたは詳細navigationを選び、相互にManagerを内包しない。この基準はCustomer・Site・Employee・OutsourcerだけでなくFirestore上の通常のmaster dataへ適用し、4機能を最初の適用例とする。480px、archive等の例外、listener・cache、server認可境界は変更しない。
- Customer Managerの最終簡素化はmerge commit `7d82996652d2d65448cf7eff9cd7e1ecc5457ae2`へ固定し、GitHub Actions run #11でHostingへDev反映した。会社管理者の外部Chromeで一覧CREATE、詳細READ、単数Manager UPDATE、listener反映、専用Callable archive、一覧からの消失を確認した。[最終Dev受入れ記録](../verification/fga-02-customer-manager-simplification-dev.md)を参照する。Autocompleteのcreatable callerは現行routeにないためruntime未確認だが、source contractと自動testを満たす将来の未提供経路であり、現行Customer操作の完了を阻害しない。FGA-02を18点で完了し、次をFGA-03 Site管理とする。[訂正Dev受入れ記録](../verification/fga-02-customer-manager-dev.md)、[訂正後の利用者Local検証記録](../verification/fga-02-customer-manager-correction-user-local.md)、[旧Local検証記録](../verification/fga-02-customer-manager-user-local.md)は履歴証拠として保持する。
- FGA-03-SITE-MANAGER-LWW-05では、Site通常CREATE・UPDATEを単数／複数形ManagerからSite modelの標準`create`／`update`へ直接接続し、listener由来instanceのdocument単位last-write-winsへ揃えた。作成は履歴で確認した3ステップ入力を維持し、Customer未登録でも取引先名だけで仮登録できる。通常保存用の`useSiteActions`、専用writer、埋込みCustomerのexact 6-field要件を撤去した。取極めUIをremote履歴どおりの画面内表示へ戻し、取極めにも通常`Site.update()`とlast-write-winsを採用して、専用Callable、baseline比較、競合拒否を撤去した。終了・再有効化・archiveは専用操作を維持する。最新製品commit `89bdd51a`をGitHub Actions #16・#18・#19でFirestore Rules、Functions、HostingへDev反映し、旧`updateSiteAgreements` Callableを削除した。Codex専用合成tenantで通常操作とAgreement再表示を確認し、2026-09-12に利用者がDevの使用感・見た目を受入れた。別actorのDev実操作は未実施だが、role非依存境界のLocal自動検証を代替証拠として利用者承認により完了条件から外した。tenant拒否とapplicationを介さないrequestは今回想定しない範囲である。既存dataの一括変換、schema、package、Prodは変更していない。[Local検証記録](../verification/fga-03-site-manager-lww-local.md)と[Dev受入れ記録](../verification/fga-03-site-manager-lww-dev.md)を参照し、FGA-03を18点で完了、phase全体を46%とする。次はFGA-04 Employee管理の現行挙動と全reader／writerを調査し、機微情報と例外操作を分けた最初のcheckpointを提案する。
- FGA-04-EMPLOYEE-CLASSIFICATION-01では、利用者回答により健康保険、厚生年金、雇用保険の番号・状態・日付・理由・履歴を機微・機密情報の例外にせず、Employee本体documentの通常業務情報と確定した。保険専用documentへの分割と既存data migrationは行わない。在職Employeeの通常情報はrole非依存のtenant共通read・編集へ揃え、退職後編集禁止を維持する。保険の状態遷移条件は情報の機密性とは分けて維持し、専用保存・世代値の必要範囲は実装checkpointで確認する。[ADR 0070](../decisions/0070-employee-insurance-normal-business-boundary.md)を参照する。この分類checkpointは製品実装・進捗加点・Dev反映を含まない。次は通常EmployeeのManager、reader、writer、Rulesをdocument last-write-winsへ揃える実装checkpointとする。
- FGA-04-EMPLOYEE-MANAGER-LWW-02では、在職一覧の作成と詳細の基本・国籍・警備員・資格・3保険をEmployee modelの通常`create`／`update`へ接続し、資格・保険画面から専用Callable、最新値比較、競合拒否、role制限を外した。保険は加入・喪失等の状態遷移条件だけを維持する。通常Employeeの一覧・詳細・Rulesは同一tenantの有効な本登録Userへrole非依存で開き、退職後の通常更新、client delete、archive、退職・誤退職訂正、User/Authの専用境界を維持した。Customer、Site、EmployeeのManagerは単数instance／同一domain instance配列の入力契約へ揃えた。到達不能な旧通常保存Callable 6件と専用sourceを撤去し、製品commit `56694837`をrelease commit `49001e06`のGitHub ActionsでFirestore Rules・Functions・HostingへDev反映して旧6 Functionだけを削除した。Local自動検証に加え、Codex専用tenantの認証済みChromeで合成Employeeの作成、基本・国籍・警備員・資格・3保険の保存、再読込後の再表示を確認した。合成EmployeeはUser未連携・在職中で残し、Prod・既存dataの一括変換は行っていない。[Local検証](../verification/fga-04-employee-manager-lww-local.md)と[Dev受入れ](../verification/fga-04-employee-manager-lww-dev.md)を根拠にFGA-04を18点で完了し、phase全体を64%とした。
- FGA-05-OUTSOURCER-MANAGER-LWW-01では、Outsourcerの単数／複数形Managerをbase Air Managerへ揃え、通常CREATE・UPDATEをmodel標準保存とdocument last-write-winsへ移した。会社管理者／exact manager制限、旧専用dialog・writer・部分transaction・競合拒否を撤去し、Rulesは同一tenantの有効な本登録Userとactor UIDを通常write境界とした。live deleteとarchive CUD拒否、既存の表示・配置・通知・実績・請求・帳票、data shapeを維持し、1文字検索を仕様へ揃えた。対象test 8件、全domain 1,448件、Local Emulator 178件に合格した。固定commitのUI build、Dev反映・Codex専用tenant受入れが未完了のためFGA-05は加点せず、phase全体を64%のままとする。[Local検証記録](../verification/fga-05-outsourcer-manager-lww-local.md)を参照する。

## FGA-02 Customer内部checkpoint

| Checkpoint | 状態 | 範囲・完了条件 |
|---|---|---|
| FGA-02-MANAGER-GOVERNANCE-01 | Superseded | commit `25069a79e398ad3fa98b960fb758f18f053238e0`で完了した旧分類。ADR 0069とCORRECTION-09が置き換える |
| FGA-02-MANAGER-GOVERNANCE-CORRECTION-09 | Completed | editable state所有単位、Autocompleteの単数Manager、複数形Managerの配列・選択dispatch、`beforeEdit`による内部編集／詳細遷移をproject rule・仕様・ADRへ訂正し、独立reviewとcomprehensive governance gateを完了した。進捗加点なし |
| FGA-02-MANAGER-GOVERNANCE-SCOPE-10 | Completed | Manager分類をFirestore上の通常のmaster dataへ一般化し、4機能を最初の適用例、Company・User等を例外としてproject rule・仕様・ADRへ反映した。独立reviewとcomprehensive governance gateを完了した。code・Rules・schema・data変更と進捗加点なし |
| FGA-02-CUSTOMER-MANAGER-02 | Completed | 既存Updateの480px・document LWWと、Autocomplete内Createを単数`CustomerManager`へ接続するsource/test検証を完了した。詳細UPDATEはrelease `7d829966`のDevで受入れた。Autocompleteは現行routeにcreatable callerがない未提供経路でありruntime未確認として残す |
| FGA-02-CUSTOMERS-MANAGER-03 | Completed | 一覧Createと、行選択を`CustomersManager`／AirArrayManagerの`beforeEdit`へ渡して詳細遷移後にfalseでdialogを抑止する実装・source/test・利用者Local確認を完了し、release `7d829966`のDevで作成、listener反映、詳細navigationを再受入れた |
| FGA-02-CUSTOMER-ARCHIVE-04 | Completed | archiveを専用dialog・Callableへ委譲しgeneric deleteを閉じた。release `7d829966`のDevで参照なし合成Customerのarchive、成功通知、一覧消失を受入れた。restore・physical deleteは製品非提供の別例外 |
| FGA-02-CUSTOMER-LOCAL-05 | Completed | 一覧CREATE、詳細navigation、詳細READ・UPDATE、listener反映、専用archiveをrelease `7d829966`のDevで受入れた。失敗経路は既存自動testとCAS-05証拠を維持し、Autocomplete runtimeは現行caller不在として非阻害扱い |
| FGA-02-CUSTOMER-MANAGER-SIMPLIFY-17 | Completed | Customer両Managerをbase Managerの既定editor・validation・mode・error eventへ戻し、単数activator、listener直接接続、暫定`includedKeys`、generic delete拒否へ整合した。release `7d829966`のDev正常操作で受入れた |
| FGA-02-CUSTOMER-DIRECT-FIREMODEL-18 | Completed | Customer通常CREATE・UPDATEをFireModel／ClientAdapterへ直接接続し、`useCustomerActions`、専用writer、Manager内permission再判定、不要なscope中継とManager固有error classを撤去した。archive例外を維持し、release `7d829966`のDevで受入れた |
| FGA-02-CUSTOMER-MANAGER-ACTIVATOR-21 | Completed | activatorのbase slot props pass-through、callerの`toCreate()`／`toUpdate()`利用、UPDATE前doc ID検査撤去、AutocompleteのDOM event非送出を実装・自動検証し、release `7d829966`のDevで到達可能な一覧CREATEと詳細UPDATEを受入れた |

## FGA-03 Site内部checkpoint

| Checkpoint | 状態 | 範囲・完了条件 |
|---|---|---|
| FGA-03-SITE-NORMAL-AUTH-01 | Completed | Siteの通常作成・基本情報・Customer・Agreement・手動終了・再有効化を、同一tenantの有効な認証済み本登録Userへrole非依存で許可するclient／Rules／Callable認可へ整合した。canonical User ID、tenant、無効・仮Userの拒否、archive strict actor、専用transaction、client delete・archive CUD拒否を維持し、domain 1,563件、Local Emulator 182件、文書validator、独立security reviewを完了してcommit `ec46497adc70174db7b36a025fe7f477100f5568`へ固定した。別actorのDev実操作は未実施だが、Local自動検証を代替証拠として利用者承認で閉じた。[Local検証記録](../verification/fga-03-site-normal-auth-local.md)を参照 |
| FGA-03-SITE-RULES-SIMPLIFY-04 | Completed | 通常Siteのfield・型・長さ・enum・通常timestamp・派生値・埋込みCustomer projection検査をRulesから正規application writerへ集約した。tenant・canonical User・actor UID・maintenance、ACTIVE、schedule・lifecycle、live Customer、client delete、archive CUD・tombstoneは維持した。Agreement保護は後続のFGA-03-SITE-MANAGER-LWW-05で通常Site更新へ置換し、同じ固定製品sourceのDev反映・受入れで閉じた。[Local検証記録](../verification/fga-03-site-rules-simplification-local.md)を参照 |
| FGA-03-SITE-MANAGER-LWW-05 | Completed | Site通常CREATE・UPDATEを`SiteManager`／`SitesManager`からSite modelへ直接接続し、通常保存用`useSiteActions`と専用writerを撤去した。3ステップ作成とCustomer未登録時の仮登録を維持する。取極めはremote履歴の画面内UIへ戻し、通常`Site.update()`、document last-write-wins、Rulesの通常Site更新へ統一して、専用Callable、baseline比較、競合拒否を撤去した。終了・再有効化・archiveだけを専用操作として分離する。対象domain 34件、全domain 1,546件、取極め・Customer参照の対象Emulator各1件、Emulator全体182件、Dev反映、Codex専用tenantの技術smoke、利用者の使用感・見た目受入れを完了した。tenant拒否とapplicationを介さないrequestは今回想定しない範囲 |

## FGA-04 Employee内部checkpoint

| Checkpoint | 状態 | 範囲・完了条件 |
|---|---|---|
| FGA-04-EMPLOYEE-CLASSIFICATION-01 | Completed | 保険番号・状態・日付・理由・履歴を通常Employee情報と確定し、role非依存のtenant共通read・編集、退職後編集禁止、状態遷移条件の維持、別document化・既存data migration不要を仕様・ADRへ反映した。製品code・Rules・data・Dev・Prodは変更せず、進捗加点なし |
| FGA-04-EMPLOYEE-MANAGER-LWW-02 | Completed | 一覧作成、基本・国籍・警備員・資格・3保険、両Manager、通常reader／Rulesをtenant共通権限とdocument last-write-winsへ揃えた。退職・復職・archive・User/Authは専用操作を維持する。旧通常保存Callable 6件をsourceとDevから撤去し、Local自動検証、Firestore・Functions・Hosting反映、Codex専用tenantでの通常作成・更新・再読込を完了した |

## FGA-05 Outsourcer内部checkpoint

| Checkpoint | 状態 | 範囲・完了条件 |
|---|---|---|
| FGA-05-OUTSOURCER-MANAGER-LWW-01 | Local verified / Dev pending | 両Manager、通常CREATE・UPDATE、Rulesをtenant共通権限とdocument last-write-winsへ揃え、旧専用保存経路を撤去した。Local自動検証は合格。固定commitのUI build、Dev反映、Codex専用tenantの作成・更新・再読込・見た目受入れ後に完了とする |

## 完了条件

- 提示された全ルールが一つのcurrent specificationとproject ruleへ矛盾なく反映され、置換された判断と未決事項が区別されている。
- Customer、Site、Employee、Outsourcer、その他transaction系の順で、承認済み全checkpointが実装・検証・必要なDev受入れまで完了している。
- 現行仕様と実装の既知不整合が0件、または利用者が明示承認した別phaseへ根拠・risk・開始条件付きで移されている。
- 最終差分のchange class union、必須gate、review、verification receipt、Git状態、未検証・残存risk、rollbackがcloseoutされている。
