# 0046 Customer archiveの参照barrierと監査境界

- 日付: 2026-09-04
- 状態: Accepted
- 関連仕様: `docs/specification.md` の「取引先・現場・取極め」
- 関連ロードマップ: `docs/roadmaps/customer-archive-safety.md`

## 背景

Customerの通常終了は`contractStatus=TERMINATED`で表し、archiveは誤登録・重複を参照がない場合だけ取り除く例外操作である。現行製品はactive Customerのclient deleteと`Customers_archive`のclient CUDを拒否し、archive UI・専用Callableを提供していない。

共通adapterの論理削除はCustomer schemaが列挙する`Sites.customerId`だけを事前確認し、監査metadataなしでactive snapshotをarchiveへ`set`する。参照queryはarchive transactionの外側にあり、server adapterはschemaの`collectionPath`と異なるpropertyを参照する。generic restoreもactive同IDを確認せず上書きできる。これらはCustomer固有の参照整合・監査・緊急restore境界を満たさない。

actual repositoryでは`Sites`、`OperationResults`、`Billings`が`customerId`を保持する一方、Rulesは同一tenantの有効Userに広いclient writeを許し、参照先Customerの存在を検査しない。archive transactionで現在の参照を確認するだけでは、そのcommit後に新しい参照を作るwriterを恒久には止められない。

## 決定

### 専用操作

- Customer archiveは`archiveCustomer`専用Callableだけで行い、generic `Customer.delete()`・`Customer.restore()`を呼ばない。
- requestはexact `customerId`、1〜200文字へtrimした`reason`、再試行を識別する`operationId`だけを受け取る。`companyId`、actor、時刻、Customer snapshotはclientから受け取らない。
- 会社は検証済みAuthentication identityから導出する。actorはcurrent Authentication accountと同じUID・確認済みemail・company claimを持つ、同社の有効な本登録Userでなければならない。
- 許可actorは会社管理者、または既知role presetから`customers:write`を得るUserだけとする。直接permission文字列、未知role、会社管理者でないsuper-user、仮登録、無効User、他tenantは拒否する。
- reasonへCustomer snapshot、住所、電話、認証情報その他の不要な個人情報を記載しないようUIで案内する。通常logへCustomer snapshot、reason、raw token/claims、User/Customer object、stackを出さない。

### transactionとarchive形状

- Callableは一つのFirestore transaction内でactor User、active Customer、同ID archive、`Sites.customerId`、`OperationResults.customerId`、`Billings.customerId`を読む。3参照queryは各`limit(1)`とし、statusや請求状態で除外しない。
- 参照が1件でもある場合はwrite 0で拒否する。active不存在は、同じactor UID・`operationId`・正規化済みreasonを持つ完了済みarchiveの再試行だけを成功として回収し、それ以外を拒否する。active/archive同時存在、別operationの同ID archive、読取・検証不能もfail closedとする。
- archive documentはactiveと同じ`Customers_archive/{customerId}`へ、`schemaVersion: 1`、元の26-field Customer snapshotを保持する`customer`、`operationId`・`reason`・`actorUid`・server確定`archivedAt`を保持する`audit`のexact envelopeとして`create`する。既存archiveを`set`で上書きしない。
- archive作成とactive Customer削除を同じtransactionで行う。同じactor UID・`operationId`・正規化済みreasonの確定済み再試行だけは既存結果を返し、異なるactor・入力・operationはconflictとして拒否する。responseは完了状態だけとし、Customer snapshot・reason・actor UIDを返さない。
- `Customers_archive/{customerId}`は削除済みIDのtombstoneでもある。active Customer createは同ID archiveが存在すれば拒否し、過去IDを別内容のCustomerへ再利用しない。

### 参照writer barrier

- archive transactionの参照確認と組み合わせ、`Sites`、`OperationResults`、`Billings`で`customerId`を新規設定または別値へ変更する全writerは、同じcompany pathの`Customers/{customerId}`が存在する場合だけcommitできるものとする。
- ここでのactive Customerは`Customers` collectionにdocumentが存在することを指し、`contractStatus=ACTIVE`を意味しない。ADR 0044のとおりTERMINATED Customerも通常の選択・業務操作に使用できる。
- Firestore Rulesは、Site createでcustomerIdがある場合とcustomerId変更、OperationResult/BillingのcreateとcustomerId変更でactive Customer存在を強制する。customerIdなしの仮Siteと、customerIdを変えない既存documentの更新・削除はこのbarrierだけを理由に拒否しない。
- Admin SDKはRulesを迂回するため、新しいcustomerIdを保存するserver writerもtransaction-awareな同じ存在確認を行う。現行Billing create/move writerはこの共通server assertionへ合わせる。将来writerを追加するときも同じ契約を満たす。
- Customer createは同ID archive不存在をRulesとserver writerの両方で検査する。

### archiveの公開とrestore

