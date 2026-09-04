# CAS-02実行契約とSpark Developer試験記録

## メタデータ

- 状態: In progress / local implementation completion gates passed / local commit and retrospective pending
- 対象: Customer archive safety roadmapの`CAS-02 専用Callable・監査・冪等性`だけ
- 対象外: CAS-03、CAS-04、CAS-05
- 正本: [現行仕様](../specification.md#取引先現場取極め)、[ADR 0046](../decisions/0046-customer-archive-reference-barrier.md)、[roadmap](../roadmaps/customer-archive-safety.md)、[実装設計](customer-archive-safety.md)
- 現在方式: primary taskのcoordinatorが`developer`、`tester`、`security_reviewer`、`reviewer`サブエージェントを順序立てて使用する

## 利用者承認と試行目的

2026-09-04に利用者は、`gpt-5.3-codex-spark`を使用する別Codex task `Developer`へ開発と単体testを委譲し、coordinatorが結果をreviewして受入れまたは差戻す試験運用を、CAS-02だけについて承認した。CAS-02完了時にDeveloperとcoordinatorで反省会を行い、CAS-03以降へ同じ手順を採用するかは、その結果を利用者が判断する。

Sparkの別task試験は実装前に中止した。その後、利用者はCAS-02自体を継続し、従来どおりprimary taskのcoordinatorが司令塔となってサブエージェントを活用するよう指示した。以後、別Codex task `Developer`は使用せず、application/Functionsとdomain単体testは`developer`サブエージェント、Emulator統合testは`tester`、安全性は`security_reviewer`、最終品質は`reviewer`へ委譲する。CAS-02完了時の反省会ではSpark試験停止と通常サブエージェント実行の両方を評価し、CAS-03以降の手順は利用者判断を待つ。

この承認はlocal repository内のCAS-02実装、test、review、文書、local branch・commitを対象とする。CAS-03/04、Firestore Rules、client/UI、Billingその他の参照writer、package、build、Dev/Prod、network、remote/data、migration、deploy、push、`main` mergeは含まない。

## 実行方式と書込みlease

- 全taskはprimary repository `C:\Users\seven\projects\AirGuard\air-guard-v2`を直接使用する。別worktree、別repository copy、gitignore対象のshadow実装領域を作らない。
- primary taskから作成する`developer`サブエージェントは`.codex/agents/developer.toml`を必読とし、自身がowned application/test fileを実装して、別writer subagentへ再委譲しない。primary user-facing taskとGit統合責務はcoordinatorに残す。
- coordinatorがCAS-02用local feature branchと開始commitを実物から確認し、Developer promptへ渡す。Developerも作業前にcwd、Git top-level、branch、HEAD、worktreeを独立確認する。
- Developerの実装checkpoint中はDeveloperを唯一のwriterとする。coordinatorと他taskはfile write、branch切替、stage、commit、formatter、test process起動を行わない。読み取りと待機だけを行う。
- Developerはstage・commitしない。terminal callback後、coordinatorがexact diff、worktree、test exit statusを確認し、受入れたfileだけを統合する。
- 別writerの変更、branch/HEAD drift、想定外dirty、owned file外の変更を検出した場合、Developerはapplication diffを増やさず停止して報告する。

## 起動確認checkpoint

別task作成直後は実装を開始せず、次だけを行う。

1. `AGENTS.md`、`governance/project-rules.md`、`docs/README.md`、本書、正本4点を読む。
2. cwdとGit top-levelがprimary repositoryそのものであることを確認する。
3. coordinator promptのbranch・HEADをactual Git stateと比較する。
4. `git status --short --branch`でcleanであることを確認する。
5. file write、Git mutation、test、process起動、networkを行わず、次の形式で一度callbackする。

```text
CAS02-SUBAGENT-ROUTE-01 <completed|failed|question|approval-boundary>
files: none
diff: none
tests: not run
unverified: <items or none>
approval-boundaries: CAS-02 local implementation/unit tests only
worktree: <clean or exact dirty paths>
```

このcallbackをcoordinatorが受理した後だけ、同じ`developer`サブエージェントへ実装checkpointを送る。

## Firestore targetとedition境界

CAS-02の実行targetは`firebase.codex-test.json`が指定するCodex専用local Emulatorと合成dataだけである。今回のcheckpointはFirestore databaseのsetup、Rules変更、remote read/write、Dev/Prod releaseを行わず、version 1 archive envelopeはCAS-01で既に承認済みのdata contractを実装する。実装はdatabase edition、concurrency mode、edition固有queryに依存させない。

remote Firestore project/database/editionは本checkpointのactual targetではなく未確認のまま維持する。DeveloperはnetworkやFirebase CLIによるremote確認を行わない。edition固有の設計・API・index・lock挙動が必要と判明した場合は、実装を進めず`approval-boundary`で停止する。remote Devへ進む将来checkpointでは、Firebase Firestore skillのpreflightに従い、利用者が選択・承認したdatabase targetについてeditionをread-only確認してから判断する。

## Developer実装checkpoint

### Checkpoint

`CAS02-SUBAGENT-DEVELOP-UNIT-01`

### Developer owned files

- `functions/modules/customer/archiveCustomer.js`（新規）
- `functions/modules/customer/customerArchiveDocumentContract.js`（新規）
- `functions/modules/customer/mappers/mapCustomerArchiveError.js`（新規）
- `functions/apis/archiveCustomer.js`（新規）
- `functions/apis/index.js`
- `test/domain/customer-archive.test.mjs`（新規）
- `test/domain/customer-archive-callable.test.mjs`（新規）
- `test/domain/map-customer-archive-error.test.mjs`（新規）
- `test/domain/callable-auth-identity-integration.test.mjs`
- `test/domain/codex-functions-entrypoint.test.mjs`

上記以外はread-onlyである。追加fileや既存file変更が必要な場合は、変更せず`question` callbackを返す。

### 禁止範囲

- `firestore.rules`、`firebase.json`、`firebase.codex-test.json`
- `test/local/**`
- client、composable、component、page、UI、CSS
- Site、OperationResult、BillingのwriterまたはRules
- Customer create、generic delete/restore、archive read、restore、purge、retention
- package manifest/lock、installed dependency、Schemas、Admin SDK repository
- documentation、roadmap、ADR、CHANGELOG
- branch切替、stage、commit、push、build、Emulator、Dev/Prod、network、remote/data、migration、deploy

### 実装契約

#### Callable入口

- `functions/apis/archiveCustomer.js`でv2 Callable `archiveCustomer`を公開する。
- 未認証は`unauthenticated`とする。
- `resolveCallableAuthIdentity`に現在tokenのUID、email、email verification、companyId、isSuperUserを渡し、Authのcurrent stateと照合する。companyId、actor UID、時刻、Customer snapshotをrequest bodyから受け取らない。
- unexpected errorのlogは固定messageと`errorName`、内部error codeだけに限定する。customerId、companyId、actor UID、reason、request/auth payload、Customer/User/archive snapshot、raw claims、stackをlogへ含めない。
- responseは新規archiveと同operation retryのどちらもexact `{ success: true, archived: true }`とし、snapshot、reason、actor UID、companyIdを返さない。

#### Input

- requestはown enumerable keyが`customerId`、`reason`、`operationId`の3つだけのplain objectとする。
- 3値はstringで、trim後の値を使用する。`customerId`はtrim後1〜128文字で、`/`とASCII control characterを拒否する。`operationId`はtrim後1〜128文字のopaque identifierとし、追加のUUID形式や文字種制限を導入しない。`reason`はtrim後1〜200文字とする。
- empty、上限超過、unknown/missing key、array、class instanceを`invalid-input`としてwrite前に拒否する。
- reasonの個人情報含有は機械判定しない。CAS-02にはUIがないため、利用者案内はCAS-04へ残す。

#### Actor

- transaction内で`Companies/{companyId}/Users/{actorUid}`を再読する。
- actor documentはplain objectで、`companyId`がidentity companyと一致し、`isTemporary === false`、`disabled === false`、`isAdmin`がbooleanでなければ拒否する。
- `isAdmin === true`は許可する。非adminはidentityの`isSuperUser === false`を必須とし、既存`resolveRolePermissions`でknown role presetだけを展開して`customers:write`を得た場合だけ許可する。role名や直接permission文字列を新規hard-codeしない。未知role、直接permission、欠損/不正roles、会社管理者でないsuper-userは拒否する。
- `resolveRolePermissions`の`RolePermissionError`を含むrole展開失敗は`actor-not-allowed`へ変換し、raw errorをCallable mapperやlogへ漏らさない。
- Auth照合後のrole失効・disabled変更をtransaction内actor readで拒否する。

#### Identity/path dependency

- use-caseはidentity object、`identity.uid`、`identity.companyId`、`identity.isSuperUser`をFirestore ref構築前に検証する。UID/companyIdはtrim済み1〜128文字で、`/`とASCII control characterを拒否し、isSuperUserはbooleanを必須とする。`resolveCallableAuthIdentity`が返すemailはpath・認可・archiveへ使用しない。
- invalid identityまたはFirestore dependencyは`invalid-dependency`としてtransaction開始前にfail closedとする。

#### Customer snapshot

- active documentは`Companies/{companyId}/Customers/{customerId}`から取得する。
- archiveへ保存する前に、own enumerable keyが既存の26 fieldだけであること、`docId === customerId`、型、nullable、長さ、timestamp、status、支払整数、location/geopoint一致、fullAddress、tokenMapを現行`firestore.rules`の`isValidCustomer`と同等に検証する。Functions側26-field定数は同じ名前・順序で固定し、unit source-contractでroot `CUSTOMER_DOCUMENT_FIELDS`との集合・順序parityを検査する。runtime production codeからroot moduleはimportしない。
- Admin SDKが返すdecoded valueを検証し、REST wire形状用`inspectCustomerDocumentFields`を流用しない。`functions/modules/customer/customerArchiveDocumentContract.js`にserver用の純粋validatorとarchive envelope validator/builderを置き、正規化、default補完、未知field除去、Customer instanceへの丸め込みで不正documentを通さない。
- `createdAt`、`updatedAt`とretry時`archivedAt`は`firebase-admin/firestore`のconcrete `Timestamp` instanceだけを許可する。`geopoint`はnullまたは同packageの`GeoPoint` instance、locationのlat/lngはfinite number、支払fieldはsafe integer、tokenMapはplain objectでown keyが512件以下かつ全valueが`true`であることを必須とする。`NaN`、`Infinity`、class instance、prototype継承値、server timestamp sentinelを確定済みtimestampとして受理しない。
- archiveの`customer`は検証済みactive snapshotの26 fieldを値変更せずexact copyする。

#### Transactionと参照

- `firestore.doc`、`firestore.collection`、`firestore.runTransaction`を依存として検査する。
- 一つのtransaction内で、actor User、active Customer、same-ID `Customers_archive/{customerId}`、`Sites`、`OperationResults`、`Billings`の順に読む。3 queryは同一companyのcollectionに対する`where("customerId", "==", customerId).limit(1)`とする。
- transactionの全readと検証が完了するまで`create`または`delete`を呼ばない。
- 3参照のどれかが1件以上、active/archive同時存在、archiveのunknown/invalid schema、Customer invalid、読取/検証不能ではwrite 0にする。
- activeだけが存在し参照0件の場合、same-ID archiveへ`transaction.create`し、次にactiveを`transaction.delete`する。`set`、`update`、generic Customer adapter/delete/restoreを使わない。
- activeもarchiveもない場合はnot foundとする。
- activeがなくarchiveだけがある場合、archive envelope全体を検証し、`schemaVersion === 1`、exact Customer snapshot、audit exact keys、確定済みtimestamp、`audit.actorUid === identity.uid`、normalized operationId/reasonの全一致時だけ成功retryとする。参照がある場合や一つでも不一致なら拒否する。

#### Archive envelope

```text
schemaVersion: 1
customer: <validated exact 26-field snapshot>
audit:
  operationId: <normalized operationId>
  reason: <normalized reason>
  actorUid: <validated identity uid>
  archivedAt: <server timestamp sentinel>
```

- envelope own keyは`schemaVersion`、`customer`、`audit`だけ、audit own keyは上記4つだけとする。
- 新規writeでは`FieldValue.serverTimestamp()`相当をdependency factory経由で注入可能にし、unit testでexact payloadとcall回数を検証する。
- retry検証ではcommit済みのconcrete Firestore `Timestamp`を必須とし、任意objectやserver timestamp sentinelを受理しない。

#### 安全なdomain errorとCallable mapping

- domain error codeは少なくとも`invalid-input`、`invalid-dependency`、`actor-not-allowed`、`customer-not-found`、`customer-invalid`、`references-exist`、`archive-conflict`を区別する。
- Callable mapperはAuth identity error mapperを先に適用し、domain codeを固定された日本語messageへ変換する。入力は`invalid-argument`、actorは`permission-denied`、不存在は`not-found`、参照ありは`failed-precondition`、archive/状態衝突は`aborted`、依存・不正persisted state・unknownは`internal`とする。
- error messageやdetailsへidentifier、reason、raw dependency errorを埋め込まない。

### 単体test契約

`test/domain/customer-archive.test.mjs`で少なくとも次を検証する。

- exact input、trim、1/128/200境界、customerIdのslash/control拒否、operationIdのopaque契約、unknown/missing key、plain object
- invalid dependency/identity
- admin、known presetの`customers:write`、read-only preset、直接permission文字列、未知role、非admin super-user、temporary、disabled、cross-tenant、role失効
- active/archivedの4状態、unknown archive version、invalid envelope、same actor+operation+reason retry、各不一致conflict
- Sites、OperationResults、Billingsをすべて読み、各参照ありでwrite 0
- 全readがwriteより先であること、query path/where/limit、`transaction.create`→`transaction.delete`の順、`set`/`update`不使用
- exact 26-field validationと、extra/missing/type/derived/location/geopoint/tokenMap/timestamp異常
- Functions側26-field定数とroot `CUSTOMER_DOCUMENT_FIELDS`の集合・順序parity
- exact version 1 envelope、server timestamp factory 1回、minimal response
- generic Customer delete/restoreまたはgeneric adapterをimport/callしないsource contract

`test/domain/map-customer-archive-error.test.mjs`で全domain code、Auth identity code、unknown errorの安全なmappingを検証する。message/detailsに合成identifier、reason、raw errorを含めない。

`test/domain/customer-archive-callable.test.mjs`で未認証拒否、共通Auth identity gate、server-derived company/actor、safe mapper、固定metadataだけのlog、minimal response、requestや機微情報をlog/responseへ出さないsource contractを検証する。

`test/domain/callable-auth-identity-integration.test.mjs`のestablished-company Callable一覧へ`archiveCustomer.js`を追加し、共通Auth identity gateを迂回できないことを固定する。

`test/domain/codex-functions-entrypoint.test.mjs`へ`archiveCustomer`だけを追加し、Codex用Functions entrypointの公開export集合を固定する。

Developerは次のtargeted commandを一つずつ実行し、各exit statusをcallbackへ記録する。

```powershell
node --test test/domain/customer-archive.test.mjs
node --test test/domain/customer-archive-callable.test.mjs
node --test test/domain/map-customer-archive-error.test.mjs
node --test test/domain/callable-auth-identity-integration.test.mjs
node --test test/domain/codex-functions-entrypoint.test.mjs
node --test test/domain/role-permissions.test.mjs
node --test test/domain/resolve-callable-auth-identity.test.mjs
node --test test/domain/map-callable-auth-identity-error.test.mjs
git diff --check
```

Developerは`domain-full`、Emulator、build、文書validatorを実行しない。

### Developer callback

```text
CAS02-SUBAGENT-DEVELOP-UNIT-01 <completed|failed|question|approval-boundary>
files: <exact paths>
diff: <behavioral summary>
tests: <each exact command, result, independently observed exit status>
unverified: domain-full, Emulator integration, independent security/review, final docs and Git integration
approval-boundaries: <items or none>
worktree: <clean or exact dirty paths>
```

`developer`はcallback後に待機し、coordinatorから差戻しがある場合だけ同じowned filesを修正する。

## Coordinatorの受入れ・差戻し

coordinatorはDeveloper callback後に次を実物で確認する。

- branch、HEAD、worktreeとexact changed files
- owned file以外の変更がないこと
- input、actor、tenant、all-reads-before-writes、3参照、create-only、delete、exact envelope、retry、safe error/log、minimal response
- targeted testの再現とexit status
- CAS-03/04、remote/data、packageへscopeが広がっていないこと

承認範囲内のcode/test不備、review finding、説明不足は同じ`developer`サブエージェントへ具体的なfile/symbol/test付きで差戻す。仕様変更、owned file追加、unowned dirty、branch/HEAD drift、network・package・remote/dataの必要、CAS-03/04が必要になった場合は作業を増やさず停止し、利用者へ報告する。

## Developer受入れ後の独立工程

Developer差分を受入れた後、同時書込みは行わず、次を順に行う。

1. `tester`へCAS-02 CallableのCodex専用Firestore Emulator統合testを委譲する。委譲前にcheckpoint ID、actual baseline、source of truth、exact owned/forbidden files、合成fixture、commands、callbackを固定し、application codeは変更させない。最低限、新規archive、same-operation retry、Sites/OperationResults/Billings各参照時のwrite 0、safe response/log、remote/external effect 0を検証する。
2. `security_reviewer`にactor/tenant、persisted data、idempotency、log/response、fail-closedをread-only reviewさせる。`reviewer`には正本整合、回帰、test不足をread-only reviewさせる。両promptはactual baseline、source、forbidden scope、completion contract、callbackを明記する。
3. findingはownerへ返す。Functionsまたはdomain unit testはDeveloper、Emulator testはtester、文書/processはcoordinatorが担当する。
4. tester変更がある状態でDeveloperを再開する場合、coordinatorはaccepted test dirty path、現在HEAD、保持すべき差分、Developer owned filesをlease renewal promptへexactに記載する。Developerは既知accepted test dirtyをread-onlyで保持し、未知dirtyまたは重複ownershipを検出した場合だけ停止する。
5. 変更で失効したtest/reviewを再実行する。
6. 最終worktreeでapplication logicとdata contractのunionとして`project-docs`、`domain-full`、`local-emulator-suite`、`diff-check`を各commandのexit statusが独立して分かる形で実行する。UI変更がないため`local-ui-build`は省略する。release-onlyの`generate-dev`/`generate-prod`は実行しない。
7. coordinatorがreview済みfileと文書だけをstage・commitする。push、merge、deployは行わない。このCAS-02 commit単独は、CAS-03の後続参照barrier、same-ID create deny、archive client read denyを含まないため、deploy/release-readyではない。

### ログ契約の実装解釈

`archiveCustomer`が制御するstructured log payloadは、`severity`、固定`message`、`errorName`、内部`errorCode`だけとする。raw error、stack、request、Auth token/claims、Customer・Company・actor識別子、`operationId`、`reason`、snapshot、document pathをapplication codeから渡さない。Firebase Functions / Cloud Loggingがruntime resource、timestamp、trace correlationなどのplatform-managed metadataを付加することは許容するが、archive domain dataやstackをapplication payloadへ追加したものとは扱わない。local targeted testはdirect Callable run時のapplication payloadを厳密に確認し、wrapped HTTP trace contextは未確認事項として残す。

## CAS-02完了時の反省会

CAS-02の完了gateとlocal commit後、coordinatorは実装を担当した`developer`サブエージェントへ反省会checkpointを送り、file変更なしで次を報告させる。

- 指示書だけで迷わず判断できた点と不足した点
- Sparkが得意だった作業、遅延・誤解・再作業が生じた作業
- initial callback、実装callback、差戻し回数と主因
- owned file逸脱、同時書込み、branch/HEAD drift、test対象不一致の有無
- test失敗とreview findingのうちDeveloperが事前に防げたもの
- CAS-03へ同じ方式を採用する場合の具体的な修正案
- CAS-03では別model、別分割、追加roleが必要と考える条件

coordinatorは実測したcallback、差戻し、diff、test、review、書込み競合とDeveloper所見を本書へ記録する。事実と推測を分け、CAS-03以降を自動開始しない。反省会記録をread-only reviewerへ確認させ、最終文書状態で`project-docs`と`git diff --check`を個別にexit 0まで再実行し、反省会文書commitとclean worktreeを確認する。結果と選択肢を利用者へ提示し、次の手順は利用者判断を待つ。

## 中間実行記録

### 2026-09-04 通常サブエージェント実装・対象検証

- `developer`は確認済みbranch `codex/customer-archive-cas02-trial`、開始HEAD `e0f61dba83fdfbac2895efd916a8a44a3c414135`で、専用Callable、Customer archive use-case、version 1 document contract、安全なerror mapper、API export、domain testを実装した。owned file外の変更、stage、commit、network、remote/data、deployはなかった。
- 実装はcurrent Auth identity、transaction内actor再確認、exact input、actor・active Customer・同ID archive・Sites・OperationResults・Billingsのall-reads-before-writes、参照時write 0、create-only archiveとactive delete、exact 26-field snapshot、server timestamp、same-operation retry、固定応答を実装した。generic delete/restore、Rules、client/UI、参照writerは変更していない。
- 最初の独立reviewで、壊れた既存archiveを`aborted`へ誤分類する問題と、新規`archivedAt`が任意objectでもunit testを通る問題を検出した。Developer差戻し後、壊れたarchiveは`archive-invalid`から固定`internal`へ、well-formed retry mismatchだけは`archive-conflict`から固定`aborted`へ分離し、新規writeは実物のAdmin SDK `FieldValue.serverTimestamp()`だけを許可した。
- `tester`は`test/local/codex-local-harness.test.mjs`だけを変更し、新規archive、client spoof拒否、same-operation retry、Sites・OperationResults・Billings各参照時のwrite 0、current Auth・登録actor境界、安全なresponse/logをCodex専用Emulatorで検証した。最初の厳格なruntime log testで`logger.error`が自動stackを付加する問題を検出し、Developerは4-field structured `logger.write`へ修正した。再実行は5/5成功、exit status 0だった。
- Tester追加helperへの独立reviewで、子Node processにtimeoutと出力上限がないP2を検出した。Tester差戻し後、30秒timeout、stdout/stderr合算1 Mi文字上限、single-settlement、best-effort kill、listener/timer cleanup、`windowsHide`を追加し、同じtargeted Emulator testは5/5成功、exit status 0だった。timeout・出力超過のfault injectionは未実施である。
- 最終の一般reviewとsecurity reviewでは、上記修正後のCAS-02 application codeに追加のactionable findingはなかった。Firebase SDKがtrace context時にplatform-managed trace fieldを付け得る点は低riskの証拠解釈として残し、application-controlled payloadの4-field制限と区別した。
- coordinatorがtargeted domain testを再実行し、Customer archive 13/13、Callable 5/5、error mapper 3/3、共通Auth integration 2/2、Functions entrypoint 1/1、role permission 7/7、Auth identity 10/10、Auth mapper 3/3をそれぞれexit status 0で確認した。targeted Emulator 5/5もtesterがexit status 0で確認した。
- 最終worktreeでcoordinatorが`node --test test/domain/*.test.mjs`を実行し873/873、exit status 0、続いて`npm run test:local`を実行し123/123、exit status 0を確認した。後者はproject `demo-air-guard-v2-codex`、loopback only、`AIR_GUARD_EXTERNAL_EFFECTS=deny`、利用者用`saved-data`不変、専用seed read-onlyを報告した。Firebase CLIのMOTD取得失敗・期限切れ認証・同一projectの複数Emulator警告は出たが、local suiteは完了し、remote project/data操作は行っていない。文書gate、final diff-check、local commit、反省会はこの記録時点では未完了である。
- CAS-03のarchive client read deny、same-ID create deny、Sites・OperationResults・BillingsのRules/server writer barrierがないため、この差分単独はdeploy禁止・release-readyではない。CAS-03/04は開始していない。

### 2026-09-04 Spark開始時停止

- 最初の`Developer` taskは`CAS02-SPARK-ROUTE-01`を変更なしで完了し、primary repository、branch、開始HEAD、clean worktreeの一致を報告した。
- 同taskの実装turnは、owned fileの書込み前に既存構造の探索を続け、Codexからcontext window不足のsystem errorが返って停止した。coordinatorの実測では所要約8分46秒で、Functions・test差分は0、branchとHEADは不変、worktreeはcleanだった。
- coordinatorは全repository探索を止め、必読範囲と探索対象を縮小して、同じ`gpt-5.3-codex-spark`の新しい`Developer` taskを作成した。`CAS02-SPARK-ROUTE-RETRY-01`は約11秒で変更なし完了し、同じbranch、開始HEAD、clean worktreeの一致を報告した。
- retry taskの実装turnは開始直後、Spark固有のusage limitによりsystem errorで停止し、Codexは15:58以降の再試行を案内した。アカウント全体のusage確認は45%使用で、Spark固有の残量・reset詳細は取得できなかった。差分・test実行・Git mutationは0だった。
- 2026-09-04 11:44 JST時点で、coordinatorはbranch `codex/customer-archive-cas02-trial`、HEAD `e22c0f2c73d5b776d81359fab8b030a755e984f2`、clean worktreeを再確認した。
- その後、利用者はSparkモデルの別Developer taskによる開発を中止した。15:58 JST以降の再試行、別modelへの自動切替、新しいstandalone Developer task作成は行わない。

上記は中間事実であり、CAS-02の実装・test・review・完了gate・反省会を完了した証拠ではない。CAS-02はIn progress、得点0を維持し、CAS-03/04は開始しない。

### 中止時の所見

- 確認済み事実: route確認2回はrepository、branch、HEAD、clean worktreeを正しく照合した。Functions・testの変更、targeted test、Emulator、build、network、remote/data、Git mutationは0だった。
- 確認済み事実: 最初の実装turnはcode編集より先に探索を継続してcontext windowを使い切った。探索を縮小したretry taskは実装turn開始直後にSpark固有usage limitへ達した。
- 未確認: Spark固有のtoken/usage上限量、最初のcontext window停止が次taskのusage limitへ与えた正確な消費量、reset後に同じ指示で実装完了できたか。
- 推測: repositoryの必読ガバナンスと詳細な安全契約を保持したCAS-02は、短いfocused editよりcontext負荷が高く、今回利用可能だったSpark個別枠と相性が悪かった可能性がある。
- 後続判断: 利用者はCAS-02を通常のサブエージェント運用で継続すると決定した。Spark用standalone taskは再利用せず、本書の技術契約を`CAS02-SUBAGENT-DEVELOP-UNIT-01`へ引き継ぐ。CAS-03以降の手順は未決定のままとする。

## Rollback

CAS-02はlocal未deployのため、機能rollbackはreview済みCAS-02 commitをGitでrevertし、Callable export、専用module、domain/Emulator testを一組で戻す。remote archive dataは作成しておらず、data rollbackはない。部分的にCallableだけをdeployせず、CAS-03のbarrierが揃うまでrelease対象へ含めない。試験運用記録は履歴として保持し、CAS-03/04は未着手のまま維持する。
