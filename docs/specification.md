# AirGuardV2 現行仕様

- 最終更新日: 2026-08-31
- 仕様バージョン: 0.8.1
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
- Stripe Checkout、Webhook、subscription、entitlement、employeeLimit。現段階のCompany構造からlegacy Stripe情報を削除し、将来サブスクリプション機能を実装するときに保存構造・権限・外部作用を新規設計する。
- 未実装と明記された将来案を、現行機能として保証すること。
- 本文書で確認できていない本番運用の SLA、保存期間、法令・認証への適合保証。

## システム境界

### フロントエンド

- Nuxt 3、Vue 3、Vuetify、Pinia を使用する。
- Firebase Hosting 向けの CSR SPA とし、PWA Service Worker を持つ。
- `air-vuetify-v3` をファイル参照で使用する。
- Firestore 用モデルは `air-guard-v2-schemas`、基底実装は `air-firebase-v2`、クライアント注入は `air-firebase-v2-client-adapter` が提供する。
- role presetの識別子、表示metadata、permission配列は`@shisyamo4131/air-guard-v2-schemas/constants`を環境非依存の単一正本とし、ルートアプリとCloud Functionsは同じ公開version・tarball・integrityを使用する。現在の確認済みversionはCCB v1のadditive public subpathも含むexact `2.4.2-dev.167`である。このpackage catalogはactor・tenant・target・request contextからallow/denyを決定せず、clientとFunctionsがそれぞれ認可policyを所有する。
- ドメイン上の操作可否をclientで事前検証する機能は、UI非依存の純粋policy、policyを適用して操作可否・拒否理由・実行処理を提供するapplication composable、結果を表示するcomponentへ責務を分離する。client判定はUX補助であり、serverの最終認可を代替しない。
- 登録済みpage routeは、`public`、`roles`、User管理固有fieldを個別に保持せず、Vue/Nuxt非依存の共有`accessPolicy` catalogを1件だけ参照する。route middlewareとnavigationは同じpolicy evaluatorを使用し、pathを持たないnavigation groupの表示はアクセス可能な子itemから導出する。未知policy、複製policy、旧fieldとの併記、不正なUser管理contextはclientでfail closedとする。

### バックエンド

- Firebase Authentication、Firestore、Realtime Database、Storage、Cloud Functions、Hosting を使用する。
- Cloud Functions は Node.js 22 を使用する。
- サーバー側モデル注入には `air-firebase-v2-server-adapter` を使用する。
- 外部システムとして Stripe と freee 勤怠管理がある。Firebase Cloud Messaging は通知配送を担う。

### 検証・試行環境

- local環境はFirebase Emulatorを使用し、test用の1社だけを扱う。
- Dev環境は利用者の会社と協力会社の2社が試用する非本番のremote試行環境である。一般公開はしていないが、会社境界を持つ試行環境として認証・認可・tenant分離を必須とする。正式運用準備または正式運用開始の完了判定をDev deployの前提にせず、検証済み変更を積極的にdeployして実利用条件の受入れ証拠を得る。
- Codexは対象commit、Firebase service、data影響、backup、rollback、停止条件、検証を含む利用者承認済みのbounded Dev release checkpointだけでDevへ接続する。同checkpoint内の静的生成、deploy、remote検証はcommandごとの再承認を必要としないが、新しいdata migration、破壊的repair、対象拡張、Prod適用は別の明示承認を必要とする。

## テナントと認証

