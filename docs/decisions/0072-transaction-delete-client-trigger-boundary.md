# ADR 0072: マスタとtransactionのarchive・物理削除境界

- 日付: 2026-09-14
- 状態: Accepted
- 対象: Firestore上のマスタdataとtransaction dataのarchive・物理削除、Domain Manager、Callable、Firestore Rules、Trigger
- 関連仕様: [Pageとcomponentの構成](../specification.md#pageとcomponentの構成)、[表示dataと従属参照](../specification.md#表示dataと従属参照)、[テナントと認証](../specification.md#テナントと認証)
- 適用計画: [根本ガバナンス整合phase](../roadmaps/foundational-governance-alignment.md)
- 置換範囲: [ADR 0071](0071-normal-business-manager-and-callable-boundary.md)と[ADR 0069](0069-domain-manager-editable-state-ownership.md)の物理削除全般をCallable例外とした部分、[ADR 0065](0065-tenant-trust-normal-business-authorization.md)のclient物理delete一律拒否、[ADR 0067](0067-component-fetch-and-dependent-reference-boundary.md)の物理削除前の従属検査を、マスタdataとtransaction dataに分けて置換する

## 背景

ADR 0071は通常業務CRUDをDomain Managerと標準client保存へ戻す一方、archive・復旧・物理削除を一括してCallable例外に分類した。ところが、AirGuardV2のtransaction dataは削除後の請求・勤怠・履歴・通知・Storage等との連携をFirestore Triggerで処理する構成を採っており、関連処理を同期完了させることをtransaction削除Callableの要件としていない。マスタの誤登録・重複を扱うarchiveと、業務transactionの取消・削除は同じ保持・参照・復旧契約ではないため、境界を分ける。

## 決定

- マスタdataのarchive・復旧・物理削除は通常CRUDから分離し、対象を固定したCallable、server認可、従属検査、監査、再送・競合制御を維持する。製品がarchiveまたは物理削除を提供しないマスタへ、この決定だけで操作を追加しない。
- transaction dataにはarchive処理を設けない。削除済みtransactionをarchive collectionへ移動せず、既存transaction archiveの存在を前提にしたreader、restore、保持、purgeを追加しない。
- 製品が提供するtransaction documentの物理削除はCallableを使用せず、対応するDomain Manager／FireModel／ClientAdapterからFirestore client deleteを実行する。Firestore Rulesは通常のactor・tenant境界、対象document ID、必要な編集可能状態を検査し、マスタ向けのclient delete一律拒否をtransaction pathへ流用しない。
- transaction document削除後の関連document・集計・履歴・通知・Storage等の削除、更新、再計算はFirestore Triggerが所有する。clientの削除成功は原本documentのdelete commitだけを意味し、Triggerの完了や関連dataの即時整合を保証しない。
- Triggerの失敗、再試行、冪等性、順序、監視、reconcileは各関連処理の固有契約とする。これらを同期Callableへ戻す理由にせず、問題がある場合はTrigger側を修正する。
- 既存のtransaction削除Callable、専用command、client delete拒否Rulesは、対象operationごとにcaller、表示、lock、Trigger、失敗経路、互換性、rollback、test、Dev受入れを確認して段階的に撤去する。本ADRの採用だけで製品code、Rules、Functions、dataを変更しない。

## 理由

マスタarchiveは通常候補から原本を除外しながら同一性、参照、監査、復旧可能性を管理する操作であり、通常CRUDより強いserver境界を必要とする。一方、transactionの削除はarchiveを伴わず、原本削除後の関連処理をTriggerへ集約できる。削除だけをCallableへ残すとDomain Manager、Callable、Rules、testへ経路と認可が重複するため、transaction削除をclient経路へ統一する。

## 代替案

- 物理削除を一律Callableへ残す案: マスタarchiveとtransaction削除の契約差を失い、Triggerで満たす関連連携のために不要なCallableを維持するため採用しない。
- transaction削除時に関連dataをclientから直接更新する案: clientへ関連collectionの処理順と再試行責務を分散するため採用しない。
- transaction archiveを新設する案: 現在提供していない保持・閲覧・復旧operationを追加し、利用者要件にもないため採用しない。

## 影響・互換性・移行

現行の`saveOperation`は予定・実績の`delete`をCallableで処理し、Firestore Rulesは該当transaction pathのclient deleteを拒否しているため、新しい原則との既知の実装差になる。FGA-06の後続checkpointで、先にclient・Rules・Trigger・自動検証を同じrelease単位へ揃え、固定commitをDevで受け入れる。data shapeと既存documentの変換は不要で、既存Triggerの入力eventと関連data結果を維持する。

## Rollback

文書変更は対象commitをrevertできる。後続実装はclient delete、Rules、旧Callable callerの撤去を一つのrollback単位とし、clientだけまたはRulesだけを戻して削除不能・過剰許可を作らない。transaction documentとTrigger処理済みdataはcode rollbackで復元されないため、Dev受入れには専用合成dataを使用する。

## 検証

- 文書変更では、project governance、仕様、ADR索引、FGAロードマップ、実装棚卸し、再開案内、CHANGELOGの用語と適用範囲をcomprehensive governance gateで照合する。
- 後続実装では、正規UIからのtransaction削除、再読込後の原本不存在、別tenant・無効User・lock等の拒否、マスタclient delete拒否の維持、Triggerによる関連data連携、Trigger失敗・再試行・冪等性、旧Callable caller不存在を検証する。

## 再検討条件

transaction dataにarchive・restoreが必要となった場合、Triggerでは表現できない同期的な外部作用が利用者要件として追加された場合、またはclient deleteでは成立しない具体的な認可・整合性要件が確認された場合。再検討時も現行Callableの存在だけを維持理由にしない。
