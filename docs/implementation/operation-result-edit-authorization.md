# 稼働実績編集のserver認可

## メタデータ

- 状態: Dev反映・正常経路受入れ済み
- 対象checkpoint: `FGA-06-RESULT-EDIT-NORMAL-AUTH-02`
- 最終確認日: 2026-09-12
- 根拠file: `functions/apis/saveOperation.js`、`functions/modules/auth/resolveCallableAuthIdentity.js`、`functions/modules/operations/saveOperation.js`、`functions/shared/operationWriteContract.js`、関連domain test
- 関連仕様: [テナントと認証](../specification.md#テナントと認証)、[エラーと整合性](../specification.md#エラーと整合性)

## 現在の認可境界

`saveOperation` Callableは、受理されたAuthentication、確認済みemail、現在のAuthentication User、正常なcompany claim、同じcompanyの有効な本登録Userを照合する。`result/overview`による基本情報変更と、`result/workers`による従業員・外注先明細の追加・変更・削除・並べ替えだけは、role、permission、会社管理者、super-user区分をallow条件にせず許可する。

次の操作はtenant共通編集へ含めず、既存のserver actor条件を維持する。

- 稼働実績の`create`、`duplicate`、`delete`
- 稼働外売上を扱う`result/articles`
- 取極め、調整、lock等の`billing`操作
- 現場稼働予定からの`convert`と配置通知の`notify`

clientのroute・button・role差はUXとして維持しており、このcheckpointでは変更していない。Firestore RulesによるOperationResult直接writeも変更していない。

## 保存と整合性

`saveOperation`はtransaction開始前とtransaction内でidentityを照合し直し、actor company配下のUserと対象documentを読む。既存documentの編集ではclientが送った`expected`をtransaction内の最新状態と比較し、不一致を`aborted`で拒否する。`isLocked`がtrue、またはbooleanでない実績は基本情報・worker編集を更新前に拒否する。

許可されたcommandと拒否対象commandが同じrequestへ混在した場合は、全commandの認可完了前にwriteへ進まないためrequest全体を不保存にする。対象documentのaudit field、計算値、transaction write、OperationResult commit後に勤怠・請求・SiteEmployeeHistory等を同期する既存trigger経路は変更していない。後続trigger間が単一transactionではない既存境界も変更していない。

## 互換性・data・rollback

schema、保存field、document path、Firestore Rules、UI、既存dataを変更していないためdata migrationは不要である。rollbackは製品commit `d759409c63b5fbbeb9f9814488f50e5382571278`をrevertし、FunctionsをGitHub ActionsでDevへ再反映する。

## 検証と未確認範囲

許可・拒否・tenant・User状態・identity再照合・lock・最新状態・batch atomicityはdomain testと独立security reviewで確認した。実行結果は[Local検証記録](../verification/fga-06-result-edit-normal-auth-local.md)を参照する。release commit `4bd80e3f1bf96ad888b2f6721111e5d0e06fdad0`をFunctionsへDev反映し、認証済みChromeで基本情報の備考変更と再表示を確認した。[Dev受入れ記録](../verification/fga-06-result-edit-normal-auth-dev.md)を参照する。

別actor、roleを持たないUser、別tenant、無効・仮User、lock中・競合時の拒否、従業員・外注先明細編集、applicationを介さないrequestはDevで再実行していない。これらはLocal自動検証を正とする。Firestore Dev targetのedition freshness、派生documentとtrigger log、Prodは未確認である。本変更はedition固有API、query、Rulesへ依存しない。