- 会社データは `Companies/{companyId}` 以下を基本とし、会社単位で分離する。
- 認証ユーザーのカスタムクレームと会社 ID をデータアクセス判定に用いる。
- `Companies/{companyId}` の会社documentはclientから作成・削除できず、初期作成はCloud Functions/Admin SDKだけが行う。同一会社の有効な本登録Userによる既存document更新は、field・actor境界を機能単位で移行するまでの互換経路として維持する。
- Firestoreのclient書込み境界はcollection名だけで一律に決めず、各機能のactor、field ownership、整合性、監査、同時実行、offline要件を確認して機能単位で見直す。CUDを常にFunctionsへ移すこと、または常にclient Rulesへ残すことのどちらも共通原則とはしない。
- Company設定ではsuper-userであることだけを正式actorの根拠にしない。会社横断の保守・migration・repairは、恒久的なCompany設定権限ではなく、対象と作用を限定して個別承認されたservice provider/operator手順として扱う。表示順だけは、同じtenantの有効な本登録会社管理者でもあるsuper-userに、自社の`siteOrder`と`scheduleOrder`の更新を許可する。会社管理者でないsuper-user、他tenant、profile・billing・operations等の他のCompany設定にはこの例外を広げない。
- スーパーユーザーの例外権限は、明示されたルール・サーバー処理だけで許可する。
- スーパーユーザーに対する恒久的な全会社Firestore client read/write bypassは廃止する。将来、遠隔地の他社利用者を支援するため、所属会社を持つ有効なスーパーユーザーが、未確定の明示的な手続きを経て対象会社のdataをその場で扱えるsupport accessを提供する構想があるが、現時点では未実装とする。
- 各会社の会社管理者は`User.isAdmin === true`の1人だけとする。
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
- Employee退職は専用操作とし、退職日はserverのAsia/Tokyo暦日を基準に入社日以降かつ実行日以前に限定する。`human-resource`既定roleへ新設する`employees:terminate`を付与し、有効な本登録会社管理者にもoverrideを許可する。manager、`employees:write`、`users:provision`、`users:write`だけでは退職を許可しない。managerが別Userへ`human-resource` roleを設定して退職担当者を任命できる現行role管理境界は維持する。
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
- 以上のUWB-07契約は確認済み仕様である。client/serverのpermission catalog、Functions内のA/B/C input・actor・target純粋policy、server-only operation/event/lock/head schema、transaction store、共通registered User削除phase engine、A/B/C Callable、5分間隔reconciler、訂正用最小context、Rules、application UIは実装・自動検証済みで、Codex UI smokeと利用者local UI受入れも完了している。履歴一覧readerもCallable、専用page、route・navigation、cursor paging、自動単体・Emulator・Rules検証まで完了している。2026-08-25と26に利用者のログイン済みChromeで管理者menuから専用pageへ到達し、loading、空状態、無効な前後buttonを確認した。対象環境に履歴dataがないため実browser用に21件の退職・削除を作らず、data行のexact projection、20/21件境界、cursorによる次page・前page再取得は単体・Emulatorで検証する。current Auth disabled、仮User連携、別tenant同email再登録・Auth-only raceを含む残存陰性証拠も専用Emulatorで完了した。UWB-08の`firestore.rules`は、User client write拒否、Employee lifecycle field・delete拒否、lifecycle ledger/event/lock/head直接access拒否の3点について利用者確認を完了した。
- 管理者アカウントは誤削除を防ぐため削除不可とする。他に同社Userがいない最後の会社管理者も無効化できない。会社単位のAirGuardV2利用停止は、管理者無効化とは別の将来機能として扱い、現時点では未実装とする。
- 一般Userの本登録では、Authenticationで確認済みのcanonical emailに対応するemail予約が、一意の有効な仮登録Userを指すことを本人確認条件とする。確認完了前の本登録、会社ID・仮User IDをclient入力だけで信頼する処理、予約とUserの不一致は許可しない。
- 本登録前の未認証事前登録確認は、email予約とそのpointer先User、必要なEmployee予約が整合する場合だけ登録済みという真偽値を返す。会社ID、表示名、role、仮User IDは返さない。存在有無の列挙、App Check、rate limit、招待tokenは別の未完了security境界とする。
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
- 振込先はCompany rootの現行read境界を維持し、同社の有効な本登録Userが読める。振込先を読取actor別documentへ分割せず、変更は同じtenantの有効な本登録会社管理者だけを許可してsuper-userを拒否する。振込先以外のCompany情報の正確なread集合と、配置/予定管理actor等の後続operation別write allowlistはrestart inventoryで確定する。clientまたはCallableの選択は、server-only情報、複数resource、外部作用、不可逆性、必須auditの有無からoperation単位で決める。
- 通常の可逆なCompany編集はreal-time listenerで最新値を反映し、保存結果はlast-write-winsを受容する。編集中の同一operationへ別actorの変更が届いた場合は通知し、operation contractに従って再読込または明示再確認を要求する。共通revision、lock、operation ledgerは導入しない。
- expected value、transaction、idempotency、lock、ledgerは、権限・利用停止、削除、金銭、外部service、複数resource、復旧困難なdata loss、二重実行の具体的被害があるoperationだけに限定する。
- `siteOrder`と`scheduleOrder`は各最大2000件という現行候補上限と実際のdocument sizeを再計測し、Company本体と分ける必要性を判断する。分割前提にはしない。
- Devで確認済みのCompany rootは4件であり、旧新形式を通常運用で併存させず、backup、dry-run、短時間maintenance、全件変換、post-check、Dev受入れを一つのbounded migrationとして実施する。実data migrationは対象commit、件数、backup、rollback、停止条件、検証を固定した別の明示承認を必要とする。
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
- Stripe、checkout、webhook、plan、subscription、entitlement、employeeLimit、Stripe用PrivateSettingsは現段階のCompany構造とCCBから削除する。legacy fieldのcode/schema/data削除は、local migrationとDev migration・受入れまでを一つの独立roadmapとして完了させる。将来のサブスクリプション機能は旧CCB schemaを前提にせず新規設計する。
- 旧CCBの8 target、PrivateSettings、SettingAudits、runtime compatible reader、migration/restore planner、pre-containment Rulesと専用testは2026-08-30のcorrective rollbackで主repositoryから除去した。Company Rulesは旧CCB直前へ戻しつつ、UWBとCompany client create/delete拒否を保持した。Schemas exact `2.4.2-dev.167`の公開artifactとconsumer pin、Admin SDKのfail-closed guardは独立成果として保持し、公開packageをunpublishしない。Dev/remote dataは未変更であり、旧8 targetへのmigrationまたはrestore経路は現在提供しない。

