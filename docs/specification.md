# AirGuardV2 現行仕様

- 最終更新日: 2026-09-08
- 仕様バージョン: 0.8.19
- 状態: 初期整理・運用中
- 現在の段階: 試験運用を伴うアジャイル開発

## 目的

AirGuardV2 は、警備会社が日常業務で扱うマスタ、配置予定、実績、勤怠、請求を一貫して管理し、重複入力とデータの不整合を減らすことを目的とする。

## 利用者

- 警備会社の管理者
- 管制・配置・請求・勤怠などを担当する権限付き利用者
- 自身に許可された予定・通知・設定を扱う従業員ユーザー
- 複数会社を管理・支援するスーパーユーザー

詳細な権限は Authentication、Firestore Security Rules、カスタムクレーム、および画面の権限制御を組み合わせて決定する。画面を非表示にするだけでデータアクセスを保護したものとみなさない。

## 対象範囲

### 現在対象となる機能

- 認証、ユーザー、会社、ロール・権限の管理
- 従業員、外注先、取引先、現場、取極めの管理
- 現場稼働予定、作業員配置、配置通知、上下番確定
- 稼働実績、従業員別日次勤怠、稼働請求、取引先請求の管理
- メンテナンス状態とキルスイッチ
- PWA、Firebase Cloud Messaging による通知
- 警備日報などの Firebase Storage ファイル管理
- freee 勤怠管理へ取り込む勤怠データのエクスポート

### 現在の範囲外または未確定

- AirGuardV2 内部での給与計算。給与計算は外部サービスへ委ねる。
- Stripe Checkout、Webhook、subscription、entitlement、employeeLimit。既存物はscaffoldとして作られただけで、Stripe側のCustomer・契約・Webhook等とCompany契約情報を同期した実績はない。現段階のCompany構造からlegacy Stripe情報を削除し、将来サブスクリプション機能を実装するときにproviderを含む保存構造・権限・外部作用を新規設計する。
- 未実装と明記された将来案を、現行機能として保証すること。
- 本文書で確認できていない本番運用の SLA、保存期間、法令・認証への適合保証。

## システム境界

### フロントエンド

- Nuxt 3、Vue 3、Vuetify、Pinia を使用する。
- Firebase Hosting 向けの CSR SPA とし、PWA Service Worker を持つ。
- `air-vuetify-v3` をファイル参照で使用する。
- Firestore 用モデルは `air-guard-v2-schemas`、基底実装は `air-firebase-v2`、クライアント注入は `air-firebase-v2-client-adapter` が提供する。
- role presetの識別子、表示metadata、permission配列は`@shisyamo4131/air-guard-v2-schemas/constants`を環境非依存の単一正本とし、ルートアプリとCloud Functionsは同じ公開version・tarball・integrityを使用する。現在の確認済みversionはlegacy Stripe fieldをCompany schemaから除去したexact `3.0.0-dev.1`である。このpackage catalogはactor・tenant・target・request contextからallow/denyを決定せず、clientとFunctionsがそれぞれ認可policyを所有する。
- Schemas packageを更新する前後は、当該turnでsource tag manifest、repository release evidence、AirGuardV2 root/Functionsのmanifest・lockにあるname、version、resolved、integrityを機械照合する。prompt、chat、要約、agent reportだけでpackage identityを確定せず、矛盾時はconsumer file変更・install・testを開始しない。`3.0.0-dev.1`はSTRIPE-02でroot/Functionsへ導入し、`PostAdoption`で同一version・tarball・integrityを確認済みである。旧`2.4.2-dev.167`はこのlocal checkpointのrollback baselineとして履歴保持する。
- ドメイン上の操作可否をclientで事前検証する機能は、UI非依存の純粋policy、policyを適用して操作可否・拒否理由・実行処理を提供するapplication composable、結果を表示するcomponentへ責務を分離する。client判定はUX補助であり、serverの最終認可を代替しない。
- 登録済みpage routeは、`public`、`roles`、User管理固有fieldを個別に保持せず、Vue/Nuxt非依存の共有`accessPolicy` catalogを1件だけ参照する。route middlewareとnavigationは同じpolicy evaluatorを使用し、pathを持たないnavigation groupの表示はアクセス可能な子itemから導出する。未知policy、複製policy、旧fieldとの併記、不正なUser管理contextはclientでfail closedとする。
- 認証済み業務pageの表示と遷移は、現在のAuthentication UID・company claim、メール確認状態、同じ会社のUser document、有効・本登録状態、会社管理者field、既知role／直接permission、および型が正しいspecial claimを一つのaccess contextとして判定する。保存User roleに`admin`、`super-user`、`developer`、`*`または不正な値が含まれる場合は許可根拠にせずfail closedとし、会社管理者・super-user・developerはそれぞれ正式fieldまたはboolean claimだけから導出する。Employee閲覧、User管理、User lifecycle等の個別に厳格なpolicyは一般permission判定へ緩和しない。
- navigation、route middleware、表示中pageの再認可は同じaccess contextとpolicy evaluatorを使用する。権限外のmenuは表示せず、未登録routeまたは権限外pageへの遷移と、表示中のrole・無効状態・tenant・special claim変更による権限喪失はdashboardへ戻す。dashboardは認証session初期化失敗時を含む安全な遷移先とし、未認証、メール未確認・会社未確立、maintenanceは各専用経路を優先する。このclient判定はUX gateであり、Firestore Rulesまたはserver認可を代替しない。

### バックエンド

- Firebase Authentication、Firestore、Realtime Database、Storage、Cloud Functions、Hosting を使用する。
- Cloud Functions は Node.js 22 を使用する。
- サーバー側モデル注入には `air-firebase-v2-server-adapter` を使用する。
- 外部システムとして freee 勤怠管理がある。Firebase Cloud Messaging は通知配送を担う。Stripeは将来のサブスクリプション候補であり、現在利用中の外部連携として扱わない。

### 検証・試行環境

- local環境はFirebase Emulatorを使用し、test用の1社だけを扱う。
- Dev環境は利用者の会社と協力会社の2社が試用する非本番のremote試行環境である。一般公開はしていないが、会社境界を持つ試行環境として認証・認可・tenant分離を必須とする。正式運用準備または正式運用開始の完了判定をDev deployの前提にせず、検証済み変更を積極的にdeployして実利用条件の受入れ証拠を得る。
- Codexは対象commit、Firebase service、data影響、backup、rollback、停止条件、検証を含む利用者承認済みのbounded Dev release checkpointだけでDevへ接続する。同checkpoint内の静的生成、deploy、remote検証はcommandごとの再承認を必要としないが、新しいdata migration、破壊的repair、対象拡張、Prod適用は別の明示承認を必要とする。

## 共通データ仕様

この節はcollectionをまたぐ確認済みの原則である。個別仕様には操作を提供するか、実行者・閲覧者、従属documentの一覧、固有の状態・field条件を置く。共通仕様の採用だけで既存全collectionの実装を切り替えない。実装との差は[archive調査](implementation/archive-restore.md)と[住所・座標調査](implementation/address-geocoding.md)、採用理由は[ADR 0060](decisions/0060-common-archive-purge-and-address-contract.md)を参照する。

### ドキュメントのアーカイブと物理削除

この節のarchive後の物理削除は、archiveを提供するマスタdocumentの契約である。User/Authの専用account削除、業務transactionの取消・削除、会社全体の保守削除へarchiveを新たに要求せず、それぞれの固有契約を維持する。

- アーカイブは、誤登録・重複など通常業務に使用すべきでないdocumentを、同一会社の別archive collectionへ同じdocument IDで移し、通常collectionから取り除く操作とする。正常な退職・取引終了と区別し、過去業務の参照先を消す代替手段にしない。
- archiveには原本snapshotと、形式version・実行者・server時刻・理由・操作IDを保持する。元documentの通常更新日時とarchive日時を混同しない。原本の読取り、従属検査、同ID archive不存在確認、archive作成と原本削除を同じ保存単位で確定し、部分移動・上書きを許さない。
- 従属documentが一つでも存在すればarchiveを拒否する。検査不能・不正dataを「従属なし」としない。対象一覧は子collectionだけでなく業務上の参照、連携・予約、必要な履歴・背景処理を個別に確定する。従属を連鎖削除して条件を満たさない。
- 参照を新設・変更する保存境界は、参照先が同社の通常collectionに存在することを保存と整合する形で確認する。UI候補からの除外だけに依存せず、直接write、旧client、Admin SDK、遅延処理による迂回を防ぐ。参照IDが変わらない更新に全参照先の再読取りを一律要求しない。
- archiveを通常一覧・検索・選択候補へ混ぜず、通常業務で新規参照できないものとする。archiveの閲覧権限は個別に定め、通常原本のread許可から自動的に導かない。archiveへの参照が検出された場合は不整合として扱い、archiveから名前を補完して正常な業務記録に見せかけない。
- 物理削除は、archive済みdocument本体をFirestoreから抹消する別操作とする。削除時にも従属なし・対象同一性・認可を再確認し、従属あり・不整合・検査失敗なら削除せず原因を記録する。archive完了だけを理由に無条件削除しない。バックアップ、外部出力や別契約の操作記録まで消去したとは表現しない。
- 応答不明時は対象と操作IDを照合し、同じ操作の再送で上書き・再生成・別対象の削除を起こさない。archive後・物理削除後の旧ID再利用と古い要求を防ぐ仕組みを、各操作を開放する前に定める。復元を提供する場合も通常原本の同ID上書きは禁止し、User/Authなどの自動復元を含めない。
- 共通化は全masterへのarchive・物理削除・restore UIの一律追加を意味しない。Customer/Siteの既存固有条件と、Outsourcerでこれらを提供しない条件は維持する。定期実行、保持期限、削除実行の担当・承認、エラー一覧の保存方式は個別の運用判断とし、自動purgeをこの仕様だけで有効化しない。

### 住所と座標

- 入力住所を業務情報の正本とし、座標はその住所から取得する補助情報とする。住所保存の可否を座標providerの成否だけで決めない。住所の必須項目、対象となる住所、利用目的・閲覧権限は個別仕様に置き、同じ失敗時仕様をmasterごとに再確認しない。
- 新規作成・座標取得対象住所の変更で座標取得だけが失敗しても、入力・認可・競合検証を満たした住所は保存する。古い住所の座標を残さず未取得とし、保存成功後に「住所は保存済み、座標は未取得」と通知する。Firestore保存自体の失敗や結果不明を住所保存成功と表示しない。
- 座標取得対象住所が変わらない通常更新では、既存座標を保持する。国籍・保険等の無関係な編集で座標を取得し直さない。住所変更中に届いた古い取得結果を新しい住所へ適用せず、住所と対応する座標を一緒に確定する。
- 未取得と数値0を区別し、緯度・経度が0でも有効範囲内の有限数なら有効とする。座標を使う画面は未取得を扱い、所在地の不存在と解釈しない。providerの整形住所で入力住所を無断に上書きしない。
- providerへの呼出しを再試行されるFirestore transaction内へ入れず、認可された対象住所の必要な処理だけに限定する。住所・座標・provider応答全文を通常logへ出さない。実providerへの接続、既存全件の再取得・削除・正規化は、この仕様整理から自動実行しない。
- 郵便番号・建物名の座標取得への使用範囲、郵便番号検索provider、正規化・再取得UIは別の未決事項とする。現在の住所fieldや必須条件を、共通化だけを理由に変更しない。

