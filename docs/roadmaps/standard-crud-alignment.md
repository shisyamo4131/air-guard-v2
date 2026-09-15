# 標準CRUD整合ロードマップ

- 状態: In progress
- 開始日: 2026-09-15
- 現在の進捗: 10%
- 目的: [棚卸し](../implementation/operation-crud-simplification-inventory.md#2026-09-15の実装棚卸し)で確認した専用保存経路・Rules・クラス契約の差を、一つずつ承認済み仕様へ揃える。
- 開始基準: local main `048e44e9cfd4ca887ec328e7e835c291579e68af`と、同基準で調査した2026-09-15の棚卸し。
- 作業branch: `codex/standard-crud-alignment`。本書の棚卸し解消を範囲とし、checkpointごとに差分・検証・Git統合を閉じる。
- 成果範囲: SCR-01を完了。入金予定日を標準Manager／Class保存へ移し、Rulesを整合して旧専用経路とremote Functionを撤去した。Local自動検証と画面確認、GitHub ActionsによるDev反映、会社管理者によるDev受入れまで完了した。package変更、data migration、既存documentの一括操作は行っていない。
- 要件の正本: [標準CRUDと後続処理](../specification.md#標準crudと後続処理)、[画面別lock](../specification.md#稼働実績ロックと画面別操作)、[archive・restore](../specification.md#ドキュメントのアーカイブと物理削除)。本書で新しい機能要件を追加しない。

## 既存計画との関係

本書は[FGAロードマップ](foundational-governance-alignment.md)のうち、2026-09-15の仕様回答に対応する棚卸し解消の実行計画である。この範囲の順序・状態・完了証拠は本書だけで更新する。FGAの過去完了checkpointは当時の証拠として保持し、新仕様の達成へ読み替えない。

SCRを優先して消化し、各項目の完了時にFGAの対応する完了条件と照合する。SCRの証拠で満たした範囲だけFGAを完了へ更新し、受入れ待ち等を一括で閉じない。SCR終了後にFGAの未完項目を再確認して対応する。

本書の進捗は今回の追加整合だけを測る。FGAおよび[製品全体](airguard-v2.md)の得点とは合算・平均しない。親phaseの加点・再評価は、その完了条件と証拠を満たした時に親の正本で行う。

既存の `FGA-06-SCHEDULE-MANAGER-RESTORE-09` の画面再受入れと `FGA-06-TRANSACTION-PARENT-INDEPENDENCE-10` のprojection・Dev復旧は、FGAの未完項目として保持する。本書のSCR-02・SCR-04・SCR-05で共有するcode・Rules・画面・Triggerの証拠は相互参照し、同じ修正や受入れを二重に計上しない。実data repairを通常CRUD改修へ混ぜない。

## 対象項目とマイルストーン

重みは各checkpointの完了を数えるための均等配点で、工数・riskの見積りではない。合計100、checkpoint内の部分加点なし。製品の実装・必要な検証・対象範囲のDev受入れが揃うまで0点とし、計画作成だけでは加点しない。

| マイルストーン | 重み | 得点 | 状態 | 完了条件・対象となる確認 |
|---|---:|---:|---|---|
| SCR-01 Billings入金予定日 | 10 | 10 | Completed | 提供済み編集をManager／Classへ接続し、Rulesと旧比較testを整合。保存・再表示・失敗、tenant境界を検証する |
| SCR-02 配置通知の状態更新・編集 | 10 | 0 | In Progress（Local完了・Dev待ち） | Managerと本人向け確認・上番・下番を標準クラスへ接続し、Schemas生成とのnotify parityを揃え、時刻・実勤務値・表示収束と既存通知生成条件をLocalで検証済み。Dev受入れは未実施 |
| SCR-03 Site手動終了・再開 | 10 | 0 | Planned | 終了・再開の既存業務条件と標準クラスを照合し、入口・保存・Rulesを整合。自動終了system処理と終了後の通常編集条件を維持する |
| SCR-04 予定から実績化 | 10 | 0 | Planned | Generatorを標準syncToOperationResultへ接続し、同ID実績作成・予定更新・通知実勤務値反映・作成Rulesを整合。旧convert callerを撤去し、既存実績作成を回帰確認する |
| SCR-05 稼働請求・実績lock・稼働外売上 | 10 | 0 | Planned | 取極め・調整・lock等を既存OperationBilling／OperationResultの標準保存へ接続し、共有Rulesを整合。画面別操作表、経理画面アクセス、稼働請求からの実績削除禁止、請求・勤怠等への後続反映を検証する |
| SCR-06 Customer archive・restore整合 | 10 | 0 | Planned | 既存archive入口をManager／Classへ接続し、従属あり拒否・なし移動、同ID標準restore、tenant境界、旧envelope互換性を確認。専用writerと対象Rulesを一体で整合し、通常CRUDを維持する |
| SCR-07 Site archive・restore整合 | 10 | 0 | Planned | Siteの従属hook、標準移動・復旧、旧形式を照合し、既存入口とRulesを整合。SCR-06の共通確認は有効な範囲だけ再利用する |
| SCR-08 請求確定・確定後CRUD | 10 | 0 | Planned | 未提供UI・issuer snapshot等の確認残を具体化し、合意した提供操作を標準CRUDで実装。確定後の直接編集・請求document削除と、元実績の非削除を検証する |
| SCR-09 Employee退職・訂正とAuth分離 | 10 | 0 | Planned | beforeUpdateの状態拒否とtoTerminated内のUser削除を含むClass契約を確認し、業務更新と厳密なUser/Auth処理を分離。退職・誤退職訂正、連携Userあり／なし、失敗時の状態を検証する |
| SCR-10 Employee archive・restore整合 | 10 | 0 | Planned | SCR-09の分離結果を前提に、従属あり拒否・標準移動復旧・Rulesを整合。archiveからUser/Auth・従属documentを連鎖削除しないことを確認する |

SCR番号は2026-09-15時点の改修優先順位に合わせて付番し直した。SCR-01から順に各項目の現状と影響を確認して進める。新しい依存や影響が判明した場合は、その理由を示して優先順位を見直す。SCR-04とSCR-05など共有Rulesを扱う変更は並列編集せず、前工程との依存を確認する。既存の大項目も、独立して受入れ可能なら操作単位へ分け、配点は親項目の合計を維持する。

## SCR-01 入金予定日編集の内訳

対象は顧客請求詳細で提供済みの「入金予定日を変更／未設定にする」。請求の新規作成・確定・削除、入金実績モデルの追加、User/Auth変更は含めない。各枝番は同じ改修の作業・確認単位であり、個別に製品へ公開できることを意味しない。親SCR-01の10点は全枝番の完了で加点し、途中の部分加点は行わない。

01-03着手前は[詳細画面](../../pages/billings/customers/[id].vue)が[useCustomerBilling](../../composables/dataLayers/useCustomerBilling.js)でBilling instanceを購読し、旧`PaymentDateEditor`が別の専用composableで読取り・編集・Callable保存を行っていた。現在の詳細画面はlistener由来Billingを単数Managerへ接続済みで、[Rules](../../firestore.rules)も既存Billingの標準updateを許可する。旧component、composable、共有contract、`updateBillingPaymentDate`のAPI・module・exportは01-05でLocal sourceから撤去し、remote Functionも01-07のDev releaseで撤去した。

| 枝番 | 作業 | 具体的な改修・確認内容 | 完了の判断 | 状態 |
|---|---|---|---|---|
| SCR-01-01 | 保存契約と影響範囲の確定 | Billingの標準update、日付の型・null・派生年月、請求日との前後条件、document全体の保存内容、請求集計等の背景writerを照合する。既存日付検証とクラスに差があれば、その扱いと必要な修正範囲を確定する | 対象file、維持条件、互換性、rollback、test範囲を確定。package変更やdata変換の要否を根拠付きで判断できる | Completed（調査・設計） |
| SCR-01-02 | 単数Managerと入力部品 | Billing instanceを受ける単数domain ManagerでAirItemManagerをラップする。入金予定日用customInputを設け、日付変更・未設定操作を構成する。既定editor・validation・submit・loading・errorを利用する | 独自dialogの責務をbase Managerへ移し、単一instance入力、UPDATE入口、入力・取消が仕様どおりに動く | Completed（部品・Local、利用者改修review済み） |
| SCR-01-03 | 標準保存と画面の接続 | 詳細画面が購読するBilling instanceをManagerへ渡し、保存handlerから標準updateへ委譲する。専用getDocFromServer、expected比較、保存後の強制再取得を通常経路から外し、listenerを表示正本とする | listener由来Billingが単数Managerへ渡り、日付変更・未設定が標準draft updateへ接続される。旧専用editorは正規pageから到達せず、接続と失敗伝播を直接testで確認する。実Firestore保存・再表示はRules整合後の01-06で確認する | Completed（画面接続・自動検証） |
| SCR-01-04 | Billings Rulesの整合 | client write全面拒否を見直し、今回の標準保存を認証・同一tenantの境界で成立させる。通常schema・日付業務条件をRulesへ複製しない。既存reader／背景writerとの境界を確認する | 同一tenantの正規保存が成功し、未認証・他tenantは拒否される。未提供の請求CRUD画面は追加されない | Completed（Rules・Local Emulator） |
| SCR-01-05 | 旧専用経路の撤去 | PaymentDateEditorの旧実装、専用composable、updateBillingPaymentDateのAPI/export・本体、期待値比較等を参照確認して整理する。共有helperは利用元が残るものを削除しない | 正規画面から旧Callableへの到達がなく、不要な専用保存・競合stateと参照が残らない。公開済みFunctionの撤去対象も特定する | Completed（Local source） |
| SCR-01-06 | 自動検証と独立レビュー | 設定・変更・nullへの解除、請求日との条件、日付の往復、標準保存内容、listener反映、取消・失敗、tenant境界、背景集計との併存を確認する。旧Callable前提のtestを新契約へ更新する | 影響classに応じた必須gateと独立reviewが完了。既存成功証拠の再利用と未検証範囲を明示する | Completed（Local検証） |
| SCR-01-07 | Dev受入れ・文書とFGA反映 | 固定commitの対象client／Rulesを整合して反映し、必要な旧Function撤去を承認済み範囲で実施する。詳細画面で変更・解除・再表示と既存表示の維持を受け入れ、失敗経路は自動testで確認して証拠と棚卸しを更新する | 対象範囲のDev受入れとGit closeoutが完了。SCR-01を完了とし、同じ証拠で満たしたFGAの範囲だけ反映する | Completed（Dev受入れ） |

標準保存は現在の3日付fieldのpatchからBilling全体の保存に変わる。01では`operationResults`、status、調整・備考、計算値・管理fieldの往復と、背景実績更新後も入金予定日が維持されるかを確認する。通常のdocument単位last-write-winsを前提とし、同時更新の完全保持を目的とする独自lock・期待値比較は追加しない。`paymentDueDate`・`paymentDueMonth`は標準クラスの派生値を利用する。

SCR-01-01で確認した契約を02〜05に適用する。02〜05は保存経路・Rules・旧経路を組み合わせた一つの変更として06で検証し、片側だけを先に公開しない。枝番ごとの調査・静的確認・直接対象testは進めるが、同じ回帰suiteを枝番ごとに重ねて実行しない。07の外部操作は既存のDev承認境界に従う。

現在の検証入口は`test/domain/billing-payment-date.test.mjs`、`test/domain/customer-billing-manager.test.mjs`、`test/local/codex-local-harness.test.mjs`。旧client/server contractの同値比較testは01-05で対象実装とともに撤去した。01の保存契約・互換性・rollback・検証範囲は[調査結果](../implementation/operation-crud-simplification-inventory.md#scr-01-01-保存契約の調査結果2026-09-15)を参照する。02の部品実装と検証は[部品工程の記録](../implementation/operation-crud-simplification-inventory.md#scr-01-02-単数managerと入力部品2026-09-15)、03の画面接続と直接testは[接続工程の記録](../implementation/operation-crud-simplification-inventory.md#scr-01-03-標準保存と画面の接続2026-09-15完了)、04のRules境界は[Rules工程の記録](../implementation/operation-crud-simplification-inventory.md#scr-01-04-billings-rulesの整合2026-09-15完了)、05の撤去範囲は[旧経路撤去の記録](../implementation/operation-crud-simplification-inventory.md#scr-01-05-旧専用経路の撤去2026-09-15完了)、06のLocal統合検証は[検証工程の記録](../implementation/operation-crud-simplification-inventory.md#scr-01-06-自動検証とlocal画面確認2026-09-15完了)を参照する。01-07のDev反映・旧Function撤去・会社管理者による画面受入れは[release記録](../verification/scr-01-billing-payment-date-dev.md)を参照する。backend停止時の画面確認は利用者判断により完了条件から外し、既存の自動test成功を失敗経路の証拠として採用した。これにより全枝番と親SCR-01を完了し、10点を加点する。

## 影響確認から次の1件を選ぶ

上記の優先順位を基準に、着手前に各項目について次を確認する。小さな変更で独立して完了できる操作から着手し、1件を閉じた時点で残件を再評価する。未確認を「影響なし」と扱わない。

1. 実際の画面入口がAir Managerへ接続しているか。名前がManagerでも独自dialog・controllerなら置換対象として数える。
2. 標準クラスの保存へつなぐだけか。入力条件・serialization・listener・error処理の調整、Manager置換、共有callerの変更も必要か。
3. Rules、保存形式、他document、後続Trigger、User/Authへの影響があるか。file数だけで影響の大小を決めない。
4. 最小変更範囲、維持する動作、必要な検証、未確認事項を提示し、独立して完了できるかを判断する。影響が広がれば候補を分割するか後へ回し、別の小さい候補を選ぶ。

### 初回比較（2026-09-15・静的確認）

下表は上記の改修優先順位を決めた静的確認の根拠であり、各項目の具体的な変更範囲は着手前に確定する。実装・runtime検証は未実施。「標準CRUDへの接続だけで完了」と確定できた項目は今回の比較ではない。

| 対象 | 必要な変更の種類 | 次を選ぶ際の判断 |
|---|---|---|
| SCR-01 入金予定日 | 独自editorのManager接続、標準保存、Billings Rules | 最初の詳細確認候補。提供入力と保存先が狭い。全体serialization、背景writerとの併存、日付検証を先に照合する |
| SCR-02 通知状態・編集 | 単数／本人向け独自dialogのManager接続、標準状態更新 | Rulesは既にtenant共通で変更不要候補。ただし通知生成・FCMへ波及するため、送信条件と共有editorへの影響を着手前に確認する |
| SCR-03 Site終了・再開 | 独自dialogのManager接続、状態保存、Rules | 終了・再開条件のClass一致が未確認。自動終了との共有範囲も確認する |
| SCR-04 実績化 | 既存Managerを再利用できる候補、Generator内の標準通知作成・実績化接続、Rules | Manager全体の置換を前提にしない。予定・通知・実績とprojectionに及ぶため、接続先メソッドがあっても小変更とは判定しない |
| SCR-05 稼働請求・lock・稼働外売上 | 専用Managerの置換、複数操作の標準保存、共有Rules | 画面別lockのクラス基盤を再利用。OperationResults共有画面への影響を確認し、独立して検証できる操作へ分割する |
| SCR-06・SCR-07 Customer／Site archive | Manager接続、標準移動復旧、Rules、旧保存形式の互換性 | データ形式の違いがあるため後段候補。既存形式への影響と復旧範囲を確認してから対象ごとに着手する |
| SCR-08 請求確定後CRUD | 未提供UIの具体化、既存Managerの保存handler、Rules | 既存Managerは利用可能だが未提供操作がある。単純な置換として扱わず、必要なUIとsnapshot条件を先に具体化する |
| SCR-09・SCR-10 Employee | 業務状態・archiveの標準保存と、Class／User／Authの責務分離 | 軽微なCRUD群と分けた後段工程。下記の設計・検証を終えるまで標準退職メソッドへ単純接続しない |

比較根拠は01-05で撤去した旧入金予定日editorのGit履歴、[通知Manager](../../components/ArrangementNotification/Manager/index.vue)、[本人向けManager](../../components/ArrangementNotifications/Manager/index.vue)、[Site終了入口](../../components/Site/Editor/Terminate.vue)、[実績Generator](../../components/OperationResult/Generator/index.vue)、[稼働請求Manager](../../components/OperationBilling/Manager/index.vue)と[棚卸しの一次根拠](../implementation/operation-crud-simplification-inventory.md#主な一次根拠)。

### Employeeの独立した設計・検証

確認した既存経路は、Employeeの標準toTerminated内のUser削除 → [User削除Trigger](../../functions/triggers/user.js) → [Authentication削除](../../functions/modules/auth/deleteUser.js) → [Auth削除Trigger](../../functions/triggers/auth.js)のFcmTokens整理である。業務documentの更新だけで完結しない。現在の認証専用経路と標準メソッド経由の保護条件が同等とは確認できていない。

SCR-09では接続変更の前に、業務状態だけを変更する範囲とUser/Authを変更する専用範囲、Class変更の要否を設計し、独立security reviewを行う。Employee単体、仮登録User、本登録User、管理者に紐付く場合を分け、次を検証する。

- 業務状態の更新・誤退職訂正だけでUser、Auth、claims、認証処理の予約・lockを意図せず変更しない。訂正で削除済みaccountを自動復元しない。
- 認証専用処理の対象identity・tenant照合を維持し、途中失敗、結果不明・再実行、予約解放、後続cleanupを確認する。document保存成功とAuth・cleanup完了を区別する。
- Employee側のRules整合からUserのclient write開放を導かない。SCR-10のarchiveもUser/Auth・従属documentを連鎖削除しないことを別に確認する。

既存の退職、認証gateway、lifecycle再照合testを利用し、実際に変更する経路と接続部分へ検証を追加する。必要な認証条件を削って通常CRUDへ寄せることを完了条件にしない。これらの成立と対象範囲のDev受入れが確認できるまでEmployee項目は未完了とする。

## 各工程で先に解消する確認残

- SCR-06・SCR-07・SCR-10: 標準restoreの基盤と製品UIの提供範囲を区別する。未提供UIを自動追加せず、必要な入口は当該checkpointで具体化する。旧archiveと新標準形式の互換性・対象dataへの影響を確認し、変換が必要なら対象・方法・復旧を確定してから実行する。標準restoreが旧envelopeをそのまま扱えるとは想定しない。
- SCR-03: 標準クラスの終了・再開条件が現行仕様と一致するか確認する。既存Callableがあること自体を例外維持の根拠にしない。
- SCR-09: 別packageの変更が必要か、業務状態と認証処理をどう分離するかを先に設計する。必要なpackage作業は対象repository・契約・公開／採用範囲を具体化し、本repositoryの承認だけで変更しない。
- SCR-05: 稼働外売上の現行提供操作を維持し、[確認事項台帳](../implementation/pending-confirmations.md)に残る権限判断を保存方式の変更から推論しない。共有Rulesに関わる未決が対象保存を妨げる場合は実装前にその一点を解消する。
- SCR-08: 標準CRUD方式は確定済み。未提供の確定UI、必要な表示・入力・snapshotの確認残だけを具体化する。[確認事項台帳](../implementation/pending-confirmations.md)の未決な入金dataモデルまで自動採用しない。

## 維持対象と範囲外

- Customer／Outsourcerの通常CRUD・取引状態、Site／Employeeの既に標準化した通常CRUDは再実装せず、変更が直接影響する範囲だけ回帰確認する。Outsourcerのarchive／restore UIは追加しない。
- 配置通知の標準作成、Notifications生成、FCM送信・結果記録、実績から請求・勤怠・履歴等への既存Triggerは維持する。確認する工程はSCR-02・SCR-04・SCR-05とし、送信条件・宛先・集計仕様の変更を追加しない。
- 実績複製等、棚卸しの過去記録にある未精査の残経路はSCR-04・SCR-05のcaller確認で現状を確かめる。独立した改修が必要と判明した場合は既存FGAへ残件として明示し、10件の終了だけで全transaction移行完了と宣言しない。
- マスタ削除機能の将来見直しは[archive仕様のFUT-0146案内](../specification.md#ドキュメントのアーカイブと物理削除)を維持する。retention・purge・汎用復旧UI・自動終了公開・実data repairを本書の標準CRUD整合へ追加しない。

## 実行・検証・完了証拠

各checkpointの着手時に[開発workflow](../runbooks/development-workflow.md#必要十分なdata設計)へ従い、実際の対象file、入口と全caller、維持条件、互換性、rollback、test・Dev受入れ範囲を固定する。既に確定した標準CRUD方式は再質問せず、未確定の提供範囲・依存契約だけを確認する。実装、独立review、選択した検証、固定commitの受入れ、Git統合を既存手順で閉じてから次へ進む。

検証の正本は[verification policy](../../governance/verification-policy.json)と[Verification Matrix](../operations.md#verification-matrix)。本書作成はproject-guidance-metadataで、project-docs・diff-checkを実行する。後続の製品改修は実際の変更classの和集合で選び、Rules・schemaを変える場合の必須gateやrelease gateを省略しない。既存成功証拠は同じ条件を覆い失効していない場合に再利用する。

代表操作は表の条件に加え、保存・再表示・失敗時のUI、認証と同一tenant、標準クラスの業務検証、影響するTrigger結果を確認する。archive確認直後の稀な競合を完全防止するためのbarrier追加は完了条件にしない。

code・Rulesを戻す必要が生じた場合は[Git統合](../runbooks/project-coordination.md#git統合)と対象の既存runbookに従う。保存形式や実dataが変わる工程ではcodeのrevertだけで戻せるとせず、当該checkpointの互換性・復旧確認に含める。

完了時は各行から実装差分と検証receiptへリンクし、command・exit・review findingと解消・未確認事項を確認可能にする。棚卸しには変更後の実装事実を反映する。SCR-01の製品検証証拠は実装記録とDev release記録へ保存した。

## 次の作業

SCR-02の製品codeとtest codeは準備済みで、得点は0のままとする。Schemas `3.0.0-dev.3`をroot/Functionsへ導入し、package identityとintegrityの`PostAdoption`は成功した。配置通知生成の`actualIsStartNextDay`はFunctionsのnotify生成分岐にも実勤務値を引き継ぐよう補正した。TESTERのLocal UI確認、ユーザー本人の遷移確認、domain-full 1433/1433、Local Emulator 180/180を含む対象検証は成功済みである。DEV read-only確認では配置通知2579件を取得し、翌日開始1件と関連予定・勤務実績の整合を確認したため、migration/repairは不要と判断した。詳細は[SCR-02 Local検証記録](../verification/scr-02-arrangement-notification-local.md)を参照する。次は利用者review後、Dev反映と会社管理者受入れを別承認で実行する。Local検証済みでも完了、Dev反映、進捗加点は記録しない。SCR-01の製品code・Rules・Dev反映と受入れは完了している。