### 取引先・現場・取極め

- 現場は取引先に紐づく。
- 現場の取引先変更は、過去の請求整合性を守るため許可しない。
- 取極めは現場、適用開始日、曜日区分、勤務区分に基づいて適用する。
- 同じ適用開始日・曜日区分・勤務区分の取極めを重複登録しない。
- 既存の稼働実績へ適用済みの取極めは、取極めマスタの後日の変更で自動更新しない。
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

- 現在のStripe Functionsは公開停止中であり、checkout、webhook、plan、解約、再契約、課金状態、従業員上限を提供済み機能として扱わない。
- CCBではsubscriptionとentitlementをserver-owned設定へ分離し、clientからの変更を拒否できる保存・表示interfaceだけを準備する。
- Stripeを再有効化する場合は、正式release直前の別改修でactor、plan allowlist、署名、冪等性、event順序、reconcile、状態遷移、保持、秘密情報、employeeLimit強制を承認・検証する。

### 保守状態とdata change

- maintenanceはCompany固有機能ではなくproject共通の運用境界であり、排他lockではない。
- product側の目標境界は、maintenance状態をserver-ownedとし、Firestore Rulesが通常client writeを拒否し、共通Callable identity/auth gateが新しい通常業務処理を拒否し、scheduled・trigger処理が対象tenantへの通常自動変更をskipすることである。明示承認されたprovider migration・repairと、checkpointに列挙したrebuild・検証だけを例外とする。
- operation lease、全Function共通wrapper、実行中処理registry、`DRAINING`状態は現段階で実装しない。maintenance開始後に処理別のbounded quiet periodを待ち、対象Functionのlog、連続するdry-run digestの安定、snapshot、post-checkを組み合わせて静穏状態を運用確認する。logだけを処理不存在の数学的証明とはみなさない。
- migration checkpointは対象環境・commit・service・collection/data・停止対象・quiet period・監視Function・backup・rollback・停止条件・dry-run/apply/post-check・derived data rebuild・解除後受入れを固定する。Site migration中の自動終了等、対象dataを変える通常scheduled/trigger処理は停止対象とする。
- maintenance開始前に受理済みの処理はbounded waitで終了を待つ。quiet period後にdry-runを繰り返し、連続するdigestが安定してからsnapshotとapplyへ進む。移行後は同じdry-run、対象integrity、必要と明示したderived dataの再構築、error logを確認してからmaintenanceを解除する。
- maintenance状態の取得不能は保護対象操作をfail closedとし、有限deadline、retry、状態再取得、利用者向け停止・通信障害表示を提供する。一般利用者の例外routeは停止案内とsign-outに限定し、保守・repairは製品内super-user権限でなく個別承認されたoperator手順から実行する。

## アプリケーション状態の責務