## テナントと認証

- 会社データは `Companies/{companyId}` 以下を基本とし、会社単位で分離する。
- 認証ユーザーのカスタムクレームと会社 ID をデータアクセス判定に用いる。
- `Companies/{companyId}` の会社documentはclientから作成・削除できず、初期作成はCloud Functions/Admin SDKだけが行う。同一会社の有効な本登録Userによる既存document更新は、field・actor境界を機能単位で移行するまでの互換経路として維持する。
- Firestoreのclient書込み境界はcollection名だけで一律に決めず、各機能のactor、field ownership、整合性、監査、同時実行、offline要件を確認して機能単位で見直す。CUDを常にFunctionsへ移すこと、または常にclient Rulesへ残すことのどちらも共通原則とはしない。
- マスタ管理機能の改修中は対象masterのCRUDを主対象とし、配置・通知・稼働実績・請求・帳票などtransaction系機能への波及変更はFirestore更新に関係しない互換修正に限定する。transaction系の要改修箇所を検出しても実装せず既知課題へ記録し、マスタ管理の一連の改修後に別checkpointで見直す。Employee archiveの参照整合性に必要なwriter・Rules・索引・背景処理だけはADR 0060の限定例外として設計対象に含め、実装はEmployeeの合意済み工程で行う。
- 配置管理の予定と配置作業員を作成・変更・削除・並べ替えする正式保存境界は専用Callableとする。通常の可逆な変更は、操作後の「なるべき形」を直ちにclientの表示用状態へ反映し、保存中を理由に予定cardや作業員操作を一律停止せず、client側のpending lock、single-flight queue、更新順保証を設けない。Firestore listenerから届く正本で表示用状態を置き換えて収束させる。短時間の連続操作や複数actorの競合による保存拒否、一時的な表示訂正は試験運用中の既知trade-offとして受容し、実測の業務影響が確認されたoperationだけを後続checkpointで補強する。失敗は利用者へ表示し、認証・認可、復旧困難な削除、通知等の外部作用、結果不明の再送に必要な個別保護は維持する。
- Prod公開前までに、既存のmaster dataとtransaction dataの作成・更新・削除を機能単位で順番に見直す。clientから直接書くoperationはFirestore Rulesで同一会社、必要なpermission、変更可能field、型、状態を強制し、Callableを使うoperationは同じ条件をserver側で再確認する。画面の表示・非表示だけを認可根拠にしない。
- 4マスターUI改修の完了後は、Firestore Rulesの責務と式数を整理する工程を必須の次phaseとして開始する。一括書換えは行わず、collectionとclient／server利用経路の棚卸し、未定義collectionを許可しない既定拒否への移行、副作用・金銭・通知を伴う高risk更新のCallable化、Site Rulesの式数削減、必要な場合だけの公開field分離を、rollback可能なcheckpointに分ける。各checkpointでは既存query・schema・tenant・actor・field・状態遷移との互換性を確認し、Rules／Emulatorの許可・拒否testを通してから次へ進む。
- App Checkの実装・強制、全般的なrate limit、Callable public invokerの常時監視はProd公開前の必須gateとして扱い、Devでの個別機能追加の前提にしない。ただしFunctionsを追加または変更してDevへ反映する場合は、対象Functionへ正規画面から到達できるpublic invoker・CORSをrelease確認として検証する。未認証入口、外部費用、異常呼出しの具体的なriskが確認された場合は、該当operationだけを前倒しで対処する。
- Company設定ではsuper-userであることだけを正式actorの根拠にしない。会社横断の保守・migration・repairは、恒久的なCompany設定権限ではなく、対象と作用を限定して個別承認されたservice provider/operator手順として扱う。表示順だけは、同じtenantの有効な本登録会社管理者でもあるsuper-userに、自社の`siteOrder`と`scheduleOrder`の更新を許可する。会社管理者でないsuper-user、他tenant、profile・billing・operations等の他のCompany設定にはこの例外を広げない。
- スーパーユーザーの例外権限は、明示されたルール・サーバー処理だけで許可する。
- スーパーユーザーに対する恒久的な全会社Firestore client read/write bypassは廃止する。将来、遠隔地の他社利用者を支援するため、所属会社を持つ有効なスーパーユーザーが、未確定の明示的な手続きを経て対象会社のdataをその場で扱えるsupport accessを提供する構想があるが、現時点では未実装とする。
- 各会社の会社管理者は`User.isAdmin === true`の1人だけとする。
- 会社管理者と統括（`manager`）は、自社の通常業務機能を閲覧・作成・更新できる。通常業務の権限から、課金、管理者移譲・会社管理者accountの変更、archive・退職等の専用操作を自動的に導出せず、専用操作は個別のactor条件を優先する。統括による自己の管理者化や会社管理者accountの変更を通じた課金権限の取得を許可しない。既存の他tenant、自己操作、状態、確定済みdata、field ownershipの拒否条件を「全機能」の語で解除しない。判断理由と残る個別条件は[ADR 0056](decisions/0056-employee-role-and-archive-boundary.md)を参照する。
- Userは、Employeeとの紐付けを持たない単独Userと、同じ会社のEmployeeへ`User.employeeId`で紐付くEmployee連携Userに分類する。仮登録・本登録、管理者、有効・無効はUser種類とは別の状態として扱う。
- 会社管理者に加え、`users:provision` permissionを持つ有効な本登録Userは、同じ会社の仮登録Userを作成・削除できる。`manager`には`users:provision`と`users:write`、`human-resource`には`users:provision`だけを明示付与する。`employees:write`だけではUserアカウント管理を許可しない。
- 既知presetの判定はpackageの`isRolePresetId`によるown-catalog membershipだけを使用し、通常の未知値に加えて`toString`、`constructor`、`__proto__`をstrict client/Functions経路でfail closedとする。strict `hasPresetPermission`と`resolveRolePermissions`は直接permission文字列をpresetとして受け入れない。一方、一般clientの`getPermissions`が未知文字列を直接permissionとして扱う既存互換挙動は維持し、strict認可へ流用しない。`*:write`から同resourceの`*:read`を導出する規則もconsumer側の責務とする。
- 単独仮Userの作成とEmployee連携仮Userの作成は別の公開操作として扱う。Employee連携では、同じ会社に実在し、他のUserと紐付いていないEmployeeだけをserver側で確定し、client指定の任意`employeeId`を信頼しない。1 Employeeに紐付くUserは最大1件とする。
- 仮登録User作成時の`companyId`、`isTemporary=true`、`isAdmin=false`、`disabled=false`はserverが確定する。Employee連携は在職中のEmployeeだけを対象とする。会社管理者または既知preset由来の`users:write`保有者だけが、単独・Employee連携の作成時に既知role presetを任意設定できる。`users:provision`だけのactorはroleを設定できず、非空roles入力をserverが拒否して保存値を空配列に限定する。
- 有効な本登録Userは、自分のアプリ内表示名`displayName`と利用環境のタグ表示サイズ`tagSize`だけを本人設定として変更できる。業務通知の3フラグと他Userのroleは`users:write`を持つmanagerまたは会社管理者が管理する。自己role変更、会社管理者を対象とするrole・状態変更、`isAdmin`の通常更新は許可しない。このfield別更新境界はUWB-05の専用Callableへ接続済みで、自動検証と利用者受入れを完了している。
- `/settings/users`のroute・navigationは会社管理者または既知preset由来の`users:write`へ限定する。直接permission文字列、未知role、`isSuperUser`だけをUser管理権限の根拠にせず、clientの表示・disabledはserver認可の代替にしない。super-userは従来どおり`/settings/company`へアクセスでき、子itemから表示を導出するnavigationでも会社設定だけを表示するが、User管理は表示・許可しない。共通managerのsubmitは処理中の再入を拒否し、有効化・無効化、管理者移譲、本人プロフィール保存は共通operation stateで対象ごとのpendingを管理する。複数tab・端末・actorと未対応clientに対しては、role更新の`expectedRoles`と有効・無効変更の`expectedDisabled`をtransaction内現在値と比較し、対象Userのlifecycle lockが存在する要求を拒否する。競合は上書きせず`aborted`とし、最新状態の再確認を求める。全documentへの汎用single-flight、revision、lock、operation ledgerは採用せず、通知設定・本人プロフィール・通常の業務CRUDへこの認証専用preconditionを展開しない。
- 全Userのcanonical email一意性は`UserEmailReservations/{sha256(trim(lowercase(email)))}`を正本とし、Employee連携の一意性は`Companies/{companyId}/EmployeeUserReservations/{employeeId}`を正本とする。User作成、本登録変換、仮登録削除、初期会社管理者作成は、対応する予約pointerを同じFirestore transactionで作成・更新・削除する。予約欠損・不正・不一致はfail closedとし、runtimeで旧queryへfallbackしない。
- 予約導入前の既存Userは、対象環境を固定したmigrationのdry-run、plan digest、競合再検査を経てbackfillする。Dev初回backfillはmissing予約のcreateだけを許可し、既存予約のupdate・delete、User・Employee・Authenticationの変更を行わない。競合、不正、orphan、stale pointerは自動修復せず、別の管理者repairとして扱う。
- UWBをDevへ初めて導入するときは、予約処理だけを選択的にdeployしない。System全体maintenanceを維持した一つのcutoverで、UWBのFirestore・Storage・Realtime Database Rules、全変更Functionsと共有contract、予約migration、client/Hostingを整合したreleaseとして導入する。server境界を先に有効化し、旧処理のin-flight収束後にfresh dry-runと予約backfillを行い、clientを切り替え、全体検証後にだけmaintenanceを解除する。
- email利用可否の事前確認は権利確保ではなくUX上のadvisoryであり、最終的な一意性は作成transactionが判定する。AuthenticationとFirestoreはatomicに更新できないため、Authだけまたはclaims未設定の部分状態を自動的に完全解消する保証は持たず、整合した再実行と後続reconcileで扱う。
- Employee連携Userは、自身に紐付くEmployee情報へアクセスできるものとする。本人へ公開するfieldと提供pathは、Employee文書全体の過剰開示を避ける別のEmployee Self Access境界で確定するまでは未実装とする。
- 有効な本登録会社管理者だけが、同じ会社の別の本登録非管理者Userを有効化・無効化できる。会社管理者は自分自身を無効化できず、必要な場合は先に同社の別Userへ管理者権限を移譲する。
- 本登録UserからAirGuardV2の操作権限だけを一時的または継続的に剥奪し、雇用・業務記録上のEmployeeを維持する場合は、UserとAuthenticationを削除せず既存の無効化を使用する。
- Employee退職は専用操作とし、同社の有効な本登録会社管理者、統括、人事へ許可する。`employees:write`、`users:provision`、`users:write`という文字列だけでは退職を許可せず、既知roleと専用操作のactor条件を検証する。退職日はserverのAsia/Tokyo暦日を基準に入社日以降かつ実行日以前に限定し、自己退職等の既存対象guardを維持する。実装への適用は[Employeeロードマップ](roadmaps/employee.md)で管理する。
- Employeeの退職に伴って本登録Userを削除する場合は、旧accountが別tenantでの同じメールアドレスの新規登録を妨げないようAuthentication accountとUser documentを物理削除し、User email予約とEmployee予約を解放する。Employee documentとEmployeeに紐付く勤怠・配置・請求等の業務記録は削除せず、Employeeを`RESIGNED`として保持する。Employeeだけ、仮登録User連携、本登録User連携を予約pointerから識別し、queryの先頭Userへfallbackしない。仮登録User連携は退職操作内でAuthをemailから推定・削除せず、既存の仮登録削除を完了してEmployee-only状態を確認してから退職を再実行する。signup途中のAuth-only部分状態は退職操作の対象にせず、別のaccount repairで扱う。Auth削除直後に同emailの別Authが作成される競合では新UIDを自動削除せず、再登録を無条件には保証しない。
- Employeeに紐付かない単独本登録Userの物理削除は、退職とは別のaccount offboarding操作とし、有効な本登録会社管理者だけに許可する。自己、会社管理者、super-user、他社User、仮登録User、Employee連携Userは対象外とし、Employee連携UserにはEmployee退職操作、仮登録Userには既存の仮登録削除操作を使用する。
- 物理削除したUser/Authは`Users_archive`へ保存せず、旧UID、email、role、通知設定、User/Auth全文を復元しない。Employee連携Userは必要なEmployee状態を訂正した後にEmployee連携User作成、単独Userは会社管理者による単独仮User作成を改めて実行し、新しいAuth UIDとUser、role・設定を作る。旧UIDを持つ履歴は新UIDへ書き換えず、一般表示で解決できない場合は削除済みUserとして扱う。
- Employee退職、単独本登録User削除、誤退職訂正の実行状態と監査は、server-onlyの`LifecycleOperations`を操作単位の唯一の正本とする。operation ID、対象別lock、Auth削除前の永続的intent、phase、再試行、部分失敗reconcile、完了結果を保持し、clientからの直接read/writeを許可しない。email、email hash、role、通知設定、User/Auth全文、FCM tokenは保存しない。actor UIDと最大6文字の表示名、target UIDと最大6文字の表示名、Employee ID、退職日・現在上限20文字の退職理由、単独User削除理由を操作種別に必要な最小snapshotとしてserver-onlyで保持する。
- UWB-07の全Callableは、ID tokenだけでなく現在のAuthentication accountと同社の有効な本登録Userを再取得し、UID、確認済みemail、company claim、super-user、disabled状態を照合してから認可する。Userをaccess-revoked状態へ移した後は通知dispatcherも有効な本登録User・会社一致・非disabledを送信直前に再検証し、FcmTokensのcreateを同じ条件・token/document ID一致・field allowlistへ限定してclient updateを拒否する。client deleteは本人所有tokenの削除だけ、server cleanupはAdmin SDKだけに許可する。外部FCM送信と退職transactionはatomicにできないため、commit前にeligibility確認を通過したin-flight messageは回収不能riskとして区別する。raw・partial tokenとtoken由来識別子、通知本文、custom dataをlogへ保存しない。
- 誤って完了したEmployee退職は、会社管理者専用の訂正操作で同じEmployee documentを`ACTIVE`へ戻し、現在値の退職日・退職理由を消去できる。元の退職operationは変更・削除せず、訂正operationから参照する。訂正は完了済みのUWB-07退職だけを対象とし、旧User/Authを自動復元せず、業務記録を変更しない。UWB-07導入前の退職者は別のbackfillまたは管理者repair、実際の退職期間を伴う再雇用は別の雇用状態設計として扱う。
- `LifecycleOperations`は現段階で固定の保存期間を設けず、自動削除しない。operation、event、head、reverse参照を維持し、削除を前提とするlegal hold、完了後識別子縮小、purgeは実装しない。data量、法令・社内規程、privacy、費用、運用上の必要性から見直しが必要と判断した時点で、参照整合性、訂正可能性、移行、復旧を含めて改めて仕様変更する。履歴一覧はFirestoreをclientへ直接公開せず、有効な本登録会社管理者だけが専用Callableの最小projectionで閲覧できるものとする。
- 履歴一覧は`listLifecycleOperations` Callableだけから取得し、`/settings/lifecycle-history`の「退職・アカウント削除履歴」へ新しい順に20件ずつ表示する。入力は同じ会社の次page開始位置を表す`cursor`だけとし、会社ID、件数、検索・filter・sort条件をclientから受け取らない。会社IDは検証済みAuthentication identityからserverが導出し、現在のAuthと同社Userを再取得して、有効・本登録・非super-user・会社管理者であることを毎回確認する。super-user、manager、human-resource、直接permissionだけのUserにはroute、navigation、Callableを許可しない。
- 履歴projectionはschema version、最大20件のitem、次page cursorだけを返す。各itemは操作種別、`processing|retrying|completed`へ丸めた公開状態、実行者表示名、Employee IDまたは削除対象表示名、User account削除を含む操作かどうか、退職日、理由、作成・完了時刻だけに限定する。raw state、actor/target UID、request fingerprint、Auth・cleanup disposition、attempt、内部error、event、lock、head、email、role、claim、tokenを返さない。operation IDは次page cursorとしてclientへ渡り得る非秘密の同社内位置情報であり、認可token、会社特定、画面表示、logには使用しない。検索、filter、CSV export、total count、全page事前取得、永続client cacheは初期範囲外とする。
- 保存stateは`completed`を公開`completed`、`failed-retryable`とcleanup失敗中の`data-finalized`を`retrying`、その他の有効な未完了stateを`processing`へ変換する。取得record、cursor、Timestamp、document IDのいずれかがschemaと一致しない場合は不完全な一覧を成功扱いせずpage全体をfail closedとする。clientは初回・空・安全なerror・再試行・前後page、権限喪失とunmount時のmemory破棄を扱い、Firestoreからledgerや現在のUser/Employeeを直接読み直さない。
- 以下はADR 0056採用前のUWB契約に対する過去の実装・検証記録であり、統括退職追加の適用済み証拠ではない。追加要件の適用状態は[Employeeロードマップ](roadmaps/employee.md)を参照する。client/serverのpermission catalog、Functions内のA/B/C input・actor・target純粋policy、server-only operation/event/lock/head schema、transaction store、共通registered User削除phase engine、A/B/C Callable、5分間隔reconciler、訂正用最小context、Rules、application UIは実装・自動検証済みで、Codex UI smokeと利用者local UI受入れも完了している。履歴一覧readerもCallable、専用page、route・navigation、cursor paging、自動単体・Emulator・Rules検証まで完了している。2026-08-25と26に利用者のログイン済みChromeで管理者menuから専用pageへ到達し、loading、空状態、無効な前後buttonを確認した。対象環境に履歴dataがないため実browser用に21件の退職・削除を作らず、data行のexact projection、20/21件境界、cursorによる次page・前page再取得は単体・Emulatorで検証する。current Auth disabled、仮User連携、別tenant同email再登録・Auth-only raceを含む残存陰性証拠も専用Emulatorで完了した。UWB-08の`firestore.rules`は、User client write拒否、Employee lifecycle field・delete拒否、lifecycle ledger/event/lock/head直接access拒否の3点について利用者確認を完了した。
- 管理者アカウントは誤削除を防ぐため削除不可とする。他に同社Userがいない最後の会社管理者も無効化できない。会社単位のAirGuardV2利用停止は、管理者無効化とは別の将来機能として扱い、現時点では未実装とする。
- 一般Userの本登録では、Authenticationで確認済みのcanonical emailに対応するemail予約が、一意の有効な仮登録Userを指すことを本人確認条件とする。確認完了前の本登録、会社ID・仮User IDをclient入力だけで信頼する処理、予約とUserの不一致は許可しない。
- 本登録前の未認証事前登録確認は、email予約とそのpointer先User、必要なEmployee予約が整合する場合だけ登録済みという真偽値を返す。会社ID、表示名、role、仮User IDは返さない。存在有無の列挙と招待tokenは別の未完了security境界とする。App Checkと全般的なrate limitはProd公開前の必須gateで扱い、具体的な濫用を確認した場合だけ該当operationを前倒しする。
- 一般Userのclient登録はAuthentication account作成と確認メール送信までとし、メール確認後に更新したID tokenで本登録Callableを呼ぶ。本登録Callableはclient dataを受け取らず、確認済みAuthenticationメールから仮登録と会社をserver側で解決する。
- 初期会社管理者のsignup前メール確認は、clientからemailだけを受け取り、Authenticationとemail予約を照合する未認証のUX事前確認とする。client指定の管理者・一般User区分は信頼せず、一般User signupではこのCallableを使用しない。事前確認とAuth/User作成はatomicではないため、同時実行競合とAuthだけが残る部分状態を防ぐ認可境界とはみなさない。
- 初期会社管理者のCompany・User作成はメール確認後にだけ行う。CallableはID tokenと現在のAuthentication UserについてUID、email、email確認、有効状態、既存company claim、`isSuperUser`の型と一致を検証する。未所属Authだけが新規作成でき、同じUIDの有効な初期管理者UserとCompanyが既に存在する場合は、claims設定失敗後の再実行として既存状態を検証して再利用する。
- 保護対象のFirestore、Storage、Callableは、確認済みメール、正常な会社claim、要求tenant path、対応する有効な本登録Userの整合がすべて確認できる場合だけ許可する。claim欠損、型不正、path不一致、User不在、仮登録、無効状態ではfail closedとする。本登録Callableは、会社claimと本登録Userがまだ存在しない確認済みUserにだけ必要なbootstrap例外として扱う。
- 会社所属が確立した認証必須Callableは、API固有の入力・権限・対象検査より先に、ID tokenと現在のAuthentication UserのUID、email、email確認、company claim、`isSuperUser`のboolean型と値、有効状態を共通境界で照合する。不一致や既に無効なAuthはfail closedとし、確認済みidentityだけを後段へ渡す。未認証で利用できる事前確認Callableはこの境界の対象外とし、初期管理者・一般Userの本登録Callableは所属claim確立前のbootstrapとして専用検査を使用する。
- スーパーユーザー向けの履歴再構築と警備日報インデックス再構築は、要求会社がID tokenの会社claimと一致し、現在のAuthentication Userがメール確認済み・有効・同社会社claim・`isSuperUser === true`であり、同社のUser documentも有効な本登録状態である場合だけ許可する。恒久的な他社再構築は許可しない。
- 仮登録User作成前の独立した全会社email重複確認Callableは公開せず、作成Callable内部でAuthenticationとemail予約を確認する。User一覧とEmployee詳細は同じclient作成policy・application controllerを使い、送信直前にも会社管理者またはstrict preset由来`users:provision`を再評価し、role指定時は別に`users:write`を要求するが、server最終認可を代替しない。
- 従業員の退職、Employeeの業務状態変更、Userの利用停止、Authentication accountとUser documentの削除は別の状態遷移として扱い、専用use-caseが順序・再試行・部分失敗を管理する。退職時もEmployeeと業務記録の関係を保つ。
- User管理の段階改修では、まず仮登録Userと保護fieldの境界を確立する。本登録Userの利用停止・退職・削除境界はUWB内の専用ゲート、本人向けEmployee情報の具体的なread境界は別のEmployee Self Accessゲートで確定する。

