# Customer archive safety実装設計

## メタデータ

- 状態: 設計確定・実装未着手
- checkpoint: `CUSTOMER-03-ARCHIVE-SAFETY-DESIGN`
- 最終確認日: 2026-09-04
- 正本: [現行仕様](../specification.md#取引先現場取極め)、[ADR 0046](../decisions/0046-customer-archive-reference-barrier.md)、[roadmap](../roadmaps/customer-archive-safety.md)
- 実装事実の根拠: `firestore.rules`、`utils/customer/**`、`composables/application/customer/**`、`pages/customers/[id].vue`、`functions/modules/billings/**`、installed Customer/Site/OperationResult/Billing schema、installed client/server adapter

## 現行事実

- Customerのclient create/updateは専用application処理とRulesでactor・field・schemaを限定する。active deleteと`Customers_archive` client CUDは拒否し、archive/restore UI・Callableはない。
- `Customers_archive`のclient readは同一tenantの有効Userに許可されている。
- installed Customer schemaは`logicalDelete=true`で、直接`hasMany`は`Sites.customerId`だけを列挙する。
- generic client/server deleteは監査metadataを持たず、既存archiveを`set`で上書きする。clientの参照queryはtransaction外で、serverはschemaの`collectionPath`と異なるpropertyを読む。
- generic restoreはactive同IDを確認せず全体`set`する。serverはarchive snapshotをtransaction readへ含めない。
- actual repositoryではSites、OperationResults、BillingsがcustomerIdを保持する。3 collectionのRulesは同一tenantの有効Userへ広いwriteを許し、active Customer存在を確認しない。
- Site schemaは保存前にCustomerをfetchし、OperationResult schemaはSiteからcustomerIdを同期するが、client schema処理は直接Firestore writeを拒否するsecurity boundaryではない。
- Billingのserver createはCustomerを取得するが、transaction-awareな共通参照barrierではない。Admin SDKはRulesを迂回する。

## 承認済み将来契約

### Callable input・actor

`archiveCustomer` requestは次のexact shapeとする。

| field | contract |
|---|---|
| `customerId` | trim後1〜128文字のsafe identifier |
| `reason` | trim後1〜200文字。不要な個人情報・認証情報を入力しない |
| `operationId` | clientが一操作ごとに生成する1〜128文字のopaque identifier。同じ入力の通信再試行だけ再利用 |

companyId、actor UID、時刻、Customer snapshotをclient inputとして受け取らない。既存`resolveCallableAuthIdentity`相当のcurrent Auth照合後、transaction内のactor Userを再読し、同社・本登録・非disabledとstrict role presetを確認する。会社管理者、またはknown preset catalogから`customers:write`を導出できるUserだけを許可し、それ以外はfail closedとする。現行catalogではmanagerとlegalが該当するが、実装でrole名を別途hard-codeしない。

### transaction read/write順

1. actor User、active `Customers/{customerId}`、same-ID `Customers_archive/{customerId}`をtransaction readする。
2. `Sites`、`OperationResults`、`Billings`を各`customerId == target`・`limit(1)`でtransaction queryする。
3. actor、Customer exact schema、archive衝突、参照0件、同operation retryを検証する。read完了前にwriteを始めない。
4. archiveが存在せずactiveだけが存在する場合、version 1 envelopeをsame-ID archiveへcreateする。
5. active Customerをdeleteする。
6. snapshotや監査内容を含まない最小結果を返す。

参照あり、active/archive同時存在、別operation archive、unknown archive schema、検証不能はwrite 0で拒否する。active不存在は、同じactor UID・operation ID・正規化済みreasonの完了済みarchiveだけを成功として回収し、それ以外を拒否する。Customer内容を再送せず完了結果だけを返す。

### archive envelope

`Customers_archive/{customerId}`は次の責務を持つexact envelopeとする。

```text
schemaVersion: 1
customer: active Customerの検証済み26-field snapshot
audit:
  operationId
  reason
  actorUid
  archivedAt
```

`customer`と`audit`を分け、将来restoreで監査fieldをactive Customerへ混入させない。`archivedAt`はserver timestamp、`actorUid`は検証済みactorとし、表示名・email・role・raw claimsを複写しない。archive writeはcreate-onlyで、同IDを上書きしない。

### Firestore Rules

- Customer createは通常のexact schema・actor条件に加え、同ID`Customers_archive`が存在しないことを必須にする。
- `Customers_archive`は同一tenant Userを含む全client actorについてread/create/update/deleteを拒否する。catch-all matchで迂回できない構造を維持する。
- Site createでcustomerIdがある場合、またはupdateでcustomerIdを新規設定・変更する場合だけ、同じcompany配下のCustomer存在を必須にする。customerIdなしの仮Siteは維持する。
- OperationResultとBillingはcreate、またはupdateでcustomerIdが変更される場合に同じ存在条件を必須にする。
- deleteとcustomerId不変updateは、この参照barrierだけを理由に拒否しない。各collectionの広いtenant内permission全体やSite customerId immutabilityは別checkpointで扱う。
- `Customers` collectionの存在を確認し、`contractStatus`は条件にしない。

### server writer

Admin SDKでSite/OperationResult/Billingへ新しいcustomerIdを保存するwriterは、transaction-awareな共通assertionで同じCustomer存在条件を検査する。現行のBilling create/move経路を対象にし、OperationResultが先にcommitした場合はarchive側のOperationResult参照確認でも拒否する。将来server writerを追加するときはsource-contract inventoryへ含める。

### UI

- 既存Customer詳細に、現在の`customers:write`判定と同じactorだけが見られる「アーカイブ」操作を追加する。read-only Userへ表示しない。
- 確認dialogへCustomer code/name、誤登録・重複専用であること、参照があれば実行できないこと、通常画面から復元できないこと、理由入力を表示する。
- operationIdはdialogの一回の実行単位で生成し、二重送信を無効化する。同じ失敗後の通信再試行だけ同じIDを使い、利用者が内容を変更して再実行するときは新しいIDを使う。
- 成功後はCustomer一覧へ移動し、一覧・cacheへarchive payloadを追加しない。参照あり、権限、競合、入力不正、内部失敗を安全な利用者向けmessageへmapし、UID・companyId・stack・raw reasonを表示しない。
- archive一覧、restore、purge、operator inspection UIは作らない。

## 失敗・競合契約

| 条件 | 結果 |
|---|---|
| 参照がarchiveより先にcommit | archive transactionが参照を観測して拒否 |
| archiveが参照より先にcommit | writerのCustomer存在guardが参照writeを拒否 |
| 同じoperationの通信再試行 | 既存archiveのactorUid・operationId・正規化済みreasonが全一致する時だけ完了結果 |
| 別operationまたは同ID再作成 | archive tombstoneによりconflict |
| actor role失効・disabled | transaction内再確認で拒否 |
| generic delete/restore呼出し | source-contract violationとしてtest失敗 |
| archive write後にclientだけ失敗表示 | 同operationId再試行で完了状態を回収 |

Firestore database edition・concurrency mode固有のlock挙動には依存せず、transactionのserializable commit順とwriter側の永続存在条件を組み合わせる。対象remote database editionはDev release前のread-only preflightで確認する。

## 対象・対象外

後続local implementationの対象候補は、Customer archive Callable/use-case/export、client action、Customer詳細の確認UI、Customer/Site/OperationResult/Billingの最小Rules guard、Billing server assertion、対象unit/Emulator/concurrency/source-contract/UI testである。exact owned filesは実装checkpoint開始前に再確認する。

対象外は緊急restore、operator inspection、物理delete/purge/retention、generic adapter/package修正、Site customerId immutability、3参照collectionのactor permission全体、Customer code一意性・検索、Schemas/Admin SDK変更、Stripe・通知、Dev/Prod・remote/data・migrationである。

## test契約

- unit: exact input、identifier/reason境界、全actor matrix、role失効、Customer/archive状態、3参照、same-op retry、different-op conflict、exact envelope、safe error/log。
- Emulator: archive read/CUD拒否、active delete拒否、same-ID create拒否、Site仮登録、3 collectionのmissing/archived/other-tenant Customer、customerId変更、fallback/nested bypass。
- concurrency: archive対Site/OperationResult/Billing create。許容最終状態を`active + reference`または`archive + referenceなし`に限定する。
- source contract: product codeからgeneric Customer delete/restoreへ到達しないこと、restore入口がないこと、reason必須。
- local UI: write actor表示、read-only非表示、確認・取消、参照あり拒否、二重送信、成功後一覧、reload後不存在、console error 0。

## 互換性・rollback・未確認

active Customer schema migrationは不要。Rules update guardはcustomerId変更時だけにし、既存orphanの無関係更新を不用意に止めない。既存flat archive、active/archive同ID、実参照件数はremote未確認であり、自動移行しない。

rollbackはarchive入口を先に停止し、archive済みIDが存在する間は参照guard、same-ID create拒否、archive client拒否を維持する。自動restore・archive削除をrollbackに使わない。

remote Firestore edition/IAM/App Check、実data、正式operator、保持期間は未確認で、CAS-01の完了条件に含めない。application、Rules、test、build、Emulator、Dev/Prod、remote/data、packageは本設計checkpointで変更・実行しない。
