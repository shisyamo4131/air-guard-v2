# 稼働実績編集のserver認可

## メタデータ

- 状態: Local実装済み・Dev未反映
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

schema、保存field、document path、Firestore Rules、UI、既存dataを変更していないためdata migrationは不要である。rollbackは`functions/shared/operationWriteContract.js`のtenant共通result edit判定と対応test・文書を直前の確認済み状態へ戻す。Devへ未反映の間はremote製品挙動に変更はない。

## 検証と未確認範囲

許可・拒否・tenant・User状態・identity再照合・lock・最新状態・batch atomicityはdomain testと独立security reviewで確認した。実行結果は[Local検証記録](../verification/fga-06-result-edit-normal-auth-local.md)を参照する。

Local Emulator、UI、build、Dev・Prod、remote Firestore、実data、deployed Functionは未確認である。Firestore Dev targetは既存記録でStandard edition / Native modeだが、今回remote freshnessを再確認していない。本変更はedition固有API、query、Rulesへ依存しない。