## 主要データと業務規則

### Company設定とtenant lifecycle

- 改修コードは`CCB`（Company Configuration Boundary）とする。2026-08-30に旧8 document・runtime互換設計を廃止し、[ADR 0031](decisions/0031-proportional-data-boundary-and-change-safeguards.md)に従って設計をrestartした。現行単一Company documentからの移行は未実施である。
- CCBの主目的は、会社情報、通常設定、旧Stripe情報等が混在したCompanyをwhole-document replacementする現行経路を廃止し、operationが所有するexact fieldだけを更新することである。
- Companyを含むFirestore CRUDの新規・改修画面では、`AirItemManager`または`AirArrayManager`へ入力draft、dialog、validation、永続化、表示同期を一括委譲しない。Companyは基本情報、振込先、通常設定、表示順等のoperation固有editorとapplication処理へ段階移行し、既存managerは対象operationの移行完了ごとに外す。
- document全体の必須・型・長さ・相関はFireModel/Class schemaを正本とする。operation固有の入力fieldと追加必須条件は共有operation contractへ定義し、個別画面へ同じ業務validationを複製しない。保存前は最新Companyへ変更fieldを重ねたcandidateを検証し、実際に変更されたoperation所有fieldと`updatedAt`・更新者だけを保存する。
- editorはreal-time listenerが更新するCompany本体と独立したdraftを使う。編集中に同じoperation所有fieldの外部更新を検出した場合はdraftを黙って置換せず、最新値の通知と再読込手段を示す。operationごとに再読込必須または明示再確認後のlast-write-winsのどちらかを定める。Company基本情報、振込先、通常設定、表示順は保存を停止し、「最新値を読み直す」だけを表示して現在draftの破棄・再入力を求める。自分の保存結果がlistenerへ反映された場合は外部競合として表示しない。
- 一つのCompany documentを既定とし、同じactorが読める会社情報・通常設定・利用状態は同居できる。読取actor、保存・削除・復旧条件、増加し続ける量、具体的なdocument size、独立query、field限定updateで解消できない実測競合のいずれかがあるfieldだけを別documentへ分割する。writer権限や画面が違うだけでは分割しない。
- 振込先はCompany rootの現行read境界を維持し、同社の有効な本登録Userが読める。振込先を読取actor別documentへ分割せず、変更は同じtenantの有効な本登録会社管理者または統括へ許可し、既存のsuper-user拒否条件を維持する。これは顧客向け請求に使う会社振込先であり、システム利用料の契約・課金とは分ける。その他のCompany通常業務設定も会社管理者・統括の更新対象とし、正確なread集合と他roleのoperation別write条件は個別仕様に従う。clientまたはCallableの選択は、server-only情報、外部作用、不可逆性等の条件からoperation単位で決める。
- 通常の可逆なCompany編集はreal-time listenerで最新値を反映し、保存結果はlast-write-winsを受容する。編集中の同一operationへ別actorの変更が届いた場合は通知し、operation contractに従って再読込または明示再確認を要求する。共通revision、lock、operation ledgerは導入しない。
- expected value、transaction、idempotency、lock、ledgerは、権限・利用停止、削除、金銭、外部service、複数resource、復旧困難なdata loss、二重実行の具体的被害があるoperationだけに限定する。
- `siteOrder`と`scheduleOrder`は各最大2000件という現行候補上限と実際のdocument sizeを再計測し、Company本体と分ける必要性を判断する。分割前提にはしない。
- Devで確認済みのCompany rootは4件であり、旧新形式を通常運用で併存させず、UWBと同じFirestore全体snapshot、fresh dry-run、旧2 fieldだけの一括削除、post-check、Dev受入れを一つのbounded migrationとして実施する。Stripeは未使用で外部からの更新経路もなく、現行client・Functionsも旧fieldを生成・更新しないため、この恒久cleanupではmaintenance、外部Stripeの前後確認、旧field専用backup・data rollbackを要求しない。実data migrationは対象commit、件数、全体snapshot、停止条件、検証を固定した別の明示承認を必要とする。
- 設定文字列の長さはUnicode Extended Grapheme Cluster単位、すなわち利用者が見た目上1文字と認識する単位で数える。結合文字で表した`が`も合成済みの`が`も1文字である。外側の空白はtrimするが、保存値へNFC/NFKC等のUnicode正規化を自動適用しない。1行fieldはCR/LFとcontrol characterを拒否する。
- 会社名はtrim後1〜100文字、会社名カナはtrim後1〜200文字とし、一意性を要求しない。カナはUnicode `U+30A0–U+30FF`、全角空白`U+3000`、全角数字`U+FF10–U+FF19`、control characterを除く空白を許可する。結合濁点`U+3099`・結合半濁点`U+309A`は直前の`U+30A0–U+30FF`と同一grapheme clusterを構成する場合だけ許可し、単独または他のbase直後では拒否する。郵便番号はnullまたはASCII数字7桁、都道府県codeはnullまたは`01`〜`47`、市区町村はnullまたは100文字以内、番地・建物はnullまたは各200文字以内、電話・FAXはnullまたは32文字以内のASCII数字・`+ - ( ) .`・空白だけとする。初期signupは会社名とカナだけで通常利用へ進める。請求確定時は会社名、郵便番号、都道府県、市区町村、番地、電話を必須とし、建物、FAX、適格請求書番号、振込先は任意とする。
- 適格請求書番号は保存時に先頭の`T`/`t`を除き13桁のASCII数字だけへ正規化する。空入力はnullとし、表示・帳票では存在する場合だけ大文字`T`を付ける。
- 振込先は5 fieldすべてnullを許可する。1項目でも入力する場合は銀行名、支店名、口座種別、口座番号、口座名義をすべて必須とし、銀行名・支店名は各100文字以内、口座種別は普通・当座、口座番号は先頭0を保持するASCII数字1〜7桁、口座名義はtrim後200文字以内とする。画面は明示的なクリア操作で5 fieldすべてをnullへ戻せる。legacyの他4 fieldが空で`accountType=普通`だけの状態は未登録表示へ正規化し、画面を開くまたは変更なしで保存するだけでは永続値を書き換えない。partial legacy値は完全な5 fieldへの修復または全null化だけを許可する。
- 振込先更新は専用`updateCompanyBilling` Callableを使う。requestはnon-emptyな`changes`だけを持ち、変更可能keyを`bankName/branchName/accountType/accountNumber/accountHolder`のsubsetへ限定する。tenant pathは検証済みidentityから導出し、transaction内の最新Companyへchangesを重ね、現在の`invoiceNumber`を検証contextとして共有billing contractで整合性を確認する。`invoiceNumber`はCompany基本情報operationの所有を維持し、振込先requestで受信・更新しない。実際に変わった5 fieldとserver timestampの`updatedAt`・実行者`uid`だけを保存し、clientからの振込先直接変更は会社管理者を含む全actorへ拒否する。
- 完全な振込先だけを口座名義を含めて帳票へ印字し、不完全または不正な振込先は印字しない。会社情報の表示・帳票layoutは長い値を折返し、縮小または表示上の省略で扱い、保存値またはsnapshot値を切り捨てない。100文字の会社名、長い住所・建物・口座名義をrender test対象とする。詳細な判断は[ADR 0033](decisions/0033-company-bank-transfer-update-boundary.md)を正とする。
- `minuteInterval`は5分単位のinteger `5/10/15/20/25/30`だけを許可し、初期値は15とする。`roundSetting`は`FLOOR/ROUND/CEIL`だけを許可して初期値を四捨五入、`firstDayOfWeek`はinteger `0`〜`6`だけを許可して初期値を日曜日とし、変更は画面へ即時反映する。`roundSetting`はCompany defaultであり、OperationResult作成時に適用modeをsnapshotする。変更後に既存OperationResult、Billing、帳票を再計算せず、訂正は新しいrevisionで扱う。
- `arrangement`の`siteOrder`と`scheduleOrder`は各最大2000件とし、各itemはexact `{siteId, shiftType}`だけを持つ。`siteId`は1〜128文字で`/`とcontrol characterを拒否し、`shiftType`は`DAY/NIGHT`、同一配列内の`siteId + shiftType`は一意とする。computed `key`は保存しない。1回の更新はどちらか一方だけを対象とする。actorは同じtenantの有効な本登録Userとし、会社管理者、またはnon-super-userかつ既知role preset由来で`siteOrder`には`sites:write`、`scheduleOrder`には`site-operation-schedules:write`を持つUserだけを許可する。会社管理者は`isSuperUser`がboolean `true`でも自社の両表示順を更新できる。会社管理者でないsuper-user、直接permission文字列、未知role、temporary、disabled、他tenant、`isSuperUser`の欠損・型不正は拒否する。専用Callableは対象fieldとserver管理の更新時刻・更新者だけをtransactionで更新し、同値はwrite 0とする。clientから`agreementsV2`、`siteOrder`、`scheduleOrder`を直接変更することは全actorへ拒否する。全Siteの存在はtransaction中に検査しない。表示時はdocumentが存在するSiteをACTIVE・TERMINATED等の状態にかかわらず残し、存在しない削除済み参照だけを無視して次回の明示保存で除去する。保存中はdrag、保存、取消、再読込、行削除を含む関連操作を停止し、失敗時はlive Companyを先行変更せずdraftを維持する。同じfieldを許可actorが完全に同時保存した競合はrevisionを導入せず、後からcommitした値が残る残存riskとして扱う。actor境界は[ADR 0037](decisions/0037-superuser-company-admin-display-order.md)、Site表示判断は[ADR 0036](decisions/0036-terminated-site-display-order-visibility.md)を正とする。
- `attendanceManagementMode`は`attendanceSummaryMode`へ改名し、値を`LABOR_STANDARD`と`OPERATION_COUNT`に限定する。両方のprojectionは常時生成し、mode変更は即時かつ可逆な画面・navigation切替だけとする。`LABOR_STANDARD`では労基準拠の勤怠一覧と打刻CSV、`OPERATION_COUNT`では勤務回数実績を表示し、労基準拠一覧と打刻CSVを非表示にする。mode変更による過去data migration、再集計、移動、削除は行わない。初期値は`LABOR_STANDARD`とする。
- legacy `attendanceManagementMode`の`ACTUAL_DATE`は`LABOR_STANDARD`、`OPERATION_DATE`は`OPERATION_COUNT`へ移行する。field欠損時だけ`LABOR_STANDARD`を補い、未知値は推測変換せずmigration conflictとしてapplyを停止する。
- 給与計算へ用いる勤務回数、日勤・夜勤、同日複数勤務、夜勤跨ぎ、休憩、訂正、認可、CSVの詳細は勤怠実績管理改修で改めて決める。CCBは現在の集計方法を最終仕様として固定しない。
- Company既定の`agreementsV2`とCompany位置情報・geocodingは廃止する。Company設定画面から既定取極めの編集入口とwriterを撤去し、Site固有の取極めUI・dataは維持する。SiteはCustomerに従属するため、将来のSite既定取極めはCustomer側の契約で扱う。既存fieldの削除はbackup、dry-run、rollbackを固定した別migrationでだけ行い、Customer・Site・Employeeのgeolocationへ廃止範囲を広げない。
- Companyの`ACTIVE/SUSPENDED/CLOSED` lifecycle、provider maintenance、法的削除、tenant移転・統合・分割はCCB restartへ含めず、具体的な利用停止機能を実装する別仕様・別roadmapで扱う。現行maintenance挙動をCCBだけを理由に拡張しない。
- 請求書はdraft中だけlive Company情報を参照し、確定時に会社名、住所、電話、適格請求書番号、振込先をissuer snapshotとして保存する。確定後の訂正・再発行は旧snapshotを書き換えず新revisionを作る。実際のsnapshot writeと請求lifecycleはBilling改修で実装する。
- Stripe、checkout、webhook、plan、subscription、entitlement、employeeLimit、Stripe用PrivateSettingsは現段階のCompany構造とCCBへ含めない。checkout、reader、未公開Functions、依存package、Company schema fieldはlocal codeから削除済みで、`StripeData`は全actor・全階層で拒否する。利用者用localとDevのlegacy field削除も完了している。Devでの実行結果は[immutable receipt](verification/stripe-05-dev-release.md)を参照し、将来のサブスクリプション機能は旧CCB schemaを前提にせず新規設計する。
- 旧CCBの8 target、PrivateSettings、SettingAudits、runtime compatible reader、migration/restore planner、pre-containment Rulesと専用testは2026-08-30のcorrective rollbackで主repositoryから除去した。当時はSchemas exact `2.4.2-dev.167`の公開artifactとAirGuardV2 consumer pin、Admin SDKのfail-closed guardを保持したが、AirGuardV2 root/FunctionsはSTRIPE-02で`3.0.0-dev.1`へ更新した。Admin SDKは`.167`を維持し、公開packageをunpublishしない。旧8 targetへのmigrationまたはrestore経路は現在提供しない。

