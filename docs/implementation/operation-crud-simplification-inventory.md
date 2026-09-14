# Operation CRUD簡素化の現行棚卸し

- 確認日: 2026-09-14
- checkpoint: FGA-06-SCHEDULE-MANAGER-RESTORE-09
- 状態: 稼働実績の08以前はDev受入れ済み。現場稼働予定のAir Manager／model保存と単純なtenant Rulesへの復元・Firestore／HostingのDev反映後、上下番確定の左右画面が表示されない不具合を確認した。重複した`table`表示口を補正したcommit `12f05e5a`はHostingへDev再反映済み。配置管理・上下番確定の再受入れ待ち
- 対象: 現場稼働予定、稼働実績、稼働請求の画面、Manager、`saveOperation` Callable、Firestore Rules
- 正本: 要件は[現行仕様](../specification.md)、通常CRUD移行は[ADR 0071](../decisions/0071-normal-business-manager-and-callable-boundary.md)、archive・物理削除境界は[ADR 0072](../decisions/0072-transaction-delete-client-trigger-boundary.md)、進捗は[FGAロードマップ](../roadmaps/foundational-governance-alignment.md)

## 確認済み実装事実

1. 現場稼働予定の単数・複数Managerは09で`AirItemManager`／`AirArrayManager`へ戻し、`SiteOperationSchedule` modelの作成・更新・削除を使う。請求には`OperationManager`／`OperationArrayManager`と`saveOperation`が残る。
2. 予定の配置作業員は09で親`SiteOperationSchedule` modelの追加・変更・削除と`update()`へ戻した。実績詳細の作業員は07で通常client保存へ移行済みだが、稼働外売上は表示・操作・Callable経路を変更していない。
3. 過去実装では作業員配列を`WorkersManager`／`AirArrayManager`の`v-model`で編集し、submit完了時に親`OperationResult.update()`を実行していた。直近実装で追加された`useOperationResultWriter`とEmployee存在確認transactionはこの復元経路に不要であり、FGA-06-RESULT-CALLABLE-RESTORE-07で撤去した。
4. `functions/shared/operationWriteContract.js`が`create`、`duplicate`、`overview`、`workers`、`articles`、`order`、`delete`、`notify`、`convert`、`agreement`、`adjusted`、`lock`を一つのcommand契約へ集約する。
5. `functions/modules/operations/saveOperation.js`には予定commandとSite `scheduleRevision`処理が互換用に残るが、09の正規予定画面からは到達しない。予定から実績への確定と請求の取極め・調整・lockは引き続きserver入口を使う。
6. Firestore Rulesは`SiteOperationSchedules`と`ArrangementNotifications`を同一tenantの有効な本登録Userによる通常read/writeへ開き、Site revision、maintenance、live Site、通常field形状を重複検査しない。未認証、User不在、仮登録、無効User、claim不正、他tenantは拒否する。`OperationResults`の個別境界は08までの実装を維持する。
7. `saveOperation`の実績`create`・`overview`・`workers`・`delete`は正規画面から到達しない旧互換経路であり、入力契約で拒否する。予定の旧分岐は正規画面から外れた互換codeとして残す。実績複製、稼働外売上、請求、予定から実績への確定は変更せず、従来経路を維持する。

## 操作別の予備分類

この表は実装checkpointを選ぶための予備分類であり、client化またはCallable維持を確定しない。特に「技術要件候補」は、現行server処理の存在だけでなく、client transaction・batch・trigger等で満たせない理由を次の設計で確認する。

| 対象 | 現行action | 現行の主な処理 | 予備分類 | 後続で確認する点 |
|---|---|---|---|---|
| 予定 | `create`・`duplicate` | 予定作成、現場参照、表示順 | 09でAir Manager／model保存へLocal復元 | Dev画面受入れ、配置管理エラーの再現 |
| 予定 | `overview`・`workers`・`order` | 予定document更新、配置通知取消し | 09でAir Manager／model保存へLocal復元 | listener収束、配置管理エラーの再現 |
| 予定 | `delete` | 予定documentと関連通知の物理削除 | 09でmodelのclient削除へLocal復元 | 関連通知削除とDev画面受入れ |
| 予定 | `notify` | 配置通知document作成と予定側状態更新 | 09でmodelの既存`notify()`へLocal復元 | 外部通知、再送、配置管理エラーの再現 |
| 予定 | `convert` | 通知値を反映した実績作成、予定を実績化済みに更新 | 技術要件を持つ順序依存operation候補 | atomicity、再実行、通知snapshot、結果不明時の復旧 |
| 実績 | `create` | 実績作成、Site取極めsnapshot | 標準client保存へLocal移行済み | Dev反映、一覧作成・詳細遷移・Triggerの受入れ |
| 実績 | `duplicate` | 既存実績の複製 | 現状維持・後続判定 | 複製元snapshot、作業員参照、lock条件 |
| 実績 | `overview`・`workers` | 実績document内の基本情報・作業員更新 | 最初の通常CRUD簡素化候補 | 単数／複数Manager、document LWW、参照検査、downstream trigger、Rules |
| 実績 | `articles` | 実績document内の稼働外売上行更新 | 現状維持・権限仕様未決 | 現行操作を維持し、権限の追加・撤去をこのphaseから推論しない |
| 実績 | `delete` | 実績documentの物理削除 | client物理削除・Trigger連携 | 実績原本をclient削除へ移し、勤怠・請求・履歴・予定・日報等の削除event chainをTriggerに維持する |
| 請求 | `overview`・`articles`・`adjusted` | OperationResults内の請求情報・稼働外売上・手動調整更新 | 現状維持・業務境界確認待ち | 上流menu制御、提供操作、確定後編集、通常CRUDへ分類できる範囲 |
| 請求 | `agreement` | Site取極め選択と請求snapshot再計算 | 技術要件または通常CRUDの確認候補 | snapshot、再計算、最新Site参照をどこが所有するか |
| 請求 | `lock` | 請求対象実績のlock切替 | 状態遷移の確認候補 | lockの意味、解除、他編集との競合、actor仕様 |