- `useAuthStore`: 認証、カスタムクレーム、ログインユーザー、ロール・権限。
- `useCompanyStore`: 現在会社と、サブスクリプションから導出される顧客区分。
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
- task交代中を除き、調査、review、test、利用者承認済みの補助実装等を独立した非重複scopeへ分割でき、専門roleの結果が必要な場合は、適切なsubagentを使用する。長期のマルチエージェント作業は、レビュー可能なチェックポイントを1件ずつ扱うイベント駆動型を基本とし、標準のセッション終了条件は安全に独立実行できる作業が尽きた時点とする。
- checkpoint固有のsubagent禁止は、当該checkpointのterminal callbackとcoordinator reviewまでに限定し、後続checkpointへ持ち越さない。task交代、no-change確認、ownership activation、retarget、replacement taskの最初のfile限定commitではsubagentを使用しない。
- コーディネーターのセッション容量が300 MiBに達した場合は新規割当を停止し、リポジトリへ引継ぎ状態を記録する。コーディネーター交代は利用者の明示承認後に行う。専門タスクは、安全なチェックポイントかつ差分統合済みの場合に限り自動交代できる。
- `容量チェック`、`タスク容量確認`、`セッション容量確認`、`session size / handoff threshold確認`は現在task IDに対応する永続session JSONLの実測を意味し、model token/context windowと区別する。task handoff閾値は300 MiB、Codex全体は10 GiBの参考警告とし、最新sessionを推測しない。ID不明、0件・複数一致、script失敗、全体scan不完全時は推測による交代・cleanup判断を行わない。
- コーディネーターと専門タスクの役割は、個別チャットではなく、本文書、ADR、ロードマップ、運用文書、変更履歴、Git、最新チェックポイントによって継続可能にする。
- ADR 0030の効率化手順はPM-09からPM-10への交代で発効済みである。完全新規task、primary repository、no-change callback、権限、最初のreal file-scoped commit、former taskの利用者削除境界を維持し、task-routed最小読取集合、bounded current snapshot、compact callback、staged/committed blob一致を使用する。
- 利用者が仕様、影響、rollback、検証条件を理解して明示承認したcheckpointまたはfeature boundary内では、Codexの`developer`をapplication実装の標準担当とする。Codex coordinatorは変更契約、checkpoint分割、実装・test・review・必要なin-app UI smoke、document、roadmap、ADR、local Git統合を管理し、承認範囲を隣接機能、未承認仕様、別repository、外部作用へ拡張しない。
- 承認済みcheckpointに必要なapplication code、Functions、Firebase Rules、関連設定は`developer`へ集中し、unit・domain・integration・Rules・Emulator等のtest fileはcoordinatorが明示したscopeで`tester`が編集できる。個々のtest fileごとの利用者承認は要求しない。explorer、researcher、reviewer、UI tester、security reviewerはread-onlyを維持する。
- UIまたは利用者操作へ影響するfeatureは、Codexの自動検証と必要なin-app UI smokeが成功した時点を「実装・自動検証完了／利用者受入れ待ち」とする。利用者が別途承認された実際の利用環境で最終UI acceptanceを行うまで、featureの最終受入れ、release完了、roadmap完了とは扱わない。application fileを1 fileずつ利用者が確認する手順はcheckpointが明示した場合だけ要求し、通常は承認済みsegment単位で実装・検証・報告する。
- Firestore Rulesの既存許可を狭める改修は、対象環境、data件数、許容停止時間、旧client併存の有無からcutover方式を選ぶ。正式release前のDevで全件をbounded maintenance内にbackup・変換・検証できる場合は長期互換層を必須とせず、production・複数client version・許容不能な停止・bounded maintenanceへ収まらない規模または外部作用がある場合だけ互換releaseを追加する。新規pathはdocument作成前にclient denyを確立する。詳細は[ADR 0031](decisions/0031-proportional-data-boundary-and-change-safeguards.md)と[開発workflow](runbooks/development-workflow.md#firestore-rulesを狭める改修順序)を正とする。
- roadmapは独立してFIXできる一つの利用者価値またはdata correctionを単位とし、設計、実装、local検証、必要なmigration、Dev反映、Dev受入れまでを原則100%とする。独立改修を一つの巨大roadmapへ集約せず、未実施のDev受入れを完了扱いしない。
- testerによるtest code編集は、利用者またはコーディネーターが対象を明示した場合に許可する。
- Codex専用local UI検証は、remoteへ到達しないdemo projectとloopback専用portを使い、CodexがEmulator、隔離済みFunctions、local server、合成Authentication account・data、Codex管理ブラウザの起動から終了までを所有する。`.codex-test`配下と通常のCodex専用test sessionにある合成dataは、作成・変更・削除、予約migration、candidate acceptance・promotionを含め、操作ごとの利用者承認なしに管理できる。利用者のChrome起動やsign-inを通常の前提にせず、利用者用local環境、Dev、Prod、実dataへ権限を拡張しない。上位のCodexまたはBrowser安全policyが要求する確認は維持する。Codex専用generated UIのbuildは従来どおり実行ごとの明示承認とし、承認済みbounded Dev release checkpointのDev buildとは分離する。
- CodexがブラウザUIの挙動・受入れを検証するときは、可視画面上で実利用者が行える通常のpointer・keyboard入力だけを操作証拠とする。`fill`、DOM・storage・Auth persistenceの直接変更、event・handler・component method・client APIの直接呼出し、force操作、disabled・hidden・overlay回避を用いた結果は受入れ証拠にしない。read-only観測と、OOB確認・backend verifier・export/import等の非UI処理は許可するが、それぞれUI操作、非UI準備、backend assertionとして区別する。2026-08-17までの旧基準によるdashboard到達証拠は履歴として保持するが、この基準での正規signup、再import後sign-in、dashboard到達は再検証が必要である。
- 実装、修正、改修は作業単位ごとにbranch境界を利用者と確認し、原則として機能単位の作業ブランチで行う。コーディネーターは合意済み範囲の差分と検証を確認してlocal Gitを管理し、利用者が動作を確認して明示的に承認するまで `main` へマージしない。
- `main` への統合は原則として機能単位のマージコミットを残し、Git上の取消し境界を明確にする。revert前にはデータ、外部作用、契約互換性を確認する。`main` への直接コミット、マージ、Git push、Prodデプロイはそれぞれ明示的承認を必要とする。Devは一つのbounded release checkpointに対する明示承認を、同runbook内の静的生成、deploy、remote検証の承認として扱う。
- 関連リポジトリはAirGuardV2の調査に必要な範囲で事前承認なく読み取れるが、変更は対象、影響、互換性、公開・導入順序を確認した利用者の明示的承認を必要とする。

## セキュリティと機密情報

- `.env`、Firebase Admin 資格情報、Stripe シークレット、Webhook シークレットをリポジトリ文書へ記載しない。
- 本番の個人情報、勤怠、顧客、請求、位置・現場情報を例示データとして転記しない。
- Firestore と Storage はクライアント UI とは独立した Security Rules で保護する。
- 管理者権限を使う Cloud Functions は入力、テナント、認証、再実行の安全性を検証する。
- 既知の認証・認可・tenant分離問題を改修の最優先事項とする。大規模な一括置換ではなく、利用者が仕様と影響を理解できる最小segmentに分け、現行挙動、攻撃・失敗経路、変更契約、互換性、rollback、陰性testを確認してから実装する。

## 現段階の完了条件

試験運用段階には固定した終了日を設けていない。各変更は次を満たしたときに完了とする。

- ユーザーが変更内容と確認観点を承認している。
- 実装、現行仕様、ADR、変更履歴、関連マニュアルの整合が取れている。
- データ移行、設定変更、デプロイが必要な場合、その手順と復旧方法が記録されている。
- ユーザーが対象環境で動作確認を行い、結果を判断できる。

Codexによる検証が明示的に許可された変更では、Codex専用のlocal Firebase Emulator環境に限定して単体・結合・UIテストを実施できる。認証後のUIテストも、Codexが専用Emulator、隔離済みFunctions、local server、合成account・data、Codex管理ブラウザの起動から終了までを所有し、可視画面上の通常操作で行う。利用者のChrome起動やsign-in済み画面の準備を通常の前提にしない。ただし、外部サービスへの作用を排除できない検証、リモート環境の検証、最終的な試験運用上の判断はユーザーが担当する。

## 未決事項

- スーパーユーザーの他社support accessについて、開始手続き、対象会社の選択・同意、許可範囲、有効期限、再認証、監査記録、終了・取消、同時session、緊急時の扱いを確定すること。
- `DailyAttendance.operationResultIds` の逆引きによる更新・削除方式への統一。
- ルートアプリと Cloud Functions の npm 依存関係の脆弱性対応。
- Stripe の本番運用、キャンセル UI、プラン選択、従業員数制限の最終仕様と実施状況。
- FCM・通知・Storage 関連の旧定義に混在する「完了」「未実装」記載と現在実装の再照合。
- 試験運用から正式運用へ移行するための SLA、バックアップ保持期間、監視・障害対応基準。

## 仕様変更規則

重要な変更はユーザーの明示的承認後に確定する。承認済みcheckpoint内ではCodexがapplication、必要なRules、test、自動検証、必要なin-app UI smoke、本文書、関連ADRと索引、`CHANGELOG.md`、関連マニュアル、運用文書を担当する。利用者はUIへ影響するfeatureを実際の利用環境で最終受入れする。push、`main` merge、deploy、Dev・Prod、remote/data、network、Schemas・Admin SDK・関連repository、package公開、migration、外部service変更は、それぞれ既存の別承認境界を維持する。

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