### Employeeの操作権限と保持

- 同社の有効な本登録会社管理者・統括・人事は、Employeeの作成と通常編集（基本情報、国籍、警備員登録、資格、保険）を行える。Employeeの閲覧は、会社管理者・統括・人事・労務・法務・管制・経理へ現時点では全項目を許可する。労務・法務・管制・経理は更新できない。本人向けEmployee Self Accessは既存の別境界に従い、roleなし・未知role・直接permission文字列・developer指定だけを原本全項目readの根拠にしない。詳細は[ADR 0058](decisions/0058-employee-full-read-and-geocoding-scope.md)を参照する。
- 退職後（RESIGNED）のEmployeeは、会社管理者・統括・人事も通常情報を訂正できない。基本・国籍・警備員登録・資格・保険と保険履歴復元を含む。閲覧は上記範囲で継続する。
- 在職Employeeの保険6操作は会社管理者・統括・人事へ許可する。履歴復元もこの3actorへ認め、historyあり・手続中不可など現行の遷移条件を維持する。退職後編集禁止はactor許可に優先する。詳細は[ADR 0059](decisions/0059-employee-retired-edit-and-insurance-operation-boundary.md)を参照する。
- 通常編集、退職、誤退職訂正、誤登録のarchive・物理削除、User/Auth操作を分ける。退職は会社管理者・統括・人事、archive・物理削除は会社管理者・統括だけに許可し、人事単独には許可しない。誤退職訂正は既存の会社管理者専用条件を維持する。Employee編集権限からUser/Authのrole管理・account変更を導かない。
- 誤登録・重複のEmployeeは従属がない場合だけ、同IDの`Employees_archive`へ移動する。[共通仕様](#ドキュメントのアーカイブと物理削除)に従い、通常Employeeからの直接物理削除とarchive延期を撤回する。通常退職はEmployeeをRESIGNEDとして業務記録とともに保持する。archiveでUser/Authや従属を連鎖削除しない。
- 他collectionの既存業務仕様は維持する。ただし、Employeeへの参照整合性に必要な保存処理・Rules・query用field・背景処理の変更は設計範囲に含める。単純な存在確認を画面だけへ追加せず、必要な保存経路を保護した後にarchiveを開放する。全masterの同時変更や既存archive・実dataの削除・変換、通常restoreの提供、定期purgeの実行は含めない。変更理由・境界は[ADR 0060](decisions/0060-common-archive-purge-and-address-contract.md)を参照する。
- 自宅座標は、将来の配置先現場と従業員自宅の経路図に利用するため必要とする。Employeeの住所から座標を取得・保存する機能を継続する。経路図の描画、経路検索、距離による配置判断は将来工程であり、今回のCRUD改修では追加しない。座標を含むEmployeeの閲覧は上記の全項目read境界に従う。
- 住所保存・座標取得失敗・旧座標消去・未取得通知・住所不変時の保持は[共通仕様](#住所と座標)に従う。Employee固有の用途と閲覧actorを上記に定める。

- codeは任意・手入力・重複可とし、document IDをidentityとする。姓名だけの変更では表示名を再生成し、同じ保存で表示名も明示変更した場合は入力した表示名を優先する。表示名カナは独立入力とし、過去記録の表示は現在master名を使う既存方式を維持する。
- 新規登録は在職者一覧から行い、退職者検索には作成入口を設けない。在職一覧は空検索で`updatedAt`が新しい在職Employeeを最大20件表示し、退職者一覧は空検索で`dateOfTermination`が新しい退職Employeeを最大20件表示する。検索文字列がある場合は、ひらがな・カタカナを同一視して正規化した既存`tokenMap`検索結果を表示する。通常候補のACTIVE/RESIGNEDと期間内在籍者の既存条件を維持し、新たな在職者限定を加えない。
- `Employees_archive`のget/listは通常Employeeと同じ会社管理者・統括・人事・労務・法務・管制・経理へ全項目を許可する。同社Userであることだけでは許可しない。通常一覧・選択候補から除外し、直接client CUDとrestoreは拒否する。今回archive管理一覧は新設しない。
- 通常保存は専用operationを使い、独立draftから変更した所有fieldと必要な派生fieldだけを最新原本へ保存する。未知field・不存在・他section・User/Auth・lifecycleを保持し、直接client CUDと汎用経路の迂回を拒否する。通常可逆fieldはlast-write-winsとし、編集中sectionの外部変更通知時は入力を保持して明示再読込を求める。通知前の競合は残る。入社日、従属情報を消す国籍/警備員flag解除、資格配列、保険操作は局所期待値で古い要求を拒否する。
- 保険操作では現在mapに加え、Employeeのapplication所有field `insuranceOperationVersions`に保険別の非負safe integerを持ち、成功時に対象だけを増やす。履歴復元で巻き戻さない。新規は3保険とも0、既存はinsuranceOperationVersions全体が不存在の場合だけlegacy 0とし、最初の成功操作で原子的に初期化する。不正値・欠損key・上限超過は拒否する。期待値は表示用Classと分離した同時点のraw snapshotから取得し、取得失敗を不存在とみなさない。詳細な保存・wire・archive snapshot・参照catalogは[Employee設計契約](implementation/employee-master.md#通常保存の技術契約)に従う。
- 保険項目自体が原本に存在しない場合は、未加入・手続きなし・履歴なしの初期状態として操作できる。閲覧・編集開始・取消では書き込まず、最初の成功する操作で対象保険を作成する。保存時は原本の不存在と保存世代を同transactionで照合し、先行登録があれば競合として拒否する。既存のnull・不正な保険mapを初期値で上書きせず、他保険・既存履歴・他sectionを保持する。一括補完は行わない。
- 段階移行では未移行の警備員登録・資格・保険editorをlocalで一時read-onlyとし、各専用writer完成後に再開する。既存UWB専用操作は維持し、中間状態をDevへ反映しない。今回の実装範囲は参照保護を伴うarchiveまでとし、物理削除の実行機能は後続の専用工程へ分ける。共通物理削除仕様を取り消さず、保持期間・最小ID記録・自動実行等の運用判断はその工程で行う。

### 外注先

- Outsourcerは、ある特定の協力会社を表す会社masterであり、外注警備員個人を表すものではない。配置では、同じOutsourcerを別々の配置明細として複数回登録できる。Outsourcerと人数を一組にして一明細へ集約する方式は採用せず、外注警備員個人masterも現段階では新設しない。
- 通常UIでOutsourcerを1回配置するごとに`amount=1`の配置明細を一つ作る。配置明細のidentityは、従業員ではraw ID、Outsourcerでは`outsourcerId:index`形式の`workerId`とする。Outsourcer masterの名称解決にはraw `id`を使い、表示行、削除・並べ替え、配置通知の照合には`workerId`を使う。同じ配置内のOutsourcer indexは最大値に1を加えて採番し、明細削除後も残存明細を再採番せず、再追加時は次の最大値を使う。ScheduleからOperationResultへの変換は各配置明細を1対1で維持する。
- Outsourcerの閲覧は現行の同一tenant境界を維持する。作成、基本情報変更、`contractStatus`変更は、認証UIDとUser document IDが一致する同じ会社の有効な本登録Userのうち、会社管理者または既知role preset `manager`だけに許可する。会社管理者でないsuper-user、直接permission文字列、未知または既知外roleを含むUser、仮登録、無効User、他社Userは書込み権限の根拠にしない。会社管理者かつsuper-userのUserは、会社管理者であることを根拠に許可する。
- Outsourcerは通常の製品運用ではlive masterとして保持し、archive、restore、物理deleteを提供しない。誤登録・重複・取引終了もarchiveの理由にせず、必要な訂正は通常の基本情報・状態変更として行う。client直接deleteと`Outsourcers_archive`のclient作成・変更・削除を拒否し、製品UI、application action、Callableからgeneric `delete()`／`restore()`へ到達させない。既存archiveの同一tenant read境界は変更せず、既存live/archive dataの変換・復元・削除、自動purge、保持期限を追加しない。判断理由は[ADR 0050](decisions/0050-outsourcer-live-retention-without-archive.md)を参照する。
- live Outsourcer documentはexact `docId/uid/createdAt/updatedAt/code/name/nameKana/displayName/contractStatus/remarks/tokenMap`だけを持つ。`code`は手動入力する任意の識別表示で、nullまたは10文字以内とし、重複を許可する。自動採番・一意制約・検索対象にはせず、document IDをidentityとして維持する。`name`は必須20文字以内、`nameKana`は必須40文字以内、`displayName`は必須6文字以内、`remarks`はnullまたは200文字以内とする。`contractStatus`は`ACTIVE/TERMINATED`だけを許可し、新規作成は常に`ACTIVE`とする。
- 作成時の`docId`はpathと一致させ、`uid`は実行者、`createdAt/updatedAt`はrequest時刻とする。更新時は`docId/createdAt`を変更せず、実際に変更された業務fieldと`uid/updatedAt`だけを保存する。名称系`name/nameKana/displayName`を変更した場合だけ検索用`tokenMap`を再生成し、名称系を変更しない更新で`tokenMap`単独変更を許可しない。RulesはtokenMapを最大512件・値trueだけに制限するが、名称との完全な意味的一致までは再計算できないため、正規画面の専用writerを維持する。
- 編集draftはlive表示dataと分離する。保存時の最新documentで、利用者が変更した同じfieldが別画面でも変更されていれば保存せず、入力内容を保持して最新値の再読込を促す。変更fieldが重ならない場合は、最新documentへ利用者の変更fieldだけをtransactionで重ねる。変更なしはwrite 0とする。
- OUT-02では既存path、検索、配置明細、statusの業務上の意味を変更せず、data migrationを行わない。delete/archive、検索・一覧、重複配置の実装変更も対象外とする。
- Outsourcerの`contractStatus`はCustomerと同様に、その時点の取引状況を表すだけの可逆なフラグとする。`ACTIVE/TERMINATED`のどちらであっても、外注先一覧・キーワード検索・Autocomplete・配置・稼働実績その他の候補選択から除外せず、既存・新規の業務操作を状態だけで禁止しない。状態変更によって配置、通知、実績、請求、帳票を自動変更・終了・取消しせず、再開時も既存記録を書き換えない。
- Outsourcerの状態変更に契約終了日、開始日、終了理由、専用履歴を追加または必須化しない。通常の`uid/updatedAt`は維持するが、`updatedAt`を契約終了日時と解釈しない。archiveは状態フラグと分離し、通常機能では行わない。
- 外注先一覧の通常表示は`updatedAt`、同値時document IDの降順とし、21件を取得して最近追加・更新された20件ずつをserver cursorで表示する。現在pageだけをlive購読し、前pageのcursorは画面内memoryだけに保持する。作成・更新後は先頭pageへ戻す。
- キーワード検索は正規化後1〜40文字を受け付け、`name`、`nameKana`、`displayName`から既存writerが生成する`tokenMap`を対象とする。codeは検索しない。検索中は一致結果をlive購読し、`nameKana`、同値時document IDでclient側sortして20件ずつmemory paginationする。入力なしは通常一覧へ戻り、範囲外入力ではqueryを実行せず案内を表示する。
- 一覧、Card、Autocompleteの外注先表示は略称、正式名称、codeを識別できるようにし、`TERMINATED`には「契約終了」を表示する。この表示によって選択や編集を無効化しない。Autocompleteは外注先専用ListItemを使い、既存の最大50件取得境界を維持する。

### 取引先・現場・取極め

- 取引先の閲覧は既存の同一会社境界を維持する。作成、基本情報変更、支払条件変更は、同じ会社の有効な本登録Userのうち、会社管理者または既知role preset由来の`customers:write`を持つUserだけに許可する。直接permission文字列、未知role、会社管理者でないsuper-user、仮登録、無効User、他社Userは書込み権限の根拠にしない。
- 取引先一覧は、検索文字列がない場合に選択中の契約状態を適用し、`updatedAt`が新しい取引先を最大20件表示する。検索文字列がある場合は、選択中の契約状態を維持したまま、ひらがな・カタカナを同一視して正規化した既存`tokenMap`検索結果を表示する。
- 取引先の作成は`ACTIVE`で行い、作成フォームに状態選択を設けない。作成後の`contractStatus`変更は基本情報変更に含め、同じ書込み担当だけに許可する。基本情報変更と支払条件変更は操作ごとの対象fieldと更新者・更新時刻だけを部分保存し、document全体を置換しない。名称変更時の検索用情報、住所主要部変更時の位置・表示住所情報は正規画面の専用処理で同時生成する。状態だけの変更では名称・住所の派生情報や支払条件を保存し直さない。
- 取引先の`contractStatus`（`ACTIVE` / `TERMINATED`）は、その時点の取引状況を表すだけのフラグとする。稼働中の現場・現場稼働予定が存在しても変更でき、状態だけを理由にCustomerの選択・編集や関連する業務操作を禁止しない。過去に作成されたdocumentでも、もともとCustomerを選択できる操作は選択可能なままとし、再開を選択の前提にしない。状態変更によって現場・予定等を自動終了・取消ししない。既存の認証・権限・他の業務条件は緩和しない。
- 取引状態の変更に終了日時・原因・理由・専用履歴を新設または必須化しない。通常の更新者・更新時刻は維持するが、これを契約終了日時と解釈しない。将来、状態に応じた動作制限を設ける場合は、状態になった日時・原因と過去documentへの適用条件を含めて別途仕様を合意する。判断理由は[ADR 0044](decisions/0044-customer-status-as-descriptive-flag.md)を参照する。
- 取引先の入力中dataは最新表示dataと分離する。同じ操作のfieldが別画面で変更された場合は保存せず、入力内容を破棄して最新値を読み直す。自分の保存途中の反映と失敗後の巻き戻しは別画面の変更として扱わず、失敗時の入力を保持する。
- 取引先のclient直接deleteと`Customers_archive`のclient read・作成・変更・削除は許可しない。取引状態の編集と、参照確認・監査を伴うarchive・緊急restoreは別の操作とする。archiveは専用Callable、archive非公開・参照barrier、権限制御されたCustomer詳細の確認画面入口を使用する。緊急restoreは通常画面へ入口を設けず、別の権限制御された操作として設計・承認する。単なる状態フラグという扱いを削除・復元の安全条件へ拡張しない。実装・環境への適用状態は[Customer archive safety roadmap](roadmaps/customer-archive-safety.md)を参照する。
- 取引先archiveは誤登録・重複だけを対象とする`archiveCustomer`専用Callableで行う。会社は検証済みidentityから導出し、同社の有効な本登録会社管理者または既知role preset由来の`customers:write`だけを許可する。入力はCustomer ID、必須reason、operation IDだけとし、actor・時刻はserverで確定する。一つのtransactionでactive Customer、同ID archive、statusを限定しないSites・OperationResults・BillingsのcustomerId参照を確認し、参照・衝突・不正状態ではwrite 0とする。version付きCustomer snapshotとreason・actor・時刻・operation IDをsame-ID archiveへ上書きせず保存してactiveを削除し、同operationの再試行だけを冪等に扱う。generic delete/restoreは使用しない。
- archive後の参照生成を防ぐため、Sites・OperationResults・BillingsでcustomerIdを新規設定または変更するclient/server writerは、同じ会社の`Customers/{customerId}`が存在することを必須にする。Customer createは同ID archiveが存在すれば拒否し、archive documentを削除済みIDのtombstoneとして扱う。ここでのCustomer存在は`contractStatus=ACTIVE`を意味せず、TERMINATED Customerも通常どおり使用できる。専用lock collectionは設けない。詳細は[ADR 0046](decisions/0046-customer-archive-reference-barrier.md)を正とする。
- Firestore Rulesは取引先の同一会社、書込み担当、操作別field、型、状態、更新者・更新時刻、削除・archive拒否を強制する。検索用情報と外部住所検索結果の意味上の正しさはRulesだけでは完全再計算できないため、正規画面の専用writerを維持し、server生成へ移すかはDev反映前の残存risk判断とする。
- 現場は取引先に紐づく。
- 稼働中現場一覧は、検索文字列がない場合に`updatedAt`が新しいACTIVE Siteを最大20件表示する。取引先・警備種別の絞込みはFirestore queryへ含め、絞込み後の最大20件とする。検索文字列がある場合は同じ絞込みを維持し、ひらがな・カタカナを同一視して正規化した既存`tokenMap`検索結果を表示する。終了現場一覧は、検索文字列がない場合に`updatedAt`が新しいTERMINATED Siteを最大20件表示し、検索文字列がある場合は同じ`tokenMap`検索結果を表示する。
- 現場の取引先は、同じ会社に存在する別のCustomerへ変更できる。一度設定したcustomerIdを未設定へ戻す操作は提供しない。変更後に新規作成される、または別の更新条件でSiteから再同期される稼働実績は変更後のCustomerを参照するが、既存OperationResult・BillingのcustomerIdは履歴snapshotとして自動変更しない。既存実績へCustomer・取極めを再適用する場合は、対象・請求影響・監査を明示する別操作とし、空更新へ暗黙の移管処理を持たせない。詳細は[ADR 0048](decisions/0048-site-customer-change-and-historical-snapshots.md)を正とする。
- Siteへ埋め込むCustomerは、現在の表示と取極め判定に必要なexact 6 field（`docId`、`updatedAt`、`code`、`name`、`abbreviation`、`cutoffDate`）だけのprojectionとする。作成時・SiteのCustomer変更時・Customer master更新triggerはいずれも同じ会社の現在のCustomerから生成し、検索用`tokenMap`、位置情報、住所、支払条件、監査field等を複製しない。既存Siteの広いlegacy埋込みCustomerは読取り互換のため一括変換せず、基本情報、Customerの明示更新、またはCustomer master更新時に現行projectionへ収束させる。取極めだけの更新では埋込みCustomerを書き換えない。新たなCustomer fieldをSiteの埋込み値から読む必要が生じた場合は、client・Functions・RulesのprojectionとRules評価量を同時に見直す。
- 現場の通常の利用終了は`TERMINATED`で表し、liveの`Sites` collectionに保持する。TERMINATEDはSite masterの通常編集を制限するが、残工事等の一時利用に備えて稼働予定その他の新規業務参照先として選択できる。候補ではACTIVEを先、TERMINATEDを後に分け、終了済みChipと取引先・code・住所等の識別情報を表示して選択時に確認する。選択だけでACTIVEへ戻さず、単発利用はTERMINATEDのまま行える。
- 継続的に再開する場合は、現在のCustomer設定を変更せず、`sites:write`を持つ許可actorが必須reasonと新しい工期を一つの再有効化operationで保存してACTIVEへ戻す。Customer未設定の仮Siteは未設定のまま再開でき、Customer変更が必要な場合は再開後の別の許可されたSite更新として扱う。終了・選択・再有効化によって既存の予定、実績、請求、取極めを自動変更しない。
- ACTIVE Siteの工期終了後は、永続statusを増やさず「工期終了済み」「自動終了予定」「工期終了済み・予定あり」を派生Chipとして表示し、自動終了予定日を示す。通常のACTIVE Siteを先、終了候補を後に並べる。工期終了日が未設定のSiteは自動終了せず「工期未設定」として識別可能にする。
- 自動終了はJSTの暦日で工期終了日の90日後00:00以降に実行する。実行時にACTIVE、有効な工期終了日、90日経過、JST当日以降のSiteOperationScheduleなし、実績へ変換されていない未処理SiteOperationScheduleなしを同じtransactionまたは同等のpreconditionで再確認し、すべて満たすSiteだけをTERMINATEDへ変更する。予定があれば取消・削除せずwrite 0で見送り、工期日の訂正を促す。
- SiteOperationScheduleの新規client writeは`operationResultId=null`を必須とし、実績化は同じtransactionで作成する同IDのOperationResultとSite・予定参照が一致する場合だけ`null`から同IDへ変更できる。単独変更、偽参照、別IDへの置換、非nullからnullへの巻戻しを拒否する。既存dataで`operationResultId`または日付fieldが欠損していないことはDev反映前に確認し、欠損があれば自動終了を有効化せず別承認の互換対応を行う。
- 自動終了はcleanupと失敗境界を分け、page/cursorと制御されたbatch、部分失敗の非成功扱い、再試行・照合、maintenance中の停止を備える。工期訂正、再有効化、予定作成との競合で古い判定を後勝ち適用しない。予定作成が先なら終了を見送り、自動終了が先でもTERMINATED選択確認後の新規予定を許可する。
- 手動終了・自動終了・再有効化は現在の遷移を説明する`statusChangedAt`、`statusChangedBy`、`statusChangeSource`、`statusChangeReason`を保存する。自動終了はsystem actor、AUTO source、工期終了後90日経過の既知reasonを使う。専用のappend-only lifecycle履歴は設けない。初期実装では現場ごとのemail・FCMを送らず、ダッシュボードの候補件数、一覧Chip、予定日、予定矛盾表示で通知する。詳細は[ADR 0054](decisions/0054-site-auto-termination-and-terminated-selection.md)を正とする。
- Site archiveは誤登録・重複だけを対象とし、通常の利用終了には使用しない。`sites:write`を持つ許可actorだけが専用`archiveSite` Callableから実行し、入力はSite ID、必須reason、operation IDに限定する。serverは現在のAuth・同社User・permissionを再確認し、actor・時刻を確定する。一つのtransactionでactive Site、同ID archive、および状態を限定しない直接参照を確認し、参照、archive衝突、不正状態ではwrite 0とする。直接参照catalogは`SiteOperationSchedules`、`OperationResults`、`ArrangementNotifications`、`Billings`、`SiteEmployeeHistories`の5 collectionとする。version付きSite snapshotとreason・actor・時刻・operation IDをsame-ID archiveへ上書きせず保存してactiveを削除し、同operationの再試行だけを冪等に扱う。
- archive後の新規参照を防ぐため、Siteを新規参照または変更する全client/server writerは、同じatomic boundaryでlive `Sites/{siteId}`の存在を必須にする。このbarrierを保証できないwriterが一つでも残る間はarchive機能を有効化しない。`DailyAttendances`と`DailyOperationsByEmployee`の`siteId`は直接参照元のOperationResultから生成される下流snapshotとし、archive時に変更せず直接参照catalogにも含めない。Company表示順の不存在SiteはADR 0036どおり表示時に無視し、次回の明示保存で除去するため、表示順だけをarchive拒否の業務参照にはしない。generic delete／restoreと物理deleteは使用せず、通常画面からrestoreを提供しない。緊急restoreは別の権限制御・監査・競合防止を持つoperationとして改めて承認する。既存live/archive dataの一括変更、自動purge、保持期限は追加しない。詳細は[ADR 0051](decisions/0051-site-mistaken-registration-archive-boundary.md)を正とする。
- SiteOperationScheduleは計画dataとして`siteId`を保持し、稼働実績へ変換されるまではSite名称・Customer・住所・警備種別・取極めをlive Siteから表示・選択する。Site master変更だけを理由に予定documentへsnapshotを複製または一括更新しない。
- OperationResultは作成時に、Site IDに加えてSite名称・表示名、Customer ID・表示情報、住所、警備種別、適用取極めを実績snapshotとして固定する。Site masterの後日の変更では既存OperationResultを更新しない。Site・稼働日・勤務区分等を明示的に訂正して適用条件が変わる場合だけ、請求影響、発行状態、before/after、actor、reasonを確認する専用の実績訂正契約でsnapshotを更新する。
- Billing draftと未確定の請求表示はOperationResultのsnapshotを集計し、live Siteを請求表示の正本にしない。請求確定時には、そのrevisionで表示するSite・Customer・取極め由来の請求明細情報をBilling側へ固定する。確定後の再生成は保存済みsnapshotを使い、訂正・再発行は旧snapshotを書き換えず新しいrevisionで行う。稼働実績・請求・帳票側のsnapshot write、確定、revisionは各transaction機能の改修checkpointで実装する。
- 現在・予定を扱う画面と帳票はlive Site、稼働実績を表す画面と帳票はOperationResult snapshot、確定請求書はBilling revision snapshotを使用する。Site master変更は将来作成される予定・実績・請求へ反映し、既存OperationResult・確定Billingへ自動反映しない。snapshot fieldを持たないlegacy documentは推測で過去値をbackfillせず、移行までは現行のlive fallbackと再現不能riskを明示して扱う。具体的なlegacy件数・shapeが確認され、正しい過去値を根拠から復元できる場合だけ別承認のmigrationを設計する。詳細は[ADR 0052](decisions/0052-site-downstream-snapshot-timing.md)を正とする。
- 取極めは現場、適用開始日、勤務区分に基づいて一つを選び、その取極め内の曜日区分別RateSetを適用する。
- 同じ適用開始日・勤務区分の取極めを重複登録しない。曜日区分は一つの取極め内に内包されるため、重複keyには含めない。
- 既存の稼働実績へ適用済みの取極めは、取極めマスタの後日の変更で自動更新しない。
- 取極めの作成・編集・削除はSiteの書込み操作に含め、同じ会社の有効な本登録Userのうち、会社管理者または既知role preset由来の`sites:write`を持つUserだけに許可する。直接permission文字列、未知role、会社管理者でないsuper-user、仮登録、無効User、他社Userを権限根拠にしない。取極め専用permissionと作成者・承認者workflowは設けない。
- 曜日区分ごとの通常・残業、一般・有資格の全単価は0円以上10,000,000円以下の整数とし、負数、小数、非数値、上限超過を拒否する。0円は有効値として許可するが保存前に警告し、欠損と同一視しない。休憩時間と規定実働時間は0分以上1,440分以下の整数とし、休憩時間は開始・終了・翌日扱いから算出した勤務区間を超えてはならない。規定実働時間は勤務区間との大小を理由に拒否しない。締日は月末を表す`0`または`5/10/15/20/25`だけを許可する。
- OperationResultへ適用済みであることだけを理由に取極めmasterをlockせず、許可actorは過去・現在・未来の取極めを編集・削除できる。変更は既存OperationResultの取極めsnapshotへ自動反映せず、以後に作成する実績または明示的な実績訂正で再適用する場合だけ新masterを使う。未実績化予定はlive Siteを参照するため、編集・削除時は既存実績には影響せず今後の実績へ影響することを警告する。
- 取極めmaster専用のrevision、before/after履歴、変更理由、監査collectionは設けない。Siteの通常の更新者・更新時刻は維持するが、取極め変更履歴とは扱わない。既存OperationResultを訂正する場合はmaster変更の波及ではなく、請求影響、発行状態、before/after、actor、reasonを扱う専用の実績訂正operationを使用する。詳細は[ADR 0053](decisions/0053-site-agreement-write-validation-and-history.md)を正とする。
- 取引先の入金サイト変更は将来作成する請求へ反映し、既存請求の支払期日は自動変更しない。

### 稼働予定・配置通知・上下番

- 現場稼働予定は、現場、稼働日、勤務区分、予定時間、必要人数、配置作業員を管理する。
- 配置管理画面は、現場と勤務区分を行、日付を列として現場稼働予定を表示し、従業員・外注先の配置、並べ替え、個別勤務時間の編集、配置通知、予定の作成・編集・複製を扱う。
- 配置管理画面の作業員タグは、配置された作業員名と勤務時間を表示する。個別勤務時間または配置通知上の実勤務時間が予定時間と異なる場合は、該当時刻を強調表示する。実効的に OJT である作業員には、資格者アイコンと作業員名の間に、OJT であることと配置人数に含まれないことを識別できる表示を付ける。表示幅が不足する場合は、資格者アイコン、OJT 表示、連勤警告などの状態表示を維持し、作業員名だけを末尾の省略記号付きで省略する。
- 配置予定の作業員と配置通知が同種の業務プロパティを持つ場合、配置管理上の実効値は配置通知を優先し、配置通知がない場合だけ配置予定の値を使用する。真偽値の `false` も配置通知による有効な上書きとして扱う。OJT、資格、実勤務時間など、配置通知側で編集可能な共有プロパティにこの規則を適用する。
- 配置管理画面は、日付ごとの稼働数、配置人数、過不足を日付ヘッダーに表示する。稼働数は当日の現場稼働予定の必要人数合計とする。配置人数は、作業員ごとに配置通知を優先して解決した OJT 状態に基づき、実効的な OJT を除外して集計する。現場稼働予定カードの過不足も同じ配置人数を使用する。
- 配置管理画面は、日付ごとの配置明細を、配置通知がなく通知済みフラグもない「仮配置」、`ARRANGED` の「配置済」、`CONFIRMED` の「確認済」、`ARRIVED` の「上番済」、`LEAVED` の「下番済」に分類し、日付列の固定フッターへ件数を表示する。同一作業員が同日に複数の予定へ配置されている場合は配置ごとに数え、OJT も状態別件数へ含める。配置通知と通知済みフラグが一致しない場合、または既知の通知状態へ分類できない場合は「要確認」として表示する。
- 配置管理における「連勤」は、同一作業員が次のいずれかを満たす配置を指す。
  - 同一日付の `DAY` と `NIGHT` の両方に配置されている。
  - ある日の `NIGHT` と、その翌日の `DAY` の両方に配置されている。
- 連勤判定の対象は従業員だけとし、外注先は対象外とする。
- 表示期間の境界でも連勤を判定できるよう、判定用の現場稼働予定は表示期間の前後1日を含めて取得する。前後1日の予定は判定だけに使用し、配置管理表の表示対象には加えない。
- 連勤は配置予定に基づく注意喚起であり、配置の保存を禁止する条件とはしない。連勤関係を構成する双方の従業員配置タグに警告アイコンを表示し、ツールチップで該当理由を示す。
- 現場稼働予定は稼働日から60日経過後に自動削除され、復元できない。
- 配置通知がある場合、上下番確定では通知の実勤務時間を使用する。通知がない場合は予定勤務時間を使用する。
- 配置通知の状態遷移は `ARRANGED`、`CONFIRMED`、`ARRIVED`、`LEAVED` の順を基本とし、専用の状態遷移メソッドを使用する。
- ユーザーが上下番確定を開始してから処理が終了するまでは、処理中ダイアログを表示し、別の現場稼働予定を再選択できないようにする。成功・失敗にかかわらず処理終了時にダイアログを解除する。

### 稼働実績

- 稼働実績は売上・請求と従業員勤怠の元データである。
- 稼働予定の上下番確定または管理画面から作成できる。
- 作成時に適用可能な取極めを自動適用する。取極めがなくても記録は作成できるが、原則として無効状態とし請求へ反映しない。
- `allowEmptyAgreement` が明示された稼働実績は、売上へ連動しない実績として取極めなしを許容する。
- 請求処理でロックされた稼働実績は更新・削除できない。
- 日付や勤務区分の変更は、関連する従業員の日次勤怠へ影響し得る。

### 請求・税・丸め

- 稼働実績から稼働請求を生成し、取引先・現場・締め期間を単位として請求を集約する。
- 稼働請求画面から、元となる稼働実績を伴わない稼働請求を直接作成しない。稼働外の商品・調整項目は定められた追加明細として扱う。
- 消費税率は稼働実績の日付から判定し、消費税額は請求書内の税率別税抜合計に対して計算する。
- 金額や時間の端数処理は、対象会社または業務で定義された丸め設定に従う。Company defaultを使うOperationResultは作成時のmodeをsnapshotし、後日のCompany設定変更で既存結果を再計算しない。

### 勤怠

- 稼働実績から、労基準拠の日次勤怠と勤務回数実績の両projectionを常時同期する。
- AirGuardV2 は`LABOR_STANDARD`で労基準拠の勤怠一覧と打刻CSVを表示し、`OPERATION_COUNT`で勤務回数実績を表示する。`OPERATION_COUNT`用exportは後続の勤怠実績管理改修まで未確定とし、給与計算そのものは外部サービスへ委ねる。
- 複数の稼働実績が同日に存在する場合の勤務・休憩統合と、給与用勤務回数の詳細契約は勤怠実績管理改修で確定する。現在実装を最終仕様とみなさない。

### 通知・ファイル

- PWA と FCM を使用し、通知トークンを管理して対象ユーザーへ通知する。
- 通知送信の成否と無効トークンを追跡し、クライアントだけで送信権限を完結させない。
- 警備日報等のファイルは会社と関連業務データを識別できる Storage パスに保存し、Security Rules と Cloud Functions でアクセス、サムネイル、自動削除を制御する。

### サブスクリプション

- 現在のStripe関連コードとデータ形状は未完成のscaffoldであり、checkout、webhook、plan、解約、再契約、課金状態、従業員上限を提供済み機能として扱わない。Stripe側との契約情報同期実績もない。
- 現段階ではsubscription・entitlement・employeeLimitの保存・表示interfaceを準備しない。Company rootのlegacy field、`StripeData`、checkout画面、reader/writer、未公開Functions、依存packageは[ADR 0038](decisions/0038-legacy-stripe-scaffold-removal.md)に従って削除済みである。
- 将来のシステム利用契約・課金操作は会社管理者だけに許可し、統括を含む他roleへ許可しない。契約・plan変更・解約等の操作権限と、支払済み等の課金結果を任意に書き換える権限を同一視せず、課金結果はprovider/serverの検証済み処理で確定する。Stripeを使う将来案の具体的な機能、provider/API、plan、保存構造、署名、冪等性、event順序、reconcile、保持、利用上限は別仕様・別roadmapで新規設計する。今回のactor採用で既存Stripe機能を再有効化しない。

### 保守状態とdata change

- maintenanceはCompany固有機能ではなくproject共通の運用境界であり、排他lockではない。
- product側の目標境界は、maintenance状態をserver-ownedとし、Firestore Rulesが通常client writeを拒否し、共通Callable identity/auth gateが新しい通常業務処理を拒否し、scheduled・trigger処理が対象tenantへの通常自動変更をskipすることである。明示承認されたprovider migration・repairと、checkpointに列挙したrebuild・検証だけを例外とする。
- operation lease、全Function共通wrapper、実行中処理registry、`DRAINING`状態は現段階で実装しない。maintenance開始後に処理別のbounded quiet periodを待ち、対象Functionのlog、連続するdry-run digestの安定、snapshot、post-checkを組み合わせて静穏状態を運用確認する。logだけを処理不存在の数学的証明とはみなさない。
- migration checkpointは対象環境・commit・service・collection/data・停止対象・quiet period・監視Function・backup・rollback・停止条件・dry-run/apply/post-check・derived data rebuild・解除後受入れを固定する。Site migration中の自動終了等、対象dataを変える通常scheduled/trigger処理は停止対象とする。
- maintenance開始前に受理済みの処理はbounded waitで終了を待つ。quiet period後にdry-runを繰り返し、連続するdigestが安定してからsnapshotとapplyへ進む。移行後は同じdry-run、対象integrity、必要と明示したderived dataの再構築、error logを確認してからmaintenanceを解除する。
- maintenance状態の取得不能は保護対象操作をfail closedとし、有限deadline、retry、状態再取得、利用者向け停止・通信障害表示を提供する。一般利用者の例外routeは停止案内とsign-outに限定し、保守・repairは製品内super-user権限でなく個別承認されたoperator手順から実行する。

## アプリケーション状態の責務

- `useAuthStore`: 認証、カスタムクレーム、ログインユーザー、ロール・権限。
- `useCompanyStore`: 現在会社。STRIPE-02でlegacy subscriptionと顧客区分の導出を削除し、通常のCompany情報だけを保持する。
- `useSystemStore`: システム状態、会社を考慮したメンテナンス状態、開発環境判定。
- `useAppStore`: アプリケーションシェルと画面表示状態。
- 認証状態に応じた User・Company の取得、購読、初期化は `useAuthActions` が調整する。

## エラーと整合性

- 必須の取極めや請求締日がない稼働実績は、理由を識別できる無効状態として保持し、請求へ反映しない。
- `OperationResult` は管制等の稼働実績担当者と請求担当者が共用する。`isLocked` は請求確定、承認済み、またはドキュメント全体の変更禁止を表すものではなく、請求担当者が調整した内容を後続の管制側更新による上書きから保護するための管制側編集ロックとする。
- `operation-results:write` を持つ利用者は、ロックされていない稼働実績を編集・削除できる。`operation-billings:write` を持つ利用者は請求項目を編集し、`isLocked` を設定・解除できる。役職名ではなく、利用者または役割プリセットから得た当該権限で判定する。
- ロック中も `operation-billings:write` による請求項目の編集を許可し、追加の承認や理由入力を要求しない。更新者と更新日時は既存の `uid` と `updatedAt` へ自動記録し、変更前後の永続履歴や履歴用コレクションは現時点の必須要件としない。
- 外部 API、通知、ファイル処理、非同期トリガーの失敗は、再試行しても重複結果を生まない設計を優先する。
- ロック済み、権限不足、テナント不一致、削除済み参照を安全側で拒否する。
- 利用者に修正可能なエラーを示し、秘密情報や内部認証情報を表示しない。

## 非機能要件

- 会社間のデータ分離を最優先する。
- スマートフォンを含む業務端末で利用できるレスポンシブ UI とする。
- PWA 更新時は古いキャッシュによる不整合を抑える。
- 請求、勤怠、配置に関わる非同期処理では重複実行と部分失敗を考慮する。
- 仕様と実装の差異が見つかった場合は、どちらかを推測で正とせず、差異を未決事項として扱う。

## 開発ガバナンスと進捗管理

- `docs/roadmaps/` を、目標、残作業、完了条件、証拠に基づく進捗の正本とする。確認済み要件の正本は引き続き本文書とする。
- 正式運用準備は、合計100点の加重マイルストーンで管理する。現在はマイルストーン単位の部分加点を行わず、完了条件と証拠が揃った場合だけ当該点数を得る。
- スコープ追加または完了判定の訂正で進捗率が低下する場合は、変更前、変更後、理由を記録し報告する。
- 開発・委譲・Git・task lifecycleは[Coordination and Git rules](project-rules/coordination-and-git.md)、application・Firestore・検証範囲は[Development and data rules](project-rules/development-and-data.md)、承認・環境・local UIは[Environment and approval rules](project-rules/environment-and-approval.md)、文書・checkpoint closeoutは[Documentation and verification rules](project-rules/documentation-and-verification.md)を正とする。本文書へ横断的な実行規則を複製しない。
- local UI受入れは[Environment and approval rules](project-rules/environment-and-approval.md)と[local UI検証runbook](runbooks/local-ui-testing.md)、Firestore Rules縮小時の既存Dev document・migration・cutoverは[Development and data rules](project-rules/development-and-data.md)、[ADR 0031](decisions/0031-proportional-data-boundary-and-change-safeguards.md)、[開発workflow](runbooks/development-workflow.md#firestore-rulesを狭める改修順序)へrouteする。roadmapの実装単位、branch・Git、関連repository、local/Dev/Prodの実行境界も上記4つのproject rule segmentを正とする。

## セキュリティと機密情報

- `.env`、Firebase Admin 資格情報、Stripe シークレット、Webhook シークレットをリポジトリ文書へ記載しない。
- 本番の個人情報、勤怠、顧客、請求、位置・現場情報を例示データとして転記しない。
- Firestore と Storage はクライアント UI とは独立した Security Rules で保護する。
- 管理者権限を使う Cloud Functions は入力、テナント、認証、再実行の安全性を検証する。
- 既知の認証・認可・tenant分離問題の改修順とsegment境界は[Development and data rules](project-rules/development-and-data.md#優先順位とroadmap)へrouteする。

## 現段階の完了条件

試験運用段階には固定した終了日を設けていない。各変更は次を満たしたときに完了とする。

- ユーザーが変更内容と確認観点を承認している。
- 実装、現行仕様、ADR、変更履歴、関連マニュアルの整合が取れている。
- データ移行、設定変更、デプロイが必要な場合、その手順と復旧方法が記録されている。
- ユーザーが対象環境で動作確認を行い、結果を判断できる。

Codexによる検証は[Environment and approval rules](project-rules/environment-and-approval.md)と該当runbookに従う。外部serviceへの作用を排除できない検証、未承認のremote環境検証、最終的な試験運用上の判断はユーザーに残す。

## 未決事項

- スーパーユーザーの他社support accessについて、開始手続き、対象会社の選択・同意、許可範囲、有効期限、再認証、監査記録、終了・取消、同時session、緊急時の扱いを確定すること。
- `DailyAttendance.operationResultIds` の逆引きによる更新・削除方式への統一。
- ルートアプリと Cloud Functions の npm 依存関係の脆弱性対応。
- 将来サブスクリプションを企画する場合のprovider、料金、契約管理、利用上限。現行STRIPE roadmapの完了条件には含めない。
- FCM・通知・Storage 関連の旧定義に混在する「完了」「未実装」記載と現在実装の再照合。
- 試験運用から正式運用へ移行するための SLA、バックアップ保持期間、監視・障害対応基準。

## 仕様変更規則

重要な要件変更はユーザーの明示的承認後に確定する。承認済みcheckpoint内の変更・検証・文書更新と、Git・環境・remote/data・関連repository・package・migration・外部serviceの承認境界は上記4つのproject rule segmentに従う。

作業指示を受けたときは、関連文書と実装コードを照合する。指示との相違がある場合は変更前にユーザーへ確認し、実装から判明した未記載の恒久仕様は、実装事実と承認済み要件を区別して適切な文書へ反映する。

進捗へ影響する変更ではロードマップも同じタスクで更新する。重要文書を追加、改名、移動、廃止した場合は `docs/README.md` または該当索引と参照リンクを同じタスクで更新する。

本文書は常に現在の仕様だけを表す。旧仕様は Git 履歴と、判断理由を残す ADR で追跡する。

## 参考資料

- `DEFINITION.md`: 従来の運用・開発ガイド
- `DESIGN.md`: 従来の設計概要
- `definitions/`: 個別機能の従来定義
- `HISTORY.md`: 従来の不具合・検討メモ
- `docs/manual/`: 管理者向け画面マニュアル

参考資料と本文書が競合する場合、本文書と承認済み ADR を優先する。ただし、競合は黙って解消せずユーザーへ確認する。
