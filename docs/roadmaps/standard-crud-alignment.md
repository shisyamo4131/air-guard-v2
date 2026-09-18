# 標準CRUD整合ロードマップ

- 状態: In progress
- 開始日: 2026-09-15
- 現在の進捗: 20%
- 目的: 通常業務CRUDを既存Air ManagerとSchemasクラスの標準機能へ委譲し、重複する専用保存・検査・状態管理とRulesを簡素化する。[棚卸し](../implementation/operation-crud-simplification-inventory.md#2026-09-15の実装棚卸し)の差を解消し、以下の目的に対応した成果を工程ごとに確認する。
- 開始基準: local main `048e44e9cfd4ca887ec328e7e835c291579e68af`と、同基準で調査した2026-09-15の棚卸し。
- 実装branch: `codex/scr03-10-standard-crud-prelocal`。2026-09-17にrelease commit `55566deb4dda486689587889f8237f3ec24a210f`として`main`へ統合し、Firestore Rules・Functions・HostingをDevへ反映した。詳細は[Dev release記録](../verification/scr-03-10-dev-release-2026-09-17.md)を参照する。
- 成果範囲: SCR-01とSCR-02を完了。SCR-01は入金予定日を標準Manager／Class保存へ移し、Rulesを整合して旧専用経路とremote Functionを撤去した（package変更なし）。SCR-02は配置通知の状態更新・編集と上下番確定の受入れを完了し、Schemas `3.0.0-dev.3`をroot/Functionsのconsumerへ導入済みである。ただし今回のSCR-02 closeoutでSchemas source packageを変更・新規公開したものではない。いずれもdata migration、既存documentの一括操作は行っていない。
- 要件の正本: [標準CRUDと後続処理](../specification.md#標準crudと後続処理)、[画面別lock](../specification.md#稼働実績ロックと画面別操作)、[archive・restore](../specification.md#ドキュメントのアーカイブと物理削除)。本書で新しい機能要件を追加しない。

## SCR全体の目的と完了判定

2026-09-16の質疑で、既存仕様に基づくSCR全体の目的を次の5点として再確認した。詳細要件はリンク先の仕様を正とし、本節は改修成果を判定するための基準とする。

1. **マスタ削除**: Schemaの標準機能による論理削除（アーカイブ）へ接続し、整合性の確認はSchemaクラスに定義された`hasMany`と標準削除処理に委ねる。画面・Callable・Rulesへ同じ従属検査を重複実装しない。[archive仕様](../specification.md#ドキュメントのアーカイブと物理削除)に従う。
2. **トランザクション削除**: 物理削除とし、参照整合性を担保するための追加検査・lock等を設けない。既存の後続Triggerによる連携は維持する。[表示dataと従属参照](../specification.md#表示dataと従属参照)と[標準CRUD](../specification.md#標準crudと後続処理)に従う。
3. **Create／Update／Delete**: 提供する各操作を、state所有単位に合うdomain Manager内の`AirItemManager`／`AirArrayManager`からSchemaの標準処理へ接続する。base Managerの編集・validation・submit・error・loadingとSchemaの保存責務を独自に複製しない。[Manager仕様](../specification.md#pageとcomponentの構成)に従い、未提供操作を一律追加する意味ではない。Employeeの退職・誤退職訂正はSCR-09の例外として既存Callableを維持する。
4. **専用Callable撤去**: 標準経路への移行で不要になった時点で、専用Callableと不要な呼出側・補助処理・旧経路前提のtestを整理する。他機能が利用する共通処理と、認証・外部作用等の必要な専用境界は維持する。公開済みFunctionの撤去も対象・完了証拠を明示し、実行は既存の個別承認手順に従う。
5. **Rules簡素化**: 認証・同一tenantの境界を維持し、通常CRUDの入力・業務条件と`hasMany`による整合性確認をRulesへ重複実装せずSchemaへ委譲する。[テナントと認証](../specification.md#テナントと認証)に従い、対象操作に関係する過剰な制約を整理する。

各工程の完了時は、対象操作ごとに「標準機能へ委譲した責務」「撤去した専用経路・重複処理」「残した独自処理と必要な理由」を実装差分・reviewで確認する。Manager／Classを呼ぶ形だけに変え、同じ独自制御を別の場所へ移しただけでは目的達成としない。動作test・Dev受入れと、この責務整理の確認を両方満たす。

SCR-03〜SCR-10の個別目的・完了条件は、1工程ずつの質疑で確定した。SCR-02は2026-09-17の利用者Dev受入れにより完了し、10点を加点する。SCR-04以降の状態・得点は変更しない。

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
| SCR-02 配置通知の状態更新・編集 | 10 | 10 | Completed | 通知個別編集と最終確定を標準Manager／Schemasへ整合し、最終確定で通知を変更せず、既存通知のactual値を実績へ反映する。旧convert経路を撤去済み。Local検証、Dev反映、利用者による左右独立scroll・固定操作・既存通知行の鉛筆・上下番確定と再表示の受入れを完了した |
| SCR-03 Site手動終了・再開 | 10 | 0 | Implementation（必須入力修正・Dev再反映／再受入れ待ち） | [個別完了条件](#scr-03-site手動終了再開の目的と完了条件)に従い、Air Manager／Schema標準更新への委譲、不要経路撤去、Rules簡素化、現行業務条件の維持を確認する。必須入力修正は実装済みだが未deploy・Dev再受入れ待ちのため得点0を維持する |
| SCR-04 予定から実績化 | 10 | 0 | Implementation（変更不要確認済み・Local／Dev受入れ待ち） | [個別完了条件](#scr-04-予定から実績化の目的と完了条件)に従い、SCR-02の成果を5つの目的と照合し、残る差分だけを解消する。今回の静的監査では追加改修を確認していないが、必要な検証・受入れ証拠の充足を確認するまで完了判断しない |
| SCR-05 稼働請求・実績lock・稼働外売上 | 10 | 0 | Implementation（Dev反映済み・検証継続/受入れ待ち） | [個別完了条件](#scr-05-稼働請求実績lock稼働外売上の目的と完了条件)に従い、提供済み操作をAir Manager／Schemaへ委譲する。今回の利用者環境では登録button非表示の限定UI証拠のみ確認し、取極め・調整・lock・稼働外売上は未確認。対象candidateは[Dev反映済み](../verification/scr-03-10-dev-release-2026-09-17.md)だが、得点0を維持する |
| SCR-06 Customer archive整合 | 10 | 0 | Dev反映済み・Dev受入れ待ち | [個別完了条件](#scr-06-customerアーカイブの目的と完了条件)に従い、Air Manager／Schema標準archive・hasManyへ委譲し、通常basic/payment UPDATEからDELETEを分離した最終修正とreviewをreceiptで確認済み。既存archiveは変換せず保持し、得点0とDev受入れ待ちは維持する |
| SCR-07 Site archive整合 | 10 | 0 | Dev反映済み・Dev受入れ待ち | [個別完了条件](#scr-07-siteアーカイブの目的と完了条件)に従い、Air Manager／Schema標準archive・hasManyへ委譲し、利用者環境Local確認と[Dev反映](../verification/scr-03-10-dev-release-2026-09-17.md)は確認済み。既存archiveは保持し、得点0とDev受入れ待ちは維持する |
| SCR-08 提供済み請求操作の標準CRUD整合 | 10 | 0 | Implementation（prelocal・検証待ち） | 現提供範囲はpaymentDueDateAtのみで、既存標準Manager／Schemaが充足することを確認した。BankAccount／PaymentMethod／WorkerOrder画面は未提供のため対象外。direct tests 2+13+16を確認し、Local／Dev受入れまでは完了としない |
| SCR-09 Employee退職・誤退職訂正の専用経路維持 | 10 | 0 | Implementation（prelocal・検証待ち） | 既存退職／誤退職訂正Callableを維持し、変更不要であることを確認した。direct tests 7+14+18+4+3=46を確認し、Local／Dev受入れまでは完了としない |
| SCR-10 Employee archive整合 | 10 | 0 | Dev反映済み・Dev受入れ待ち | Callableはread-only preflight（User連携・予約・processing lock・LifecycleOperations/Head整合）に限定し、成功後だけEmployeeManager→Schema/ClientAdapterのraw same-ID archiveへ委譲する。利用者環境Local確認と[Dev反映](../verification/scr-03-10-dev-release-2026-09-17.md)は確認済みだが、得点0とDev受入れ待ちは維持する。復元・保持・物理削除は後続とする |

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

## SCR-03 Site手動終了・再開の目的と完了条件

- 合意: 2026-09-16の質疑で確定。目的と完了条件の文書化であり、製品実装・package変更・Dev操作の実行結果ではない。
- 目的: Siteの手動終了・再開をAir Manager経由でSchemaの標準更新へ委譲し、専用保存経路と重複する検査・状態管理を解消する。
- 対象: 提供済みの手動終了・再開と、それに必要なManager、Schemaクラス、Rules、不要になった専用経路の整理。
- 維持: 現行の終了・再開の業務条件・入力項目、終了後の通常編集条件、自動終了の条件・実行タイミング。SiteのアーカイブはSCR-07で扱う。
- 現行実装事実: 状態遷移の終端で`statusChangedAt = new Date()`を保存する。これは端末時刻の現行契約であり、server時刻化をSCR-03の残作業とはしない。[ADR 0054](../decisions/0054-site-auto-termination-and-terminated-selection.md)の2026-09-17補足を参照する。

### 完了条件

| 観点 | 完了と判断できる状態・証拠 |
|---|---|
| 標準機能への委譲 | 手動終了・再開がdomain Manager内のAirItemManager／AirArrayManagerからSchemaの標準更新へ接続され、base Managerの編集・検証・保存制御を画面側へ重複実装していないことを実際の入口から確認できる |
| 業務条件とクラス | [現行Site仕様](../specification.md#取引先現場取極め)の終了・再開条件と入力項目を維持する。クラスとの不一致・不足があればクラス側を修正し、画面側に同じ業務判定や専用保存処理を追加しない。必要なクラス変更・採用を含めて検証が完了している |
| 不要経路の撤去 | 標準化で不要になった専用Callable、composable、重複検査と旧経路への参照・testを整理済み。他機能が使う共通処理は維持し、残す処理の利用元と理由を確認できる。公開済みの不要Functionがあれば、承認済み撤去と確認まで完了している |
| Rules簡素化 | 手動終了・再開の標準保存が成立し、認証・同一tenant境界が維持される。入力・業務条件をSchemaとRulesで重複検査せず、不要な状態変更拒否・専用経路前提の制約を整理している |
| 動作と影響 | 終了・再開、取消、保存後の再表示・listener反映、失敗時の表示と非成功扱い、許可される操作と拒否される操作を確認する。終了後の通常編集条件を維持し、共有クラス・helperを変更した場合は自動終了への影響も確認する |
| 最終受入れ | 上記の目的に対する差分・独立review・必要な自動検証・対象範囲のDev受入れを対応付ける。標準機能の呼出しやtest成功だけで閉じず、責務の委譲と撤去の証拠が揃ってからSCR-03を完了する |

クラス側の変更が必要な場合、実装時に対象package・repository・採用範囲を確認する。本合意は画面側への重複実装で代替しない方針を確定するもので、package公開や外部操作の一括承認ではない。実装着手時に対象file・互換性・rollbackと影響別の検証範囲を具体化する。

### 2026-09-18 Dev受入れと必須入力修正

- 合成Siteを正規画面・会社管理者で操作し、手動終了は理由入力、保存、reload後の`TERMINATED`維持まで成功した。再有効化は、初回に終了日がUI stateへ反映されないままsubmitされ、sourceの実行順序上は`Site.beforeUpdate`がFirestore write前に拒否した。UI上はSiteが`TERMINATED`のまま維持された。ClientAdapterの汎用変換によりUIは`unknown error`を表示した。backendでのpartial write有無の直接assertは未実施である。
- 利用者承認後、開始日`2026/09/18`、終了日`2026/09/30`、理由を確認して一度だけ再送し、reload後`ACTIVE`・工期保持と通常の「現場を終了」導線を確認した。開始時の工期未設定には戻していない。以上で手動終了・再有効化の正常系Dev操作を確認したが、必須fieldのUI抑止gapが残った。
- application側で開始日・終了日・理由の3入力へ`required`を追加し、source contract testを追加した（未deploy）。対象は`components/Site/CustomInput/Lifecycle.vue`と`test/domain/site-lifecycle-ui-source-contract.test.mjs`のみ。空欄submitのruntime evidenceは、実DOM harnessがないため未検証とする。
- generic adapter error mapping、focus中のrequired rule risk、逆順日付の表示は未解消・未検証。別package改修は未承認・未実施。Dev再反映・再受入れが完了するまでSCR-03は得点0、全体進捗20%を維持する。SCR-02、他SCR、FUT-0197、製品完了の状態は変更しない。

## SCR-04 予定から実績化の目的と完了条件

- 合意: 2026-09-16の質疑で確定。目的はSCR-02で対応した実績化経路の確認と、残る差分の解消である。
- 対象: 予定から実績化までの入口・保存・Rules・不要な専用経路と、既存の請求・勤怠等への後続処理。SCR全体の5つの目的を対象操作に照らして確認し、該当しないマスタ削除等を追加しない。
- 既存成果の扱い: SCR-02で整合した標準sync、同ID実績作成、予定更新、既存通知のactual値反映、通知自体の不変、旧convert撤去を再実装・二重計上しない。未対応部分がなければ新しい改修を追加しない。

### 完了条件

| 観点 | 完了と判断できる状態・証拠 |
|---|---|
| 標準機能への委譲 | 実績化の入口から保存までがAir ManagerとSchemaの標準処理へ委譲され、同等の独自保存・検査・状態管理を重複実装していないことを確認できる |
| 不要経路の撤去 | 不要な専用Callable・補助処理・重複検査と旧経路への参照が残っていない。必要な共通処理は利用元と維持理由を確認でき、公開済みの不要Functionがあれば承認済み撤去まで確認できる |
| Rules簡素化 | 標準保存が成立し、認証・同一tenant境界を維持している。Schemaが担う業務検査や旧専用経路前提の制約を重複して残していない |
| 後続処理の維持 | 既存の請求・勤怠等への後続処理が維持されることを確認する。実績の保存成功と後続処理の完了を区別し、集計仕様や通知条件の変更を追加しない |
| 証拠と最終判断 | 各条件へSCR-02の実装差分・review・検証・受入れ結果を対応付け、有効な証拠を再利用する。不足・失効した確認だけを追加し、Pendingの受入れを成功と読み替えない。SCR-04の条件を満たす必要な証拠がすべて揃ってから完了判断する |

着手時は、確認済みの成果・有効な証拠・未対応部分・未受入れの範囲を区別する。改修が必要な場合だけ残る差分の対象file、互換性、rollback、検証・Dev受入れ範囲を具体化する。追加改修が不要な場合も、目的との照合と必要な受入れが済むまでは完了としない。同じ実装を新たな成果として報告せず、SCR-02の証拠でSCR-04のどの条件を満たしたかを明記する。今回の文書化ではSCR-04をImplementation（変更不要確認済み・Local／Dev受入れ待ち）・得点0として扱う。

### SCR-04 静的監査結果（2026-09-18）

- 標準機能への委譲: `components/OperationResult/Generator/index.vue`の確定入口は`SiteOperationSchedule.syncToOperationResult`を呼び、Schemaのtransaction内で予定と同じdocIdのOperationResultを作成し、予定の`operationResultId`を更新する。旧`useOperationGenerator`、`saveOperation`、`convert`経路は正規入口から除外されている。
- 通知・実績値: `syncToOperationResult`は配置通知のactualStartTime、actualEndTime、actualBreakMinutes、actualIsStartNextDay、isQualified、isOjtを実績detailへ反映し、通知がない項目は予定値を使う。確定入口はArrangementNotification自体を更新せず、個別鉛筆操作だけが対象通知を標準updateでLEAVEDへ変更する。
- 後続処理: `functions/triggers/operationResult.js`から4 projection（Billing、DailyAttendances、DailyOperationsByEmployee、SiteEmployeeHistories）を既存triggerへ接続している。projectionは各処理を独立試行し、失敗を集約して報告する。これは恒久再設計の完了を意味せず、FUT-0197の再発リスクは別管理する。
- 直接検証: `node --test test/domain/operation-editor-regression.test.mjs`は3/3、`node --test test/domain/operation-ui-recovery.test.mjs`は4/4、`node --test test/domain/operation-write.test.mjs`は29/29、`node --test test/domain/operation-result-projections.test.mjs`は7/7で、いずれもexit 0。既存SCR-02の成果を再実装せず、旧経路拒否、標準入口、通知値反映、4 projectionの独立処理を確認した。
- 変更要否と残作業: 今回の静的監査範囲では明確なcode gapは確認できず、今回のapplication code変更は不要。SCR-04はImplementation（変更不要確認済み・Local／Dev受入れ待ち）・得点0を維持する。残るのは、SCR-04固有のLocal／Dev受入れで、実績化後の予定更新、同ID実績、通知の不変、請求・勤怠・履歴projectionの実動作、認証・同一tenant境界、後続処理の失敗・未完了を成功扱いしないことを既存証拠と区別して確認すること。retry、reconciliation、failure ledger等の恒久対策はFUT-0197で扱い、SCR-04の完了条件には含めない。Local／Dev受入れ完了まではSCR-04を完了扱いにしない。

## SCR-05 稼働請求・実績lock・稼働外売上の目的と完了条件

- 合意: 2026-09-16の質疑で確定。目的は取極め・金額調整・ロック／解除・稼働外売上の提供済み操作をAir ManagerとSchemaの標準処理へ委譲し、不要な専用経路と重複処理・Rulesを整理することである。
- 維持: 現行の入力項目・計算方法・画面ごとの操作制限、経理画面へのアクセス制限、稼働請求画面から元の稼働実績を削除できない条件。未提供操作や新しい計算方式を追加しない。
- ロック: [画面別操作表](../specification.md#稼働実績ロックと画面別操作)に従う。ロック中でも稼働請求画面で許可されている調整は標準処理で保存できる形とし、Rulesや専用Callableから全画面の更新を一律拒否しない。
- クラスとの不一致: 標準処理が現行の業務条件を満たさない場合はSchemaクラス側を修正する。画面側に専用保存処理や同じ業務判定を重複実装して代替しない。

### 完了条件

| 観点 | 完了と判断できる状態・証拠 |
|---|---|
| 標準機能への委譲 | 取極め・金額調整・ロック／解除・稼働外売上の提供済み操作が、state所有単位に合うdomain Manager内のAirItemManager／AirArrayManagerからOperationBilling／OperationResult等のSchema標準処理へ接続されている。base ManagerとSchemaの責務を独自に複製していない |
| 業務条件とクラス | 現行の入力項目・計算方法を維持し、Schemaに不足・不一致がある場合はクラス側の修正・採用・必要な検証まで完了している |
| 画面別の操作制限 | 画面別操作表の許可・拒否が維持され、ロック中の稼働請求画面の許可操作が保存できる。経理画面へのアクセス制限と稼働請求画面からの元実績削除禁止を維持し、ロック中の全画面一律write拒否を設けていない |
| 不要経路の撤去 | 不要になった専用Callable・保存処理・重複検査と旧経路への参照・testを整理済み。他機能が利用する共通処理は利用元と維持理由を確認できる。公開済みの不要Functionがあれば承認済み撤去まで確認できる |
| Rules簡素化 | 認証・同一tenant境界を維持して標準保存が成立し、Schemaが担う入力・業務検査と旧専用経路前提の過剰な制約を重複して残していない |
| 動作と後続反映 | 各提供操作の保存・再表示・listener反映・失敗時の表示と非成功扱いを確認する。共有する稼働実績画面への影響と、既存の請求・勤怠等への後続反映を確認し、保存成功と後続処理完了を区別する |
| 最終受入れ | 各目的へ実装差分・独立review・必要な検証・対象範囲のDev受入れを対応付け、標準機能への委譲と撤去の証拠が揃ってから完了判断する。有効な既存証拠は再利用し、不足・失効した確認を追加する |

対象が広いため、実装着手時は独立して検証・受入れできる操作単位へ分け、共有Rules・callerへの影響、対象file、互換性、rollback、検証範囲を具体化する。必要なpackage変更・公開やDev操作は既存の承認境界に従う。稼働外売上の権限に関する既存の未決事項は、本合意を権限変更の回答へ読み替えず、現行提供操作を維持する。SCR-05はImplementation（Dev反映済み・検証継続/受入れ待ち）・得点0で、登録button非表示以外の取極め・調整・lock・稼働外売上は未確認である。

## SCR-06 Customerアーカイブの目的と完了条件

- 合意: 2026-09-16の質疑で確定。目的は提供済みCustomerアーカイブをAir ManagerからSchemaの標準削除処理へ接続し、hasManyによる従属確認へ委譲することである。
- 対象: 既存のCustomerアーカイブ操作、新たに保存する標準archive形式、必要なRules整合、不要になった専用経路・重複処理の撤去。
- 範囲外: 復元画面の追加、旧形式archiveの復元対応、既存archiveの一括変換。過去の独自形式のdataは変換・削除せず保持する。通常CRUDと既存の業務上の提供条件を維持する。
- 最終実装事実: `1250f8ff8ef5fb1043d00b990bb8680fd53cadb0`で通常basic/payment UPDATEからDELETEを分離し、明示archive buttonだけをarchive-mode Managerへ接続した。CustomerManagerのcreated／updated／delete event forwardingも明示化した。fix reviewとfinal product content security reviewはfinding 0。Local確認済みだが、Dev受入れ・得点0は維持する。

### 完了条件

| 観点 | 完了と判断できる状態・証拠 |
|---|---|
| 標準アーカイブ | 提供済みの削除入口がdomain Manager内のAirItemManager／AirArrayManagerからCustomerのSchema標準削除処理へ接続され、新たなarchiveを標準形式で保存する。独自envelopeを新規作成しない |
| 従属確認 | SchemaクラスのhasManyと標準削除処理に委ね、従属ありはアーカイブ拒否、なしは標準移動となる。画面・Callable・Rulesに同じ従属検査を重複実装せず、拒否・検査失敗を成功扱いしない |
| 不要経路とRules | 不要になった専用Callable・独自保存処理・重複検査と旧経路への参照・testを整理し、Rulesを標準archiveへ整合する。認証・同一tenant境界を維持する。他機能が利用する共通処理は残し、公開済みの不要Functionがあれば承認済み撤去まで確認できる |
| 既存dataの保持 | 既存archiveを変換・削除せず保持し、新たな標準形式への切替えが既存dataを損なわないことを確認する。旧envelopeを標準restoreへそのまま渡せるとは扱わない |
| 動作と通常CRUD | アーカイブ成功後の一覧・listener反映、取消、拒否・失敗時の表示と非成功扱い、Customerの通常CRUDの維持を確認する |
| 最終受入れ | 各条件へ実装差分・独立review・必要な検証・対象範囲のDev受入れを対応付け、標準機能への委譲と不要経路撤去の証拠が揃ってから完了判断する。復元機能の完成をSCR-06の完了条件に含めない |

### 後続事項

Customerの復元画面と旧形式archiveの復元対応は、SCR-06から分離した後続事項として本節に保持する。後続工程では標準形式と旧形式を区別し、対象data・互換性・必要な変換方法・検証・復旧を具体化してから対応する。今回は後続工程の着手時期・提供範囲を確定せず、復元済み・復元可能と保証しない。

着手時は対象file、共有caller、既存archiveへの影響、切替えの互換性、rollback、検証範囲を具体化する。既存dataの保持と標準処理が両立しない箇所が判明した場合、無断変換や独自経路の追加で埋めず、該当点を報告する。SCR-06はDev反映済み・Dev受入れ待ち・得点0とし、Dev受入れまで完了扱いにしない。

## SCR-07 Siteアーカイブの目的と完了条件

- 合意: 2026-09-16の質疑で確定。目的は既存SiteアーカイブをAir ManagerからSchemaの標準削除処理へ接続し、従属確認をhasManyへ委譲することである。
- 対象: 提供済みのSiteアーカイブ、新たな標準archive形式、必要なRules整合、不要な専用経路・重複処理の撤去。
- 維持・範囲外: Siteの通常CRUDと終了・再開を維持する。SCR-03の終了・再開はlive Siteを残す状態変更であり、本工程のアーカイブとは別操作である。既存archiveは変換・削除せず保持し、復元画面・旧形式の復元対応は後続とする。

### 完了条件

| 観点 | 完了と判断できる状態・証拠 |
|---|---|
| 標準アーカイブ | 既存の削除入口がdomain Manager内のAirItemManager／AirArrayManagerからSiteのSchema標準削除処理へ接続され、新たなarchiveを標準形式で保存する。独自保存やenvelope作成を重複実装していない |
| 従属確認 | SchemaクラスのhasManyと標準削除処理へ委譲し、従属ありは拒否、なしは標準移動となる。画面・Callable・Rulesへ同じ検査を重複実装せず、拒否・検査失敗を成功扱いしない |
| 不要経路とRules | 不要な専用Callable・独自保存処理・重複検査と旧経路への参照・testを整理し、認証・同一tenant境界を維持してRulesを簡素化する。他機能が使う共通処理は利用元と維持理由を確認でき、公開済みの不要Functionがあれば承認済み撤去まで確認できる |
| 既存dataの保持 | 過去のarchiveを変換・削除せず保持し、新たな標準形式への切替えが既存dataを損なわないことを確認する。旧形式を標準restoreへそのまま渡せるとは扱わない |
| 動作と既存操作 | 成功後の一覧・listener反映、取消、拒否・失敗時の表示と非成功扱いを確認する。Siteの通常CRUDと終了・再開の業務条件・挙動を維持する |
| 証拠と最終受入れ | SCR-06の共通検証はSiteにも適用でき、失効していない範囲で再利用する。Site固有のhasMany・入口・Rules・影響範囲をCustomerの結果だけで検証済みにせず、不足する確認を追加する。差分・独立review・必要な検証・対象範囲のDev受入れが揃ってから完了判断する |

### 後続事項

Siteの復元画面・旧形式archiveの復元対応は本節に後続事項として保持し、SCR-07の完了条件へ含めない。後続工程で標準形式と旧形式、対象data、互換性、必要な変換・検証・復旧方法を具体化する。今回の合意だけで既存dataを移行せず、復元可能とも保証しない。

着手時はSite固有の従属定義、共有caller、既存archiveへの影響、対象file、互換性、rollbackと検証範囲を確認する。既存data保持と標準処理が両立しない箇所は、無断変換や独自経路の追加で埋めず報告する。SCR-07はDev反映済み・Dev受入れ待ち・得点0とし、Dev受入れまで完了扱いにしない。

## SCR-08 提供済み請求操作の目的と完了条件

- 合意: 2026-09-16の質疑で確定。目的は提供済み請求操作を確認し、残る標準化の差分を解消することである。
- 対象: 提供済みの請求操作のAir Manager／Schema接続、不要な専用経路・重複処理の撤去、Rules簡素化。入金予定日編集などSCR-01で標準化済みの操作は再実装しない。
- 維持・範囲外: 現行の入力項目・計算方法・保存後の表示・失敗時の挙動を維持する。未提供の請求確定・編集・削除画面は今回追加せず、後続事項とする。請求documentと元の稼働実績を区別する既存仕様を維持し、新たな削除操作を追加しない。

### 完了条件

| 観点 | 完了と判断できる状態・証拠 |
|---|---|
| 対象の確認 | 提供済み操作、SCR-01等で標準化済みの操作、残る未対応操作、未提供画面を区別し、改修対象は残る提供済み操作だけに限定できる |
| 標準機能への委譲 | 提供済み操作がdomain Manager内のAirItemManager／AirArrayManagerからSchemaの標準処理へ接続され、base ManagerとSchemaの責務を独自保存・検査・状態管理で重複実装していない |
| 不要経路とRules | 不要な専用Callable・重複処理と旧経路への参照・testを整理し、認証・同一tenant境界を維持してRulesを簡素化する。他機能が使う処理は維持理由を確認でき、公開済みの不要Functionがあれば承認済み撤去まで確認できる |
| 既存動作の維持 | 対象操作の入力・計算・保存後の再表示とlistener反映・失敗時の表示と非成功扱いが維持されることを確認する |
| 証拠と最終判断 | SCR-01等の有効な成果・review・検証・受入れ証拠を各条件へ対応付けて再利用する。不足・失効した確認だけを追加し、残る改修があればその差分と必要なDev受入れまで確認する。未対応操作がなければ追加改修せず、必要な証拠の照合が完了してから完了判断する |

### 後続事項

未提供の請求確定・編集・削除画面は本節に後続事項として保持する。後続工程で提供操作、必要な表示・入力、確定時のissuer snapshot、確定後CRUDと元実績を削除しない条件を現行仕様と照合し、具体的な実装・検証範囲を定める。今回の対象外とすることは既存の請求仕様の撤回や実装済みとの判断を意味しない。未決の入金dataモデルも自動採用しない。

着手時は現在の提供範囲と有効な証拠を確認する。残る改修が必要な場合だけ対象file、互換性、rollback、検証・受入れ範囲を具体化し、SCR-01等と同じ成果を二重計上しない。SCR-08はImplementation（prelocal・検証待ち）・得点0で、変更不要のdirect evidenceを確認済みだがLocal／Dev前のため完了としない。

## SCR-09 Employee退職・誤退職訂正の目的と完了条件

目的は、両操作を標準CRUD化の例外として明確にし、User/Authとの整合性を担う既存Callableの単一経路を維持・検証することである。仕様の正本は[テナントと認証](../specification.md#テナントと認証)、判断理由は[ADR 0071の改訂](../decisions/0071-normal-business-manager-and-callable-boundary.md#2026-09-16改訂employee退職誤退職訂正の例外)を参照する。

### 完了条件

| 確認対象 | 完了条件 |
|---|---|
| 退職入口と分岐 | Userなしの場合も同じCallableへ接続し、予約・実Userの照合と保存時の再確認を維持する。clientにUser有無による別保存経路を設けない |
| 退職の保護と後続処理 | Employee単体、本登録User、仮登録User、管理者・自己・他tenant、不整合の各条件を照合する。既存actor・対象・日付条件、Employeeと業務記録の保持、User/Auth削除・予約解放・cleanup、途中失敗・結果不明からの再開を維持する。Employee保存成功とAuth・cleanup完了を区別する |
| 誤退職訂正 | 会社管理者、RESIGNED、User連携なし、最新かつ後処理まで完了した退職、処理中lockの検査を維持する。在職復帰・退職日と理由の削除・訂正履歴保存を同じtransactionで行い、重複実行を防止する。削除済みUser/Authを自動復元しない |
| 専用境界 | 必要なCallable、Rulesのclient直接変更拒否、認証・tenant・予約・lock・操作履歴を維持する。標準CRUDへの置換や保護の撤去を成果条件にしない。通常編集とarchiveは本工程へ混ぜない |
| 証拠と最終判断 | 既存の有効なtest・review・対象範囲のDev受入れ証拠を条件ごとに照合し、不足・失効だけを確認・修正する。差分がなければ追加改修せず証拠の充足で判断する。既存実装の存在やコード読取りだけで完了としない |

着手時に有効な既存証拠と不足を一覧化し、必要な改修がある場合だけ対象file・互換性・rollbackと検証範囲を定める。既存の退職・訂正操作、actor、保存形式、Authの処理順を作り直す工程ではない。再雇用、archive・restore、別package変更、実data操作は自動的に含めない。SCR-09はImplementation（prelocal・検証待ち）・得点0で、既存Callable維持とdirect evidenceを確認済みだがLocal／Dev前のため完了としない。SCR-02は完了済みであり、SCR-04以降へ実績化範囲を二重計上しない。

## SCR-10 Employeeアーカイブの目的と完了条件

2026-09-16の質疑で、復元画面・旧形式の復元対応は後続とした。アーカイブはCallableで固有条件を検証し、許可後にブラウザのManager／Schema標準処理で実行する。保存経路と受容する競合の正本は[Employee仕様](../specification.md#employeeの操作権限と保持)、判断理由は[ADR 0060](../decisions/0060-common-archive-purge-and-address-contract.md)を参照する。

- 正規に退職したEmployeeは残す。誤退職訂正が完了した履歴だけではアーカイブを拒否しない。
- User連携ありの場合は拒否し、先に既存専用処理で連携を解消する。アーカイブでUser/Authを削除しない。
- 事前検証と保存の間の状態変化を受容する。未解消の予約・処理中・不整合の検査は維持し、既存履歴は保持する。
- サーバー側標準deleteへの接続は採用しない。server-adapter改修は[FUT-0144](../implementation/future-actions.md#fut-0144-server-adapterのhasmany-field契約をschemaclientと一致させる)へ後続記録し、早急に実施せず本工程の前提にしない。
- 将来の「無効化 → アーカイブ → 物理削除」は[FUT-0146](../implementation/future-actions.md#fut-0146-archive-audit-metadataretentionpurgerulesを共通設計する)で詳細を後日決定する。本工程へ追加しない。

### 完了条件

| 確認対象 | 完了条件 |
|---|---|
| Callable事前検証 | User連携・予約・退職状態・処理中lock・履歴の整合性を確認する。User連携あり、退職状態、未解消の予約・処理中・不整合は拒否する。誤退職訂正が完了した履歴だけでは拒否しない |
| 標準アーカイブ | 事前検証の許可後に、ブラウザのDomain Manager内のAirItemManager／AirArrayManagerからSchema／ClientAdapterの標準削除を実行する。通常の従属確認はhasManyへ委譲し、新規archiveは独自envelopeを使わない。検証の拒否・失敗時は保存へ進まない |
| 競合の受容 | 事前検証と保存が非atomicであることを明記し、その間のUser連携等の状態変化を合意どおり受容する。Callableの許可を保存成功・保存時の条件保証と扱わず、完全防止の追加lockやserver保存を完了条件にしない |
| 保持と旧経路整理 | User/Auth・既存の操作履歴・従属documentを連鎖削除しない。既存archiveを変換・削除せず保持する。不要になった旧archive保存・呼出側・重複検査を整理し、必要な事前検証CallableとSCR-09の専用処理は維持する |
| Rulesと既存操作 | ブラウザの標準archiveに必要なRulesを整合し、認証・同一tenantとUser/Auth固有の保護を維持する。Employeeの通常編集、退職・誤退職訂正へ回帰を起こさない |
| 検証と最終判断 | 上記の許可・拒否、hasManyによる従属あり拒否、同IDの標準archiveと原本削除、一覧・詳細への反映、検証失敗・保存失敗時の表示と成功扱いしない動作を確認する。有効な既存証拠は再利用し、不足・失効した範囲だけを追加検証する。対象のreview・必要な検証・Dev受入れ証拠が揃ってから製品完了を判断する |

着手時に対象file・現行経路・有効な証拠を照合し、client・Callable・Rulesの互換性とrollback単位を具体化する。復元対応、server-adapter改修、将来の段階的削除は本工程の完了条件に含めない。SCR-10はDev反映済み・Dev受入れ待ち・得点0で、preflight後の標準保存、direct SDK bypassの明示受容、grant／新管理documentなしの判断を採用済みとする。

## 影響確認から次の1件を選ぶ

上記の優先順位を基準に、着手前に各項目について次を確認する。小さな変更で独立して完了できる操作から着手し、1件を閉じた時点で残件を再評価する。未確認を「影響なし」と扱わない。

1. SCR-09のような合意済み例外を先に除外し、通常CRUDの実際の画面入口がAir Managerへ接続しているか。名前がManagerでも独自dialog・controllerなら置換対象として数える。
2. 標準クラスの保存へつなぐだけか。入力条件・serialization・listener・error処理の調整、Manager置換、共有callerの変更も必要か。
3. Rules、保存形式、他document、後続Trigger、User/Authへの影響があるか。file数だけで影響の大小を決めない。
4. 最小変更範囲、維持する動作、必要な検証、未確認事項を提示し、独立して完了できるかを判断する。影響が広がれば候補を分割するか後へ回し、別の小さい候補を選ぶ。

### 初回比較（2026-09-15・静的確認）

下表は上記の改修優先順位を決めた当時の静的確認の根拠である。後の質疑で確定した個別目的・完了条件を優先し、SCR-06・SCR-07の復元とSCR-08の未提供画面、SCR-09の業務状態と認証処理の分離に関する当時の記述を今回の実装条件へ戻さない。各項目の具体的な変更範囲は着手前に確定する。実装・runtime検証は未実施。「標準CRUDへの接続だけで完了」と確定できた項目は今回の比較ではない。

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

退職・誤退職訂正の現行入口は[Employee LifecycleActions](../../components/Employee/LifecycleActions.vue)から[専用controller](../../composables/application/user/useUserLifecycleOperations.js)を通るCallableである。[退職use-case](../../functions/modules/auth/lifecycle/terminateEmployee.js)はUser連携なし・本登録User連携を内部で判定し、仮登録Userや不整合を拒否する。[訂正use-case](../../functions/modules/auth/lifecycle/reinstateEmployee.js)は最新の完了済み退職とUser連携なしを検証する。標準toTerminatedへの置換は行わない。

SCR-09の[個別完了条件](#scr-09-employee退職誤退職訂正の目的と完了条件)について独立security reviewを行い、既存の退職・訂正、認証gateway、lifecycle再照合の有効な検証・Dev受入れ証拠を照合する。不足・失効した範囲だけを追加検証する。Employee側のRulesからUserのclient write開放を導かず、SCR-10のarchiveからUser/Auth・従属documentを連鎖削除しないことは別に確認する。

## 各工程で先に解消する確認残

- SCR-06: [合意済み範囲と後続事項](#scr-06-customerアーカイブの目的と完了条件)に従い、新たなarchiveの標準化と既存data保持を確認する。復元画面・旧形式の復元対応は後続とし、今回の実装条件へ戻さない。
- SCR-07: [合意済み範囲と後続事項](#scr-07-siteアーカイブの目的と完了条件)に従い、Site固有の従属確認と既存操作への影響を確認する。復元画面・旧形式の復元対応は後続とし、既存archiveは保持する。
- SCR-10: [個別完了条件](#scr-10-employeeアーカイブの目的と完了条件)に従い、着手時に検証Callable・ブラウザ標準archive・Rulesの変更範囲と既存証拠の不足を確認する。復元画面と旧形式対応は後続で、既存archiveの変換・削除は今回行わない。
- SCR-03: [合意済みの目的と完了条件](#scr-03-site手動終了再開の目的と完了条件)に従い、クラスとの不一致箇所・必要な修正範囲を着手時に確認する。既存Callableがあること自体を例外維持の根拠にしない。
- SCR-09: [合意済み目的と完了条件](#scr-09-employee退職誤退職訂正の目的と完了条件)に従い、既存Callableと証拠を照合する。標準更新への分離やpackage改修を前提にしない。不足が見つかった場合だけ対象・互換性・rollback・検証範囲を具体化する。
- SCR-05: 稼働外売上の現行提供操作を維持し、[確認事項台帳](../implementation/pending-confirmations.md)に残る権限判断を保存方式の変更から推論しない。共有Rulesに関わる未決が対象保存を妨げる場合は実装前にその一点を解消する。
- SCR-08: [合意済み範囲と後続事項](#scr-08-提供済み請求操作の目的と完了条件)に従い、提供済み操作とSCR-01等の有効な証拠を照合する。未提供画面・確定時snapshot等は後続で具体化し、[確認事項台帳](../implementation/pending-confirmations.md)の未決な入金dataモデルまで自動採用しない。

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

### SCR-03〜10の現時点ファクト（2026-09-17）

- SCR-03／SCR-06／SCR-07／SCR-10はDev反映済み・Dev受入れ待ち、SCR-05は登録button非表示の限定UI証拠のみでImplementation（Dev反映済み・検証継続/受入れ待ち）とし、いずれも得点は0。利用者環境Localの操作事実は[Local receipt](../verification/scr-03-10-user-local-acceptance-2026-09-17.md)、Dev配信事実は[Dev release記録](../verification/scr-03-10-dev-release-2026-09-17.md)を正とし、Dev受入れ・製品完了・得点加算とは分ける。SCR-02はCompleted・10点である。
- SCR-04はImplementation（変更不要確認済み・Local／Dev受入れ待ち）・得点0。SCR-02で整合した標準実績化を二重計上しない。
- SCR-08は、現提供範囲のpaymentDueDateAtが既存標準Manager／Schemaで充足することを確認した。BankAccount／PaymentMethod／WorkerOrder画面は未提供で対象外。direct tests 2+13+16はすべてexit 0だが、Local／Dev前のため完了扱いにしない。
- SCR-09は、既存退職／誤退職訂正Callableを維持し変更不要であることを確認した。direct tests 7+14+18+4+3=46はすべてexit 0だが、Local／Dev前のため完了扱いにしない。
- SCR-05は登録button非表示の限定UI証拠のみで、取極め・調整・lock・稼働外売上は未確認。旧receiptの限定証拠を再利用し、SCR-05全体のLocal受入れ完了とは扱わない。SCR-10はDev反映済み・Dev受入れ待ち・得点0。Callableはread-only preflightに限定し、正規画面では拒否・失敗時に標準保存へ進まない。direct SDKはpreflightを迂回し得るが、アプリ想定外経路まで保証しないことを明示受容し、one-time grant・追加role・新管理documentは設けない。
- 2026-09-17の専用snapshotによるLocal verificationは[SCR Local verification receipt](../verification/scr-local-verification-2026-09-17.md)、利用者環境によるSCR-03/06/07/10の追加Local受入れとSCR-05の限定UI証拠は[Local receipt](../verification/scr-03-10-user-local-acceptance-2026-09-17.md)、Dev配信は[Dev release記録](../verification/scr-03-10-dev-release-2026-09-17.md)を参照する。SCR-03/06/07/10はDev反映済み・Dev受入れ待ち、SCR-05はImplementation（Dev反映済み・検証継続/受入れ待ち）、SCR-04/08/09に今回追加UI evidenceはなく、SCR-09 callableと既存受入れは維持する。SCR-03〜10の得点・製品完了状態・進捗20%は変更しない。

### SCR-03〜10の再整理（2026-09-18）

今回の再開では、SCR-03〜10の得点・製品完了状態・進捗20%を変更しない。実装・検証・受入れの状態と残作業は次のとおりである。

- SCR-03: Dev反映済み・Dev受入れ待ち。残作業は、手動終了・再開の標準Manager／Schema委譲、業務条件維持、不要経路撤去、必要な自動検証と対象範囲のDev受入れを対応付けること。
- SCR-04: Implementation（変更不要確認済み・Local／Dev受入れ待ち）。SCR-02で整合済みの実績化を二重計上せず、予定から実績化のcaller、通知・実績・既存projectionの接続と不足証拠を確認し、必要な差分だけを実装・検証・受入れすること。
- SCR-05: Implementation（Dev反映済み・検証継続／受入れ待ち）。登録button非表示以外の取極め、調整、実績lock、稼働外売上は未確認であり、操作単位ごとの検証と受入れが残る。
- SCR-06: Dev反映済み・Dev受入れ待ち。Customer archiveの標準処理委譲、従属整合、既存archive保持とDev受入れを確認する。復元・旧形式変換は対象外の後続事項とする。
- SCR-07: Dev反映済み・Dev受入れ待ち。Site固有のarchive入口、hasMany、Rules、既存操作への影響とDev受入れを確認する。復元・旧形式変換は対象外の後続事項とする。
- SCR-08: Implementation（prelocal・検証待ち）。提供済みpaymentDueDateAtは標準Manager／Schemaで充足し、未提供のBankAccount／PaymentMethod／WorkerOrder画面は対象外。direct evidenceはあるがLocal／Dev確認が残る。
- SCR-09: Implementation（prelocal・検証待ち）。既存の退職・誤退職訂正Callableは変更せず維持する。direct evidenceはあるがLocal／Dev確認が残り、再雇用・archive／restore・User client write開放は追加しない。
- SCR-10: Dev反映済み・Dev受入れ待ち。read-only preflight後の標準Employee archive、既存User/Auth・従属document保持、失敗時の保存停止とDev受入れを確認する。復元・server-adapter改修・物理削除は対象外の後続事項とする。

OperationResultから4派生先へのprojection同期の恒久対策はSCR-03〜10の完了条件へ混ぜず、試行Dev修復の記録とともに[将来要対応事項 FUT-0197](../implementation/future-actions.md#fut-0197-operationresultから派生文書へのprojection同期を恒久化する)へ切り分ける。SCR-04・SCR-05の既存projection確認では、今回の試行修復を製品完了や得点の根拠として再利用しない。

2026-09-17訂正: 2026-09-16時点では対象data不足により会社管理者Dev受入れをPendingとしていたが、利用者から「Local受入れ検証、コード検証: 完了」「上下番確定処理画面の確認事項: 確認OK（Dev受入れOK）」の確定報告を受領した。これによりSCR-02をCompleted・10点へ更新する。SCR-04はImplementation（変更不要確認済み・Local／Dev受入れ待ち）・得点0のまま維持し、SCR-02で整合した実績化範囲を再実装・二重計上しない。

SCR-02の最終Dev候補はユーザーcode review、domain-full 1434/1434、Local Emulator 180/180、Local UI build、`generate:dev`を成功し、commit `f3b1e01891f6a14605d17b2e7fb5c67daabec15a`へ固定した。GitHub Actions run `35066835154`はHosting・Functions・Firestore RulesをDevへ反映し、全stepが成功した。2026-09-17に利用者からLocal受入れ・コード検証の完了と、上下番確定処理画面の確認OK（Dev受入れOK）の確定報告を受領し、SCR-02を完了した。Dev受入れで確認した左右独立scroll、固定された確定操作、既存通知行の鉛筆、上下番確定と再表示を記録する。migration/repairはなく、Prod、FCM実配信、backend日付算術、dashboard本人表示は未実施のまま維持する。詳細は[SCR-02 Local検証記録](../verification/scr-02-arrangement-notification-local.md)を参照する。SCR-04の標準実績化とは分離し、同じ実装を二重計上しない。

### SCR-02受入れ前 UI layout regression 補正

Dev受入れで、上下番確定処理画面の内容が縦方向に増えるとスクロールできず、「上下番を確定する」buttonが画面外へ出る問題を確認した。これはSCR-02の通知状態・package契約の変更とは分離した既存UI layout regressionとして扱い、SCR-02のDev再受入れ前に解消した。Generatorを単一DOM rootとし、外側columnから共通two-pane rowまで`overflow-hidden`と`min-height: 0`を連続させ、既存List/Detail本文の独立scroll境界と右toolbar/actionsの外側配置を維持した。source regression testは左右独立scroll、右actions固定、外側columnとalert→row順序を固定する。手動の再取得buttonは廃止し、配置通知は選択時の自動取得とlistenerを表示正本とする。最終候補、Dev反映、利用者受入れの結果は上記および[SCR-02 Local検証記録](../verification/scr-02-arrangement-notification-local.md)を正とする。

最有力の直接原因は、`44a3aa0b0c210984a334a761cecb9ed969afe7df`で旧`TemplatesFixedHeightContainer`の固定高と`overflowY:auto`を削除した後、`df00e543ffe29ab4ae3cdc9a27f90fa285f9dddb`で追加されたGenerator内のflex rowに`min-height:0`等の縮小制約がなく、固定viewport、AirArrayManagerの`overflow-hidden`、Detail cardの本文領域が組み合わさって内部scroll境界を失ったことにある。release commit `8d2dbf16a7d77642d7166d18d02b6b2f917e89e4`のDetail変更は編集buttonのdisabled条件だけで、このregressionの導入元ではない。

完成条件は、短いviewport、alert有無、schedule未選択／選択後、worker／security report等の縦長内容で、headerと確定buttonが常時到達可能、ListとDetail本文が独立してscrollし、狭い横幅の既存挙動を維持すること。画面全体scrollの単純復活だけでは完了としない。source regression test、review、Local確認、利用者のDev受入れ報告が揃ったためSCR-02のこの補正範囲も完了とする。
