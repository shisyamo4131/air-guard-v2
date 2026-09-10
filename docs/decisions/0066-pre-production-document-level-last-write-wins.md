# ADR 0066: Prod公開前のdocument単位last-write-wins

- 日付: 2026-09-09
- 状態: Accepted
- 対象: Firestore同時更新、通常CRUD、AirItemManager、AirArrayManager、listener収束
- 関連仕様: [Firestoreドキュメントの同時更新](../specification.md#firestoreドキュメントの同時更新)
- 適用計画: [根本ガバナンス整合phase](../roadmaps/foundational-governance-alignment.md)
- 一部置換: ADR 0031・0053・0058、および現行仕様にある通常更新のfield限定保存、同一field競合拒否、再読込必須、Manager原則排除。Company、Userおよび例外operationの固有競合制御は置換しない。

## 背景

現行仕様と実装は、通常CRUDにも独立draft、変更fieldだけの部分保存、同一fieldの外部変更検知、保存拒否、再読込、operation固有writerを広く導入し、`AirItemManager`と`AirArrayManager`を改修対象から外す方向へ進めてきた。この境界はfield単位の競合回避には有効だが、Prod公開前のDev試用に対してapplication、Rules、Functions、testと関連packageの改修範囲を大きくしている。

利用者は、Dev試用期間では単純なdocument単位のlast-write-winsを採用し、AirVuetify3のmanagerを積極利用する方針を示した。一方、Prod公開後にはtop-level field単位のlast-write-winsへ変更する可能性を残し、金銭・不可逆操作・順序依存操作を通常更新と同じ競合規則へ含めない。

repository内のAirVuetify3 sourceでは、`useItemManager`が編集後の`internalItem`全体を`handleUpdate`へ渡し、`useArrayManager`も更新item全体を`handleUpdate`または配列modelへ渡すことを確認した。ただし、実際にFirestore document全体を置換するかは各caller・adapter・Callableのwriter実装で決まるため、manager名だけで永続化方式を推定しない。

## 決定

### Dev試用期間の確定規則

- Prod公開前の通常の可逆なFirestore更新はdocument単位のlast-write-winsとする。
- 同じdocumentへの複数operationは、利用者が操作した時刻またはclient clockではなく、Firestoreへのcommitが後に成立したoperationの整合済みdocument全体を正とする。
- 異なるtop-level fieldだけを編集した同時更新も自動mergeしない。後commitのdocument全体に含まれる値で置換する。
- arrayとmapを含む全top-level fieldはdocument全体の一部として扱う。
- 変更可能な主対象documentは編集中もFirestore listener由来instanceをManagerの`modelValue`へ直接接続する。listener更新を受信した場合は編集中のdraftを最新document全体で置き換えることを許容し、編集中だけ固定するsnapshot、入力消失の警告、競合通知、保存拒否、再読込、明示再確認を設けない。更新後もlistenerから受信した最新documentを画面上の正本とする。
- `AirItemManager`と`AirArrayManager`はdocument全体を扱う通常CRUDへ積極的に使用できる。ただしmanager利用を認証・認可・tenant・Rules・server validationの代替にせず、例外operationへ強制しない。
- document全体はFireModel/Class schemaと必要なoperation条件を満たすものとする。`updatedAt`・`updatedBy`等のserver管理fieldと必要な派生fieldは正規の保存境界で確定し、client値を無条件に信頼しない。

### 例外

Stripe、請求確定、archive・復旧・物理削除、順序が重要な状態遷移には通常のdocument単位last-write-winsを適用しない。operationごとのtransaction、expected valueまたはprecondition、idempotency、再試行・照合、監査を維持または別途定める。

Company documentとUser documentは認証・tenant管理の基点であるため、通常更新を含めdocument全体を本ADRの既定から除外する。現在のfield別writer、actor条件、validation、競合制御を、利用者が別途変更するまで維持する。Authentication・role・permission・tenant所属、機微・機密情報、通知等に既存の固有競合制御がある場合も、本ADRだけで撤去しない。通常更新か例外かが曖昧なoperationは、対象機能checkpointで分類してからwriterを変更する。

### Prod公開後の未確定案

top-level field単位のlast-write-winsはProposed future optionであり、現行要件ではない。Prod公開は再検討条件であって自動cutover条件ではなく、別の仕様変更、互換性確認、実装、検証、release承認がない限りdocument単位の規則を継続する。

将来採用する場合は次を一つの契約として扱う。

- editorとwriterは利用者が変更したtop-level fieldだけを送信し、server管理fieldと必要な派生fieldを除いて未変更fieldを保存対象に含めない。
- 異なるtop-level fieldへのcommitは併存する。同じfieldへのcommitは後commitのfield全体を正とする。
- arrayとmapは内容全体を一つのtop-level fieldとして扱い、異なる要素またはkeyの変更もmergeしない。
- document単位writerとの併存期間、旧client、offline write、Rules、listener metadata、rollbackを確認してから切り替える。

## 理由

Dev試用段階では同時更新の完全な保持より、既存managerと単純なlistener収束を活用して改修・検証・Dev反映のloopを小さくする価値を優先する。例外を分離することで、通常CRUDの簡素化を金銭確定、不可逆操作、順序依存状態、identity・権限管理の破壊へ広げない。

## 代替案

- top-level field単位へ直ちに統一する案: 現行manager、caller、adapter、Callable、Rules、testと関連packageへ広い同時変更が必要であり、Dev試用期間の簡素化目的に合わないため採用しない。
- 通常CRUDでも同一field競合をすべて拒否する案: listenerを正本とする単純なlast-write-winsを妨げ、再入力・専用editor・競合testの保守負担を維持するため採用しない。
- 例外を設けず全operationをdocument単位へ統一する案: 金銭確定、不可逆操作、順序依存状態、identity・権限管理の不変条件を失うため採用しない。

## 影響と互換性

- 現行のCustomer、Employee、Outsourcer、Site取極め等には、field限定writer、専用editor、同一field競合拒否、再読込要求、manager非依存があり、新ルールとの実装差になる。CompanyとUserの同様の実装は維持対象であり、実装差に数えない。
- document単位writerは、同時に別fieldを編集した先行commitを失わせる。加えてlistener更新は未保存の入力を含む編集中draftを最新document全体で置き換え得る。これらをProd公開前の既知trade-offとして受容するが、listener受信後も古いclient draftを正本化し続ける挙動や、保存失敗を成功扱いする挙動は許容しない。
- 機微・機密情報やserver-only fieldが通常documentへ同居する場合、通常actorへwhole-document writeを開放できない。ADR 0064の分割または例外writerを先に確立する。
- このADRの文書変更だけではapplication、AirVuetify3、Functions、Rules、schema、data、Dev・Prodを変更しない。

## 移行

[根本ガバナンス整合phase](../roadmaps/foundational-governance-alignment.md)でCustomer、Site、Employee、Outsourcer、その他transaction系の順に進める。各checkpointで全reader/writer、document serialization、server管理・派生field、例外分類、Rules、listener、旧client、data互換、rollback、testを確認し、managerを使用するか、既存writerを一時維持するかを決める。通常更新の競合拒否を外す変更と例外operationの保護を同じ曖昧な一括変更へ含めない。CompanyとUserはこの移行対象へ追加しない。

## rollback

今回の文書変更は通常のGit revertで戻せる。製品checkpointはdocument単位writerによる保存が始まる前ならreview済みcode・Rulesのrevertを基本とする。新しいdocument形状またはdata変更を伴う場合はbackup、dry-run、post-check、forward correctionを含む別のrollbackを着手前に定める。既に失われた同時更新値をcode revertだけで復元できるとは扱わない。

## 検証

- governance、仕様、ADR、roadmap、future action、handoff、CHANGELOGの整合をcomprehensive governance gateで確認する。
- 各通常CRUD checkpointで、同じdocumentへの同時更新が後commitのdocument全体へ収束すること、listenerが編集中draftを最新document全体で置き換えること、競合だけを理由に警告・拒否・再読込要求しないことを確認する。
- schema、tenant、認証、server管理field、派生field、保存失敗と結果不明を確認する。
- 例外operationでは、transaction、precondition、idempotency、順序、不変条件と拒否時write 0を対象に応じて確認する。
- 将来field単位方式を採用する場合は、異field併存、同field後commit、array/map全体置換、旧document単位writerとの非互換を追加確認する。

## 再検討条件

Prod公開を計画するとき、Devでdocument単位上書きによる具体的な業務影響が確認されたとき、offline・複数client versionを提供するとき、または関連packageが変更top-level fieldを安定して識別・送信できる契約を備えたとき。