## 現時点の不整合

- FGA-06の初期checkpointはrole依存を緩和したが、専用Operation Manager、Callable、期待値競合、client write全面拒否を維持した。認可緩和の完了記録は有効だが、CRUD簡素化の完了とは扱わない。通常CRUDから過剰Callable接続と連動Rulesを戻すことを後続checkpointより優先する。
- ADR 0069と仕様は当初Air Managerを通常masterへ限定していた。ADR 0071と仕様訂正により通常業務data全般へ適用範囲を広げるが、製品codeは未移行である。
- `saveOperation`は互換用の予定分岐、実績化、請求状態遷移を同じAPIへ残している。09で正規予定callerをmodelへ戻したが、旧予定分岐と専用補助codeの削除は後続整理であり、実績化は現在の上下番確定エラーを再現してから扱う。

## FGA-06-RESULT-MANAGER-CLIENT-04 実装・Dev受入れ結果

lockされていない既存実績の`overview`・`workers`だけを対象に実装した。稼働外売上、実績作成・複製・物理削除、予定、通知、実績化、請求は対象外である。

- listener由来`OperationResult`を単数`OperationResultManager`／`AirItemManager`へ渡し、基本情報をdocument単位last-write-winsで保存する。
- 作業員配列は`OperationResultWorkersManager`／`AirArrayManager`を再利用し、編集後の親`OperationResult`全体を保存する。新たに追加されたEmployeeだけはclient transaction内で存在を確認する。
- Rulesはtenant、active registered User、actor UID、document ID、既存非lock状態、Site・Customer参照を境界とする。未決または専用操作のfieldは同時に開かない。
- 旧画面のカード枠、toolbar、ボタン文言、入力component、760px dialog、lock表示、稼働外売上一覧、物理削除dialogを維持する。固定製品commit `40316475`のsource contract、全domain、Local Emulator、専用UI buildに加え、release commit `138b3a29`のHosting Dev反映と会社管理者・統括によるブラウザ受入れを完了した。[Local検証記録](../verification/fga-06-result-manager-client-local.md)と[Dev受入れ記録](../verification/fga-06-result-manager-client-dev.md)を参照する。

checkpointはDev受入れまで完了した。旧Callableの`overview`・`workers` rollback分岐と、transaction `delete`分岐の撤去は後続の変更単位とする。

## FGA-06-RESULT-DELETE-CLIENT-06 Local実装結果

固定製品commit `07511fb3`で、稼働実績詳細の既存削除dialogを`OperationResultManager`へ接続し、`OperationResult.delete()`の標準client経路へ移した。

- 削除ボタン、確認dialog、文言、詳細画面の配置を維持し、削除時の保存処理だけを差し替えた。
- Rulesは同一tenantの有効な本登録User、document ID一致、既存の非lock状態を要求する。create、locked result、仮登録・無効User、他tenantは拒否する。
- `saveOperation`は実績`delete` commandを入力段階で拒否し、予定deleteは未移行のため維持する。
- 既存のOperationResult削除Triggerが請求、日次勤怠、勤務回数実績、現場従業員履歴を同期し、既存cleanupが予定・日報を扱う構成は変更していない。
- 従業員10名を含む実績のclient削除をLocal Emulatorで確認し、勤務者行を空にしないと汎用errorになる旧経路の症状は新経路では発生しなかった。旧Callable内での個別原因の切り分けは行っていない。
- 全domain 1454件、Local Emulator 180件、固定commitの専用UI buildを完了した。[Local検証記録](../verification/fga-06-result-delete-client-local.md)を参照する。

checkpointは後続07と同じDev release・受入れで完了した。schema変更、data migration、既存data一括変更、Prod変更はない。

