# FGA-06 現場稼働予定の通常C/U/D認可 Dev反映・受入れ記録

- Checkpoint: `FGA-06-SCHEDULE-NORMAL-AUTH-01`
- 実施日: 2026-09-12（Asia/Tokyo）
- 製品commit: `b478e99e7bd2316ea8641557e87342d2bba362fb`
- release commit: `d8d3c7c7230299019e57c15b4ea9bab28a3b533b`
- Firebase project: `air-guard-v2-dev`
- 状態: FunctionsのDev反映と、認証済みChromeによる通常操作の受入れ完了

## 反映範囲

- 現場稼働予定の作成・複製・基本情報変更・配置作業員変更・表示順変更・削除を、同一tenantの有効な本登録Userへroleに依存せず許可するserver認可をFunctionsへ反映した。
- `saveOperation` Callable、Auth／User／tenant確認、Site revision、関連配置通知の取消し、実績化済み予定の変更・削除拒否を維持した。
- 配置通知作成、稼働実績への確定、稼働実績・請求のactor条件、Firestore Rules、Hosting、schema、既存dataの一括変換、migration、IAM、Storage、Realtime Database、Prodは変更していない。

## GitHub Actions結果

- [Dev deployment #29](https://github.com/shisyamo4131/air-guard-v2/actions/runs/34669711506)はpushで起動し、release commit `d8d3c7c`を対象に2分34秒で成功した。
- service選択jobのsummaryは`functions`だった。`Select changed Firebase services`と`Deploy to Firebase Dev`はいずれも成功した。

## Release前検証

Local実装の自動検証は[Local検証記録](fga-06-schedule-normal-auth-local.md)を正とする。対象認可・保存契約37件、全domain 1,449件、Local Emulator 179件の成功を同記録へ固定した。

## 認証済みChromeによるDev受入れ

Codex専用合成tenantの管理者sessionで通常UIを使用し、次を確認した。

1. 合成Site `FGA06検証現場`へ、2026-09-12、08:00〜17:00、必要人数1、作業内容`FGA06 Dev確認`の現場稼働予定を作成し、Site詳細のカレンダーへ表示された。
2. 備考を`FGA06 Dev 更新確認`へ変更して保存し、再度開いた画面で変更後の値を確認した。
3. 稼働予定管理画面から2026-09-13へ複製し、12日・13日の両方へ必要人数1が表示された。
4. 13日、12日の順に更新dialogの削除操作を実行し、両日から予定が消え、稼働予定管理画面から合成Siteの行が消えた。
5. 予定0件を確認後、合成Siteを理由`FGA06 Dev検証完了`でアーカイブし、通常の稼働中現場一覧が0件へ戻った。

最初に仮登録状態の合成Siteへ予定を作成した操作は、既存の本登録Site要件により拒否された。既存の合成Customerを設定して本登録状態へ変更した後、同じ予定作成が成功した。この拒否は今回変更したrole認可ではなく、維持対象のSite状態検査によるものである。

同じ画面で確認したところ、現場稼働予定の入力中に表示される`現場を新規登録`ボタンは押しても作成dialogを開かなかった。通常の現場一覧からは3ステップ作成を実行できたため、今回の予定C/U/D受入れとは分離し、[FUT-0190](../implementation/future-actions.md#fut-0190-現場稼働予定入力内の現場新規登録を復旧する)へ未対応事項として記録した。

別actorのDev実操作、配置作業員変更・表示順変更のDev UI再実行、配置通知作成、稼働実績への確定、稼働実績・請求、別tenant、applicationを介さないrequestは実施していない。role非依存の認可、配置作業員変更・表示順変更、拒否経路はLocal自動検証を正とし、今回の正常な予定C/U/D受入れを妨げない。

## Rollback

製品commitをrevertし、FunctionsをGitHub ActionsでDevへ再反映する。data shape、Rules、migrationは変更していないためdata migration rollbackは不要である。受入れ用の予定は削除済みで、合成Siteはアーカイブ済みである。