- `Customers_archive`のclient read/create/update/deleteを全actorへ拒否する。archiveは利用者向け一覧・ごみ箱ではなく、Customer snapshotと自由記述reasonを通常clientへ配布しない。
- 利用者依頼による削除情報確認は、将来の運営者専用inspection operationが認可・監査・最小projectionを定めてから提供する。
- restore、archive物理delete、自動purge、retention、匿名化は本判断で実装しない。緊急restoreは別の運営者専用operationとし、active同ID拒否、archive schema検証、reason/audit、別operation IDを必須にする。generic restoreは使用しない。

### 追加lock collectionを作らない

Customer archiveは削除と複数resource不変条件を持つため、transactionとidempotencyを使用する。一方、単一transaction、全参照writerのactive Customer存在guard、same-ID archive tombstoneで確認済み競合を閉じられるため、専用lock collectionや長期operation ledgerは追加しない。長時間のmulti-phase処理、Rulesでguardできないwriter、または単一transactionで防げない具体的故障が確認された場合だけ再検討する。

## 理由

archive側の一時点の確認と参照writer側の永続条件を組み合わせることで、参照が先にcommitすればarchiveが拒否され、archiveが先にcommitすれば後続参照が拒否される。archive document自体を同IDのtombstoneに使えば、追加collectionなしでID再利用と将来restoreの衝突も防げる。

Customer固有の不可逆操作へ専用Callableを使うことで、actor・tenant・監査・複数resourceを一つのoperation contractに固定できる。通常CRUD全体へlock・ledgerを広げないため、ADR 0031の比例原則とも整合する。

## 代替案

- generic adapterを利用する案: 参照query、metadata、archive衝突、restore上書き、server field契約がCustomer要件を満たさないため不採用。
- archive transactionだけで参照を確認する案: commit後の新規参照を止められないため不採用。
- Customer専用lock collectionを追加する案: active存在guardとarchive tombstoneで同じ故障をより単純に防げるため現時点では不採用。
- CustomerをTERMINATEDへするだけの案: 通常終了と誤登録・重複の除去を区別できず、承認済み運用と一致しないため不採用。
- archiveを同tenant Userへ直接readさせる案: Customer snapshotと監査reasonを通常clientへ広く公開するため不採用。

## 影響

- 仕様: Customer archiveのactor、入力、参照catalog、transaction、監査、idempotency、tombstone、公開境界を確定する。通常のCustomer状態、作成・基本・支払条件、検索は変更しない。
- application: 本ADRだけでは変更しない。後続checkpointでCallable、client action、既存Customer詳細の確認UIを実装する。
- Rules: 本ADRだけでは変更しない。後続checkpointでCustomer createと3参照collectionの最小guard、Customers_archive client read拒否を実装する。
- data: active Customerの26-field schemaは変更しない。archiveはversioned envelopeになる。既存flat archiveの件数・shapeはremote未確認であり、Dev release前のread-only状態確認を別承認で行う。
- package: Schemas、air-firebase-v2、client/server adapter、Admin SDKを変更しない。

## 互換性と移行

Rulesのupdate guardはcustomerId変更時へ限定し、既存documentの無関係field更新を止めない。既存orphanのcustomerId新規設定・変更は拒否される。現在のbroad same-tenant Rules testはactive Customer fixtureを用意し、collection別の許可・拒否へ更新する。

実data migrationは本判断に含めない。既存flat archiveまたはactive/archive同IDが確認された場合は、新archiveを開始せず、件数・shape・backup・変換・post-check・rollbackを固定した別checkpointへ分離する。remote Firestore edition、IAM、App Check、deployed Functions、実dataは未確認である。

## rollback

実装後の機能rollbackは、まずarchive UIとCallable入口を無効化する。archive済みCustomerが1件でもある間は、3参照writer guard、same-ID Customer create拒否、archive client拒否を残す。code rollbackだけでarchiveを削除したりactiveへ自動restoreしたりしない。data recoveryは別承認の運営者restore手順で行う。

本ADRと設計文書だけは通常のGit revertで戻せる。実装前なので現在のremote/data rollbackはない。

## 検証

- unit: exact input、reason/identifier境界、actor matrix、role revocation、参照3種、archive衝突、idempotent retry、safe error/log。
- Firestore Emulator: Customer delete/archive CUD拒否、archive read拒否、same-ID recreate拒否、Site仮登録、3 collectionのactive/missing/archived CustomerとcustomerId変更、他tenant・nested fallback拒否。
- concurrency: archiveと3種参照createを競合させ、`active Customer + reference`または`archive + referenceなし`以外の状態を許さない。
- source contract: generic delete/restore非利用、restore入口なし、reason必須。
- UI: actor別表示、確認内容、二重送信、成功後遷移、参照あり拒否の安全な表示。
- completion gateは`governance/verification-policy.json`のUI・application logic・data contractのunionを使用する。Dev/Prod generate・deploy・remote/data操作は別承認とする。

## 再検討条件

運営者inspection/restore、retention・purge・匿名化、既存flat archive migrationが必要になった場合、参照catalogへ新collectionを追加する場合、Rulesを迂回する新server writerが追加される場合、単一transactionへ収まらないmulti-phase処理が確認された場合に再検討する。
