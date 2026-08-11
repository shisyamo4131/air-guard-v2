# 取極めなしOperationResultを請求対象へ回復する実装調査

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-010 — 請求稼働管理の取極めなし実績回復
- 最終確認日: 2026-08-11
- 根拠ファイル: `utils/pageSettings.js` の請求稼働設定、`pages/billings/operations/index.vue`・`[id].vue`、`components/OperationBillings/Manager`・`DataTable`、`components/OperationBilling/Manager`・Agreement activator/custom input・lock button、`components/Agreement/Select/index.vue`、schemas `OperationBilling`・`OperationResult` のagreement/billingDate/lock/update契約、Functions `onOperationResultChange`・`syncOperationResultToBilling`・`addOperationResultToBilling` の直接契約

## 承認済み前提

- 取極めなしで上下番確定したOperationResultは、請求稼働管理から後で請求対象へできる。
- 上下番確定画面の成功はOperationResult作成までであり、このBilling反映完了を待たない。
- `allowEmptyAgreement` というflagで回復するのではなく、既存OperationResultを請求稼働管理で編集する実装である。
- 権限制御は試作段階であり、現在の `billings:read` やRulesを確定仕様としない。正式な閲覧・編集・lock権限分割は将来決定する。
- 請求単価・数量を個別設定できるため、現時点では取極め候補を適用日・勤務区分で強制制限しない。通常適用外の取極めを手動選択できる。
- 取極めなしでも、請求日、単価、数量等を個別設定して請求対象にできる必要がある。
- OperationResult自体がない手動請求は、稼働外売上を持つOperationResultとArticleDetailを正規経路として扱い、別Billing child manual-line modelは採用しない。課税区分等は実務に合わせて将来追加する。

## 対象抽出条件

- OperationBillingはOperationResultを継承し、collectionPathを上書きしないため、請求稼働一覧は同じ `OperationResults` collectionを読む。
- 一覧queryは選択月の `dateAt` 範囲だけで、isBillable・hasAgreement・isLockedによる除外はない。このため取極めなし・billingDateなしの非請求実績も表示される。
- 非請求itemには警告icon、locked itemにはlock iconを表示する。取引先・現場filterはclient側である。
- 一覧のitem選択は `/billings/operations/{OperationResult.docId}` へ遷移する。

## 権限

- 一覧・詳細pageの設定はいずれも `billings:read` を要求する。
- page/component内には `billings:write` 等の追加検査がなく、詳細managerはupdateを実行する。したがって実装UI上はread permissionで編集入口へ到達する。
- Firestore Rulesは同一companyId custom claimの認証ユーザーにOperationResultsのread/writeを一括許可し、page permission、role、操作種別、変更fieldを検査しない。super-userも会社にかかわらず許可する。
- role presetではmanagerとaccountantの `billings:write` がreadへ展開されるほか、個別 `billings:read` もpageを通過できる。これらは暫定実装であり、正式な請求担当者条件ではない。

## 操作フロー

1. 利用者は月範囲の一覧から警告icon付きOperationResultを選ぶ。
2. 詳細の「取極め」cardは現在値を「取極めなし」、請求締日を「未設定」と表示し、edit actionを持つ。
3. Agreement専用入力componentは対象Siteの `agreementsV2` 全件を候補にし、取極めの選択/clearと請求日の手動入力を定義する。ただし現行ManagerからAirItemManagerへのcustom-input結線がなく、この専用componentが実際に開くことは静的に確認できない。
4. 入力値がdraftへ反映された場合、agreement setterはkey変更時に `refreshBillingDateAt()` を呼び、OperationResultの日付とagreement.cutoffDateからbillingDateAtを設定する。取極めなし・cutoffDate不正ならnullにする。
5. AirItemManagerがsubmitした場合、managerは同じOperationResults documentへ `OperationBilling.update()` を実行する。
6. onOperationResultChange triggerがbefore/afterのisBillableを比較する。非請求→請求なら `addOperationResultToBilling` を呼び、集約Billing documentを新規作成または既存へ追加する。

