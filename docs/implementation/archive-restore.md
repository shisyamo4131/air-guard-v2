# アーカイブ・物理削除の実装差と設計

## 共通仕様との対応（2026-09-06）

確認済み原則は[現行仕様の共通節](../specification.md#ドキュメントのアーカイブと物理削除)を唯一の正本とする。以下の設計案・実装事実と、製品への適用済み状態を分ける。共通仕様をまとめても既存masterを一括移行しない。

| 対象 | 現在の実装・提供 | 共通仕様への残対応 |
|---|---|---|
| Customer | 専用archive Callable、同transactionの従属検査、version付き原本・監査、参照writer guard、archive client read/CUD拒否 | 自動purge・通常restoreは提供しない。保持・運営者操作は固有仕様に従う |
| Site | `functions/modules/sites/archiveSite.js`と`siteArchiveDocumentContract.js`。専用操作で同ID移動・監査・再送照合。参照5種類とwriter guard。archive readは同社の有効な本登録User、client CUD拒否 | 物理削除・通常restoreは未提供。Siteのfield・read・依存catalogを他masterへそのまま適用しない |
| Employee | 専用archiveは未実装。旧generic modelの移動機能と削除triggerが残る | [EMP-01設計](employee-master.md#employeeのarchive設計)に沿いactor・依存・writer・trigger・snapshot・readを保護する |
| Outsourcer | 通常製品でarchive・restore・物理削除を提供しない | 固有の非提供条件を維持する |
| Article / generic adapter | 下記の旧共通基盤調査を参照 | metadata、参照検査、上書き、迂回、restoreの問題が未解決。新しい共通仕様の適用済み実装ではない |

Customer/Siteの最新実装は各master文書とADR 0046/0051を参照する。以降のgeneric基盤の「metadataなし」「広域write」「UIからmodel.delete」等をCustomer/Siteの現在の専用経路へ当てはめない。共通処理の存在と、安全な製品入口の提供を区別する。

## 物理削除の設計案

以下はarchive対象masterのreview用未実装案で、User/Auth専用削除・予約解放・業務transactionの削除へ適用しない。定期バッチ・保持期間・新collection採用の指示ではない。EmployeeではEMP-05にarchive/参照保護、purge実行は後続専用工程とする配分を採用済み。以下の具体運用はその工程で判断し、purge運用の全決定をEmployee通常CRUDの前提にしない。

1. 許可actorが、対象collectionをserver側で固定した専用操作へ対象ID・期待するarchive操作ID・物理削除操作IDを渡す。client指定の任意pathを削除する汎用APIは公開しない。自動maintenanceの場合も対象・実行主体・期間を別に確定する。
2. serverは現在認可、archive形式/対象、原本不存在、従属なしを確認する。依存確認とarchive削除・結果記録は同transactionで確定する。通常原本の存在確認を行う参照writer、原本同IDの再作成拒否、restore排他も維持する。複数documentのメンテナンスは対象1件ごとに判定し、一部成功を全件成功に丸めない。
3. 従属あり・不整合・検査不能は本体を消さず、試行時刻・対象ID・理由code・必要な参照先識別情報だけを結果へ記録する。自由記述の住所・保険・provider応答全文をerror記録へ複写しない。利用者による参照先の訂正は当該業務operationの権限と確定済みdata条件に従い、削除のために無条件で書き換えない。
4. 成功時はarchive文書全体をdeleteし、snapshotと自由記述監査も抹消する。同pathにmetadataだけを残すfield削除とは区別する。推奨案として、同transactionで別pathのserver-only使用済みID記録に、collection/対象ID、archive操作ID、物理削除操作ID、実行者UID、server時刻、完了結果だけを残す。記録先はtenantとserver固定の対象種別に束縛し、clientが別tenant/pathを指定できないようにする。新規作成は同ID archiveと使用済みID記録の双方をtransactionで確認して拒否する。これにより削除後の古い作成要求による再生成を防ぐ。毎回の予定更新にはこの記録を読ませず、対象masterの新規作成・purge再送だけで使う。
5. この記録は原本のarchiveではないが、対象ID・actor UIDという関連情報を保持する。「Firestoreから関連情報まで完全消去」とは呼ばない。保持期間と消去条件は運用判断であり、同ID再利用拒否を保証する期間は記録を維持する。記録を残さない方式では、同等のID非再利用・古い要求拒否を別に成立させるまでpurgeを開放しない。
6. 応答不明の再送はtenant・server固定の対象種別・対象ID・期待archive操作ID・物理削除操作ID・actorの全てを完了記録と照合する。別tenant、別masterの同ID、異なる期待archive操作IDを陰性試験に含める。記録なしの不存在を無条件成功にせず、別操作・別世代への適用を拒否する。実行時にも現在権限を確認する。

エラー表示用collectionを採用する場合、最新runの結果を置き換える案は可能。ただし実行中・完了・失敗を識別し、途中の空集合を「問題なし」と表示しない。重複実行で結果を消し合わない。前回の全削除を先に行う方式ではなく、完成した今回結果へ表示先を切り替える方式を推奨する。これは使用済みID/完了記録とは別であり、エラー一覧の初期化で再作成拒否や再送結果を消さない。run方式・表示actor・保持・実行頻度はCONF-0123で未決として管理する。

subcollectionや別保存先を持つ対象は、原本文書のdeleteだけでそれらまで消える前提を置かない。対象ごとのcatalogに残存があれば拒否または別の承認済み処理へ分ける。backupから復旧する際も使用済みIDとの矛盾を点検し、旧documentを無条件に再投入しない。

## 旧generic基盤の調査（専用経路とは別）

## メタデータ

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-042
- 最終確認日: 2026-09-04
- 根拠ファイル: `air-firebase-v2/index.js`、client adapter `index.js`、server adapter `index.js`、schemas `Article.js`、`Customer.js`、`Site.js`、`Employee.js`、`Outsourcer.js`、`firestore.rules`、admin-sdk `src/constants/collections.js`、代表UIと既存master実装文書
- 関連調査: `article-master.md`、`customer-master.md`、`customer-archive-safety.md`、`site-master.md`、`employee-master.md`、`outsourcer-master.md`、`user-auth-lifecycle.md`

`LogicalDeleteMixin`という独立class/mixinは確認できない。共通契約は`FireModel.logicalDelete`静的flagとclient/server adapterの`delete`/`restore`で実装される。

## 旧generic基盤のデータ契約

- active pathは`{prefix}/{Collection}/{docId}`、archive pathは同じcollection名へ`_archive`を付けた`{prefix}/{Collection}_archive/{docId}`である。
- archive documentはactive snapshot dataをそのままcopyする。同一doc IDを維持する。
- `archivedAt`、`archivedBy`、理由、source path、schema version、retention deadline、original create/update revision等のarchive専用metadataは追加しない。
- activeからarchiveへ移ること自体が論理削除状態で、active documentにdeleted/status flagは付けない。
- archive documentは元schema instanceとして自動購読されず、通常のactive queryからは消える。
- nested subcollectionをcopy/deleteする共通処理はない。Firestore documentだけを移すため、対象doc配下にsubcollectionがあれば元path下へ残る。

## delete flow

1. instanceの`docId`とcallback型を検証し、schema固有`beforeDelete`を呼ぶ。
2. `hasMany`定義を順にlimit(1) queryし、参照が1件でもあれば削除を拒否する。
3. transaction内でactive documentを読む。
4. `logicalDelete=true`なら同ID・同dataを`{Collection}_archive`へ`set`する。
5. active documentをdeleteする。
6. 任意callbackを同じtransactionへ渡す。

archive copyとactive delete自体は同一transactionである。`logicalDelete=false`ではarchive copyなしでactiveを物理削除する。

clientとserverでcallback引数名が異なり、clientは`callback`、serverは`callBack`である。FireModelのJSDocは`callBack`を記載するが、client adapterはそれを読まない。

## restore flow

Customerについては、archiveを利用者向けrecycle binとせず、通常`customers:write` Userのrestoreを禁止する方針が2026-08-11に確認された。restoreは運営者管理の緊急contingencyとして通常UIから隔離し、reason/auditを必須とし、active同IDが存在すればoverwriteせず拒否する。User依頼による削除情報確認は運営者の監査付きinspectionとして扱う。

2026-09-04にCustomer固有のarchive設計を[ADR 0046](../decisions/0046-customer-archive-reference-barrier.md)で確定した。Customerは下記のgeneric delete/restoreを使わず、専用Callable、Sites・OperationResults・Billingsのtransaction内参照確認、参照writerのactive Customer存在guard、same-ID archive tombstone、version付き監査envelopeを使用する。archiveのclient read/CUDも拒否し、運営者inspection/restoreは別の未実装operationとする。他masterの共通archive契約はこのCustomer固有判断で変更しない。

1. restore対象`docId`とprefixからarchive pathを求める。
2. archive snapshotを読む。
3. archive documentをdeleteし、同dataをactive同IDへ`set`する。
4. active DocumentReferenceを返す。

client adapterはarchive読取を`txn.get`で行う。server adapterは`archiveDocRef.get()`をtransaction callback内で呼ぶがtransactionの`txn.get`ではなく、読取とwriteの整合がtransaction retry/preconditionへ組み込まれない。

両adapterともactive同IDの存在確認をせず`set`するため、既存active documentがあればarchive内容で上書きする。merge指定はなくdocument全体を置換する。restore前後hook、`hasMany`、field validation、conflict UI、actor metadataはない。

## 対象別差分

| 対象 | logicalDelete | hasMany guard | archive Rules/UI |
| --- | --- | --- | --- |
| Article | true | 定義なし | `Articles_archive` Rulesあり。archive一覧/restore UIなし。埋込みArticle ID参照はguard外。 |
| Customer | true | Sites.customerId | Rulesあり。restore APIはあるがUIなし。TERMINATED状態とは別。 |
| Site | true | schedules/results/arrangement notificationsのsiteId | Rulesあり。UIは削除後復元不能と表示し、restore入口なし。TERMINATEDとは別。 |
| Employee | true | schedules/resultsのemployeeIds、arrangement notifications.employeeId | Rulesあり。UIは復元不能と表示。DailyAttendance等はguard外。RESIGNEDとは別。 |
| Outsourcer | true | schedules/resultsのoutsourcerIds | 通常productではarchive／restore／物理deleteを提供せず、live masterとして保持する。client live deleteとarchive CUDは拒否。Notification等はgeneric guard外。終了statusとは別。[ADR 0050](../decisions/0050-outsourcer-live-retention-without-archive.md)を参照。 |

Company、User、OperationResult、Billing、DailyAttendance等は`logicalDelete=false`で、この共通archive対象ではない。User/Auth削除やStorage cleanupは別契約である。

## 参照guard

- client `hasChild`はschemaの`hasMany[].collectionPath`を使い、company prefix付きcollectionまたはcollection groupをqueryする。
- queryはtransaction外の`getDocs`である。参照なし確認後、archive transaction commit前に別processが参照を作成できるTOCTOU競合があることをadapterコメントも認識している。
- server `hasChild`はschemaが定義する`collectionPath`ではなく`item.collection`を読む。代表5 schemaは`collectionPath`を使うため、hasManyを持つCustomer/Site/Employee/Outsourcerのserver deleteはundefined collection pathで失敗する候補である。ArticleはhasMany空のためこの不一致を通らない。
- guardは明示列挙だけであり、埋込みsnapshot、派生集約、履歴、通知、帳票等の全参照を自動発見しない。
- guard queryとarchive Rulesは別境界で、直接Firestore writeはschema method/guardを迂回できる。

## transaction・冪等性

- deleteのarchive setは既存archive同IDを存在確認せず上書きする。activeがなければdelete再実行はnot-foundとなるため、操作全体はidempotent successにはならない。
- restoreはarchiveがなければnot-foundとなり、再実行は失敗する。active既存時は拒否せず上書きするため、安全なidempotencyではない。
- Firestore transactionは競合時retryし得るが、client/serverのhasChild queryとserver restore archive readはtransaction外である。
- callbackはtransaction retry時に複数回評価され得る。外部作用禁止やpure callbackのcontractは明記されない。
- concurrent active再作成、direct archive edit、restore、deleteが同IDで競合した場合のrevision/ownership checkはない。

## UI・運用

- 代表master UIは汎用managerの`item.delete()`へ到達するが、archive一覧、検索、preview、restore、purge UIは確認できない。
- Site/Employee等の削除dialogは「復元することはできません」と説明する一方、adapterにはrestore APIがある。実装可能性と利用者向け運用が一致しない。
- active statusの終了/退職とarchiveは別で、通常終了・誤登録・法定保持・復旧の使い分けはmaster別CONFとして未決定である。
- Customerは通常終了をTERMINATED、再開をACTIVE、参照なしの誤登録・重複だけをarchiveとする。archiveへreason/actor/timeを残し、通常User restoreと物理delete UIを設けず、保持要件確定まで自動purgeしない方針が確認済みである。
- Outsourcerは誤登録・重複・取引終了を含めてlive masterとして保持し、通常productにarchive／restore／物理deleteを設けない。generic adapterは正規経路として使用しない。
- admin-sdk backup/restoreはcompany subcollection snapshotの保守機能であり、modelの`_archive → active` restore APIとは別物である。collection catalogには一部archive collectionを含むが`Articles_archive`は含まれていない。
- archive専用maintenance command、一覧、restore conflict解決、期限purge、匿名化は確認できない。

## 旧調査時点のRules・security・retention

- Articles/Sites/Employees/Outsourcersのactiveとarchiveは、同一company claimの認証Userまたはsuper-userへread/writeを包括許可する。Customerはactive create/updateを専用actor・fieldへ限定し、active deleteとarchive CUDを拒否済みだが、archive read拒否と専用archive operationは未実装である。
- operation別role、archive create/update/delete、activeとの同時移動、field immutability、actor/reason、restore/purgeをRulesで分けない。
- 任意の同社認証Userがarchiveを直接改変・削除し、activeへ別writeで復元相当操作を行える。transactionと参照guardは強制されない。
- archiveには個人情報・取引・住所等の元document全fieldが残る。retention、匿名化、legal hold、purge、audit/access logは未定義である。
- archive active移動はactive側delete/create triggerを発火し得る。確認範囲ではEmployee active delete triggerがUser cleanupを開始し、Customerはupdate triggerのみでrestore create時の同期はない。全trigger影響は対象別に検証が必要である。

## 矛盾・未使用候補

- 独立`LogicalDeleteMixin`は存在せず、名称上想定されるaudit/state機能もなく、単純なcollection間copy/deleteである。
- server `hasChild`の`item.collection`は現schemaの`collectionPath`契約と不一致である。
- server restoreはtransaction外read、両restoreはactive同ID上書きを許す。
- restore APIが全FireModelへ公開される一方、`logicalDelete`確認をせず呼べ、代表UIからは未到達である。
- UIの「復元不能」説明と共通restore APIが矛盾する。
- admin-sdk collection catalogはCustomers/Sites/Employees/Outsourcers archiveを含むがArticles archiveを含まない。
- archive metadata、保持、restore/purge authorization、subcollection処理がない。

## 将来要対応

- FUT-0144: server adapterのhasMany field契約をclient/schemaと一致させる。
- FUT-0145: restoreのactive conflict、transaction、validation、triggerを安全化する。
- FUT-0146: archive audit metadata・retention・purge・Rulesを共通設計する。
- master固有の参照guard・終了/退職・snapshot問題はFUT-0057、0063、0078、0087、0123等を参照し、重複登録しない。
- Customer固有のFUT-0057は[ADR 0046](../decisions/0046-customer-archive-reference-barrier.md)と[専用roadmap](../roadmaps/customer-archive-safety.md)で設計済み。共通adapter修正、他master、retention/purgeは未解決のまま分離する。

## 要確認事項

- CONF-0121: active同ID存在時のrestore conflict policy。
- CONF-0122: archive/restoreで発火させるtriggerと副作用契約。
- CONF-0123: 共通archive metadata・保持・匿名化・purge運用。
- master別の終了/退職/archive判断はCONF-0049、0064、0100等を参照する。SiteのCONF-0049はADR 0051、OutsourcerのCONF-0072はADR 0050で回答済みである。

## 未確認範囲

- 実Firestore/Emulator、実archive件数、既存active/archive同ID、orphan subcollection、runtime transaction retry。
- air-vuetify manager内部の全dialog、全schemaのhasMany、全Functions trigger、全Admin SDK backup/restore本文。
- 法令上の保持期間、正式restore担当、事故対応・監査・匿名化運用。
