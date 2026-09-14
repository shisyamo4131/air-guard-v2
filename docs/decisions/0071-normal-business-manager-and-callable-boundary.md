# ADR 0071: 通常業務CRUDのDomain ManagerとCallable境界

- 日付: 2026-09-13
- 状態: Accepted
- 一部置換: transaction dataの物理削除に関する判断を[ADR 0072](0072-transaction-delete-client-trigger-boundary.md)で置換する
- 対象: Firestore上の通常業務dataを扱うCRUD、Domain Manager、Callable、Firestore Rules。master dataとtransaction dataを含む
- 関連仕様: [Pageとcomponentの構成](../specification.md#pageとcomponentの構成)、[テナントと認証](../specification.md#テナントと認証)、[Firestoreドキュメントの同時更新](../specification.md#firestoreドキュメントの同時更新)
- 適用計画: [根本ガバナンス整合phase](../roadmaps/foundational-governance-alignment.md)
- 既存判断との関係: [ADR 0065](0065-tenant-trust-normal-business-authorization.md)の通常業務認可とclient／Callable境界を具体化し、[ADR 0069](0069-domain-manager-editable-state-ownership.md)のDomain Manager適用範囲を通常のmaster dataから通常業務data全般へ拡張する。0069のeditable state所有、Manager非入れ子、入力契約は維持する

## 2026-09-15改訂：業務CRUDと後続処理の分担

利用者は質疑応答で、マスターの業務状態変更、確定後を含む請求の編集・削除、予定からの実績化、配置通知の作成・状態変更をManagerとSchemasクラスの標準処理へ統一すると決定した。認証account変更部分は厳密な専用処理へ分離し、Notifications生成・FCM送信・結果記録と、実績から請求・勤怠等への反映は既存Functionsトリガーが担う。詳細の正本は[標準CRUDと後続処理](../specification.md#標準crudと後続処理)と[ロックの画面別操作](../specification.md#稼働実績ロックと画面別操作)とする。

理由は、業務上の操作条件とserver実装の必要性を混同して、既存クラスにある処理を専用Callableへ重複実装する手戻りを止めるため。ロックは稼働実績管理からの編集・削除を制限する画面上の仕組みであり、経理側の編集やdocument全体を凍結する認可条件ではない。UI経由をサポート範囲とし、CRUDは認証・tenant共通境界を使う。

本改訂は下記の分類待ちのうち回答済み操作、および旧ADRの請求確定・業務状態変更・実績化を理由とする専用保存条件を置換する。archiveはADR 0060改訂を参照する。認証account操作の認可、入力・計算のクラス責務、外部送信、未提供操作の一律追加禁止は維持する。請求確定後の訂正に新revisionを必須とする判断も置換し、snapshot自体の用途は維持する。

今回は文書反映のみで製品code・Rules・data・deployを変更しない。未移行箇所は[棚卸し](../implementation/operation-crud-simplification-inventory.md)、実装・受入れは[FGAロードマップ](../roadmaps/foundational-governance-alignment.md)で管理する。後続実装ではクラスの提供機能、全caller、旧専用経路、Rules、Auth連携、Triggerとの接続と保存形式の互換性を照合し、画面別lock操作、確定後請求編集・削除、実績化、通知生成、請求・勤怠反映と失敗を検証する。文書反映だけでmigrationを実行せず、実装rollbackは対象client・Rules・Functionsの整合した単位で定める。今回の文書は所有差分だけを戻せる。

以下は2026-09-13の判断記録。本改訂で置換した専用条件・分類待ちを現行要件として再適用しない。

## 背景

AirGuardV2では、通常のmaster CRUDへrole・permission検査、専用Callable、field別writer、競合拒否、詳細なRules検査が重なり、client policy、Functions、Rules、testが同じ条件を重複していた。FGA-02からFGA-05では、Customer、Site、Employee、OutsourcerをDomain Manager、FireModel／ClientAdapterの標準保存、tenant共通Rulesへ段階的に戻した。

一方、予定・実績・請求等のtransaction系では、複数種類の通常CRUDと例外operationを一つの`saveOperation` Callableと専用Operation Managerへ集約した状態が残る。FGA-06の最初の2 checkpointは通常操作のrole制限を緩和したが、Callable、専用editor、最新値比較、Rulesのclient write全面拒否を維持したため、根本目的であるCRUD経路の簡素化は未完である。

## 決定

### Domain Managerの適用範囲

- `AirItemManager`を包む単数Domain Managerと`AirArrayManager`を包む複数形Domain Managerの原則を、Firestore上の通常のmaster dataだけでなく、予定・実績・請求等の通常業務dataにも適用する。
- 単一documentまたはその場で生成する新規instanceの編集は単数Domain Manager、collection・listの配列と行選択dispatchは複数形Domain Managerを共通入口とする。transactionであることだけをManager不使用の理由にしない。
- 現行のDomain Manager、`AirItemManager`、`AirArrayManager`、FireModel/Class schema、ClientAdapterで満たせる責務を再利用し、同じdialog、mode、validation、submit、error・loading、CRUD dispatchを専用composableや専用Managerへ複製しない。
- Managerが提供するC/U/Dは画面の提供操作に限る。Managerのmethodやbase機能が存在することから、未提供操作や未確定の権限を追加しない。

### CallableとRules

- 通常の可逆なCRUDは、Domain ManagerからFireModel／ClientAdapterの標準client保存へ接続することを既定候補とする。既存Callableを利用している事実、transaction dataであること、server実装が既に存在することだけではCallable維持の根拠にしない。
- Authentication、Company、User、role・permission・tenant所属、機微・機密情報、archive・復旧・物理削除、Stripe等を確認済み例外operationとした判断のうち、transaction dataの物理削除は[ADR 0072](0072-transaction-delete-client-trigger-boundary.md)でclient削除・Trigger連携へ置換する。マスタdataのarchive・復旧・物理削除と、その他の例外operationは必要な専用UI、Callable、server認可、競合・監査境界を維持する。
- 複数documentのatomicity、server-only値、外部作用、冪等性、再開・reconcile、順序依存状態遷移等によりCallableを維持する場合は、operationごとに具体的な被害、client transaction／batch／triggerでは満たせない理由、最小のserver所有範囲、test、rollbackを示して利用者確認を得る。技術要件のない通常CRUDを同じCallableへ同居させない。
- 通常業務Rulesは、確認済みのactor・tenant境界、actor UID偽装防止、マスタdataのclient物理delete拒否等の最低限へ寄せる。transaction dataで提供する物理削除は[ADR 0072](0072-transaction-delete-client-trigger-boundary.md)のclient deleteとTrigger連携を優先する。Schema・型・長さ・業務状態の検査をFireModel/Class schemaと正規application保存境界へ集約する現在の受容riskはADR 0065を正とし、例外operationへ拡張しない。

### 未決仕様の扱い

- 稼働実績詳細の稼働外売上は、追加・編集・削除できる現行画面を維持する。どのrole・permissionを操作へ影響させるかは未決であり、本決定からtenant共通化、権限追加、権限撤去のいずれも導出しない。
- 稼働外売上、請求lock、予定から実績への確定、配置通知等は、通常CRUDか例外operationか、または技術要件を持つ通常operationかを各FGA-06 checkpointで個別に確定する。

## 理由

MasterとtransactionでUI・保存基盤を分断せず、同じeditable state所有原則と標準CRUDを使うことで、専用Manager、専用Callable、client policy、server policy、Rules、testの重複を減らせる。例外operationと技術的にserverを必要とする最小部分だけを分離すると、通常CRUDの理解と変更範囲を小さくしながら、不可逆操作や外部作用の安全境界を維持できる。

## 代替案

- Transaction系を一律にCallableへ残す案: operationごとの必要性を確認せず通常CRUDも複雑な経路へ固定するため採用しない。
- 全`saveOperation`操作を一括してclient化する案: 通知、確定、複数document整合等の例外・技術要件を未確認のまま失うため採用しない。transaction dataの物理削除は後続のADR 0072によりclient化を確定した。
- Air Managerをmasterだけへ限定する案: transaction系に残る専用editorとCRUD dispatchの重複を解消できないため採用しない。

## 影響と互換性

- 本ADRは設計とFGA-06の移行方向を訂正する。製品code、Functions、Rules、schema、data、UIの提供操作、Dev・Prod状態はこの文書checkpointでは変更しない。
- 完了済みFGA-06の認可緩和とDev受入れは履歴として有効だが、Callable・Manager・Rules簡素化の完了証拠には読み替えない。
- 現行`saveOperation`、Operation専用Manager、OperationResults／SiteOperationSchedulesのclient write全面拒否は未解消の実装差である。
- 稼働実績詳細の稼働外売上は現行どおり操作可能であり、権限仕様は未決として残る。

## 移行

[FGA-06の棚卸し](../implementation/operation-crud-simplification-inventory.md)を起点に、操作ごとに通常CRUD、確認済み例外、技術要件候補、仕様未決を分類する。各実装checkpointでは全caller、Domain Manager再利用、FireModel保存、Rules、関連document・trigger、data互換、rollback、test、Dev受入れを確定し、一括置換しない。

## Rollback

本checkpointの文書変更は対象commitのGit revertで戻せる。後続製品checkpointはclient、Rules、Functionsの互換性を確認し、Rulesだけまたはclientだけを先に戻して利用不能・過剰許可を作らないrollback単位を個別に定める。data形状を変更しないcheckpointではdata rollbackを要求しない。

## 検証

- 仕様、ADR、FGAロードマップ、実装棚卸し、再開案内、索引、CHANGELOGの用語と適用範囲が一致することをproject document validatorで確認する。
- 後続checkpointでは、提供済み通常操作、未提供操作、未決権限、例外operationを区別し、Domain Manager／FireModel経路、Rulesの許可・拒否、tenant境界、物理delete拒否、Callableに残す技術要件を対象testで確認する。
- Rules変更時はactual targetのFirestore editionを再確認し、対象query、全caller、攻撃・失敗経路を含むRules reviewとEmulator検証を行う。

## 再検討条件

Air ManagerまたはClientAdapterがtransaction系の確認済みUI・保存契約を表現できない場合、client化により具体的な整合性・外部作用・再送被害が発生する場合、通常業務のtenant共通信頼を維持できない運用要件が確認された場合、または稼働外売上等の未決権限が確定した場合。