取極めなしの場合に使う想定のAgreement/Adjust入力componentは、請求締日の手動設定、`useAdjusted`、基本・資格の数量、残業時間、単価、残業単価を定義する。salesAmountはuseAdjusted=trueならこの調整値を使う。useAdjusted=falseかつagreementなしではoriginal側単価が0となるため、請求可能状態でも稼働分売上は0になる。現行routeからこれら専用componentへの実到達性はFUT-0174の未修正事項である。

OperationBilling自体のcreateは禁止されている。回復は新しいOperationBilling documentを作る操作ではなく、既存OperationResultをOperationBilling subclassとして更新し、Functionsが別collectionのBilling集約へ反映する処理である。

## データ更新

| 操作 | OperationResult上の変化 | 後続Billing作用 |
|---|---|---|
| agreement選択 | agreementを保存し、billingDateAt/billingDate/billingMonthを再計算 | isBillableがfalse→trueなら該当Billingへ追加 |
| billingDateAt手動入力 | agreementなしでもbillingDateAtを設定可能 | customerIdがあればisBillable=trueとなりBillingへ追加 |
| agreement clear | billingDateAtをnullへする | true→falseなら既存Billingから削除 |
| 請求日変更 | billing keyが変化 | true→trueで旧Billingから新Billingへ移動 |
| 同じ請求key内の更新 | OperationResultの他fieldも保存可能 | 既存embedded resultを置換。なければ追加 |

isBillableの実装条件は `billingDateAt != null && customerIdあり` で、hasAgreement自体は条件ではない。このためUI文言どおり、取極めを選ばず請求締日を手動入力しても請求対象になる。

## 整合性・lock・transaction

- OperationBillingは `_shouldCheckLock()` をfalseへoverrideするため、isLocked=trueでもupdateとtoggleLockを実行できる。請求稼働管理からの編集を許すというclass commentと一致する。
- 取極めcardだけでなく、同じ詳細pageの稼働概要・請求明細managerもOperationBilling.updateを使うため、locked状態でも編集可能である。
- OperationResult updateとBilling集約更新は同一transactionではなく、Firestore triggerを挟む非同期処理である。
- 非請求→請求のaddはBillingをfetch後、単一create/updateするがtransactionを使わない。既存配列では同じOperationResult IDを除去してから追加する。
- 請求→請求でbilling keyが変わる移動だけは、旧Billing除去と新Billing追加を共通transactionで行う。同一keyの置換はtransactionを使わない。
- 日付・勤務区分・現場変更でgroupKeyが変わるとbeforeUpdateがSiteからcustomerIdと有効agreementを再取得する。agreementだけの変更ではこの自動再適用は走らない。

## 失敗・再試行

- OperationResult update成功後にFunctionsが失敗すると、実績は請求可能でもBilling集約に未反映という部分状態になる。画面は後続trigger完了を待たない。
- 非請求→請求addは同じOperationResult IDを置換してからpushするため再実行時の配列重複を抑えるが、同時実行のlost updateはtransaction非使用のため未検証である。
- Billing key移動はtransaction内なので旧・新集約間はatomicである。ただし元OperationResult updateとは別commitである。
- UI managerのloading・error表示・二重submit防止は基底AirItemManagerに依存する。SPEC-DEEP-029では、`OperationBillingManager`が宣言した`customInput`をAirItemManagerへ渡さず、各activatorがexposeするBase/Agreement/Adjust入力にも参照経路がないことを確認した。このため専用入力componentの実到達性は静的に確認できず、AirItemManager fallback/runtimeを未確認とする。lock toggleはglobal loadingを使いerrorをloggerへ渡すがbuttonへdisabledは結線しない。

## 既存請求・無効取極め・日付/勤務区分