## FGA-06-RESULT-CALLABLE-RESTORE-07 実装・Dev受入れ結果

- `OperationResultManager`は専用composableを介さず、draftの標準`update()`／`delete()`を直接使用する。listener由来instance、document単位last-write-wins、非lock条件を維持し、再読込handlerを追加しない。
- 作業員配列は過去実装どおり`WorkersManager`／`AirArrayManager`の`v-model`で編集し、submit完了時に親`OperationResult.update()`で保存する。Employee存在確認transactionを設けない。
- `saveOperation`は実績`overview`／`workers`／`delete`を入力段階で拒否する。実績作成・複製、稼働外売上、請求、予定、通知、実績化は対象外である。
- Rulesは実績updateのSite／Customer存在確認を撤去し、tenant・actor UID・document ID・非lockと、未決または専用operation所有fieldの変更拒否を維持する。
- UIの文言、カード、toolbar、追加・編集・削除button、入力、760px dialog、稼働外売上一覧、削除dialogを変更しない。data shape、migration、既存data一括変更、Prod変更はない。

初回Dev受入れで、作業員追加dialogが親実績の勤務初期値を継承しない差を確認した。過去repositoryでは親OperationResultの値をworkerへ渡していたため、現行`WorkersManager`が既に公開している日付・現場・勤務区分・開始・終了・翌日開始・規定実働・休憩のdefault propsを詳細画面から渡す補正をcommit `8d90d5d1`で行った。UI構造は変更していない。

補正後の会社管理者sessionで、基本情報表示、作業員追加時の勤務初期値継承、OJT更新・再読込、作業員削除・再読込、実績物理削除、一覧0件、既存画面の見た目を確認した。各操作に対応するDev Trigger event後にerrorは記録されていない。`FGA-06-RESULT-DELETE-CLIENT-06`と本checkpointはDev受入れまで完了した。[Dev受入れ記録](../verification/fga-06-result-callable-restore-dev.md)を参照する。

## FGA-06-RESULT-CREATE-CLIENT-08 Local実装結果

- 一覧用の複数形`OperationResultsManager`を`AirArrayManager`へ戻し、`OperationResult.create()`と既存の作成前Site補完へ接続した。
- 760px dialog、既存入力、`キャンセル`／`保存`、一覧toolbar、作成後の詳細遷移を維持する。
- `saveOperation`の実績create入力を拒否し、通常createを同一tenantの有効な本登録Userへrole非依存で開いた。作成時のlive Site／Customer、actor UID、document ID、空の作業員・稼働外売上・調整値、非lock、非予定紐付けをRulesで守る。
- Site archiveとの前後・同時実行をEmulatorで検証し、archive済みSiteに新規実績参照を残さない。
- 実績複製、稼働外売上、請求、lock、予定、通知、実績化、schema、migration、既存data一括変更、Dev・Prodは変更しない。[Local検証記録](../verification/fga-06-result-create-client-local.md)を参照する。

## FGA-06-SCHEDULE-MANAGER-RESTORE-09 Local実装結果

- 単数・複数の予定Managerを`AirItemManager`／`AirArrayManager`へ戻し、予定の作成・更新・削除・並べ替えを`SiteOperationSchedule` modelへ接続した。
- 配置作業員の追加・変更・削除、予定の複製、配置画面からの通常保存と通知をmodelの既存処理へ戻した。正規callerから専用operation editor、optimistic publish、`saveOperation`への接続を外した。
- Rulesは予定と配置通知をtenant共通の通常read/writeへ簡素化し、Site revision、maintenance、live Site、field形状、実績化済み状態の重複検査を撤去した。identityとtenant境界、nested pathの既定拒否は維持する。
- 予定から実績への確定、請求、実績複製、稼働外売上、schema package、data shape、migration、Dev・Prodは変更しない。
- Dev受入れで、上下番確定の左一覧と右詳細・日報写真が表示されず、外枠のManagerだけが表示される不具合を確認した。原因は予定Managerの明示的な`table`表示口と汎用転送の同名表示口の重複であり、汎用転送から`table`を除外するLocal補正と回帰testを追加した。
- 対象test 36/36件、全domain 1,434/1,434件、buildはexit status 0。補正版commit `12f05e5a`をGitHub ActionsでHostingへDev再反映した。配置管理・上下番確定処理そのものの再受入れは未実施であり、エラー解消済みとは扱わない。

## 未確認事項

- Prod、migration、既存data全件、remote派生document全件は確認していない。Devでは作業員を持つ合成実績について作業員CRUDと実績物理削除を確認し、Triggerログにerrorがないことを確認したが、派生document全件は直接列挙していない。
- 最終Local検証は全domain 1446/1446件、Local Emulator 179/179件、固定製品commitの専用UI buildを終了コード0で確認した。[Local検証記録](../verification/fga-06-result-callable-restore-local.md)を参照する。