- AgreementSelectはSiteのagreementsV2全件を候補にし、OperationResultの日付以前・同じshiftTypeへfilterしない。選択したagreementはsetterがkeyだけ比較して受け入れる。この非制限は2026-08-11に承認された現行方針である。
- 日付・勤務区分を稼働概要から変更した場合はgroupKey変更としてSiteの `getValidAgreement` が再適用される。一方、取極めcardからは将来開始・異なる勤務区分の取極めも選択可能である。
- isLockedでも請求稼働管理から編集でき、Billing key変更なら既存集約から移動する。
- `allowEmptyAgreement` はOperationBillingのJSDocだけに残りfield/APIはない。実際の非請求状態はbillingDateAt/customerIdにより判定する。

## 仕様との一致

- 月次一覧、model、専用入力component、Functionsには、agreementまたは請求締日を設定してBillingへ追加する後日回復契約が存在する。一方、専用入力componentのManager結線が欠けるため、現行詳細routeのend-to-end到達性は未確認である。
- 取極め候補を適用日・勤務区分で絞らないUIは承認済みの現行方針と一致する。
- modelは取極めなしでも請求日とuseAdjustedの数量・単価を保存して請求対象にでき、承認済み方針と一致する。専用入力UIの到達性は一致未確認である。
- OperationBillingを別documentとして直接createせず、元OperationResult更新を正本としてBilling集約へ反映する責務分離と一致する。
- locked実績を請求稼働管理から編集できる実装は、OperationBilling classの明示的overrideと一致する。

## 矛盾・未使用候補

- `allowEmptyAgreement` のJSDocは実装に存在しないflagを説明する。
- 一覧toolbarはplus buttonで `toCreate()` を呼ぶが、managerとschemaはいずれもcreateを明示的に拒否するため、到達可能な失敗操作である。
- page accessは `billings:read` だけだが画面はupdate・lock切替を提供し、Rulesは同社認証ユーザー全員のwriteを許す。いずれも暫定実装であり正式権限は未決である。
- AgreementSelectの候補は有効日・勤務区分で絞られず、自動 `getValidAgreement` と選択基準は異なるが、手動選択では非制限とする方針が承認済みである。
- 調整数量・単価fieldのvalidatorはnumber型を検査するが、負数を拒否しない。残業時間は15分単位を検査するが負の15分倍数も通る。
- `OperationBillingManager.customInput`と3 activatorのexposed `customInput`はAirItemManagerへ結線されていない。既存の入力・copy契約はcomponent内に存在するが、現行詳細pageから専用dialogへ到達することは静的に確認できない（FUT-0174）。

## 仮説

- 同じBilling集約へ複数OperationResultを同時追加・更新すると、transactionを使わないread-modify-writeで一方の配列更新が失われる可能性がある。
- Functions失敗後に同じOperationResultを内容変更なしで再保存できればtrigger再実行で回復できる可能性があるが、正式な再処理UI・運用は未確認である。

## 将来要対応

- 実在しないallowEmptyAgreement commentを削除し、agreementなし＋請求締日手動設定を含む実契約を文書化する（FUT-0029）。
- read permissionだけで更新UIへ到達する認可境界を仕様化・検証する（FUT-0031）。
- Agreement候補の非制限は承認済みとして維持し、必要なら通常適用外であることの任意警告だけを将来検討する（FUT-0032）。
- 無効なplus actionを除去し、非transaction集約更新の競合とtrigger再調整を検証する（FUT-0033、FUT-0030）。
- 手動調整値の許容範囲を決め、負数等のvalidationを追加する（FUT-0034）。
- Managerから専用custom-inputを明示的に結線し、Base/Agreement/Adjustの各cardが意図した入力を開くcomponent testを追加する（FUT-0174）。

## 質問

- なし。正式な権限分割と手動調整値の許容範囲は将来の仕様決定事項として分離した。

## 未確認範囲

- Firestore Rules、AirItemManager fallback、実際に開く入力component、確認dialog・二重submit防止・error表示。
- Billing集約後の請求書、取引先請求、PDF、税計算。
- Functions retry設定、同時更新、部分失敗のEmulator検証、再調整運用。
- Agreement管理自体と既存取極めの変更・削除影響。
