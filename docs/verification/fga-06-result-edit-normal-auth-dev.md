# FGA-06 稼働実績の通常編集認可 Dev反映・受入れ記録

- Checkpoint: `FGA-06-RESULT-EDIT-NORMAL-AUTH-02`
- 実施日: 2026-09-12（Asia/Tokyo）
- 製品commit: `d759409c63b5fbbeb9f9814488f50e5382571278`
- release commit: `4bd80e3f1bf96ad888b2f6721111e5d0e06fdad0`
- Firebase project: `air-guard-v2-dev`
- 状態: FunctionsのDev反映と、認証済みChromeによる基本情報編集の正常経路受入れ完了

## 反映範囲

- lockされていない既存OperationResultの`result/overview`と`result/workers`を、同じtenantの有効な本登録Userへroleに依存せず許可するserver認可をFunctionsへ反映した。
- `saveOperation` Callable、Auth／User／tenant確認、transaction内の最新状態との照合、lock拒否、関連document更新を維持した。
- 実績の作成・複製・削除、予定からの確定、配置通知、稼働外売上、請求操作、Firestore Rules、Hosting、schema、migration、IAM、Prodは変更していない。

## GitHub Actions結果

- [Dev deployment #30](https://github.com/shisyamo4131/air-guard-v2/actions/runs/34674839836)はpushで起動し、release commit `4bd80e3`を対象に2分39秒で成功した。
- service選択jobのsummaryは`functions`だった。deploy jobは2分27秒で成功し、Firebase CLI 15.29.0のdry-runで`functions`だけを選択して`Dry run complete!`、本反映で`saveOperation`を含むFunctionsの更新成功を確認した。Function削除はなかった。

## Release前検証

Local実装の自動検証は[Local検証記録](fga-06-result-edit-normal-auth-local.md)を正とする。対象認可・保存契約37件、client boundary parity 4件、全domain 1,453件、project docs、否定fixture、session容量回帰、managed governance、diff checkの成功を同記録とrelease preflightで確認した。

## 認証済みChromeによるDev受入れ

Codex専用合成tenantの管理者sessionで通常UIを使用し、次を確認した。

1. 既存の合成Customer `FGA02 Dev検証取引先`を選び、合成Site `FGA06実績編集検証現場`を作成した。
2. 2026-09-12、08:00〜17:00、必要人数1、作業内容`FGA06 結果編集 Dev確認`、備考`FGA06 作成時`のOperationResultを作成し、詳細画面へ同じ値が表示された。
3. 基本情報editorで備考だけを`FGA06 編集後`へ変更して保存し、閉じた後の詳細画面で変更後の値を確認した。これは固定release commitで動く`saveOperation`の`result/overview`正常経路を通した受入れである。
4. 受入れ用OperationResultを削除し、2026年9月の稼働実績一覧が0件へ戻ったことを確認した。
5. 合成Siteを理由`FGA06 Dev検証完了`でアーカイブし、稼働中現場一覧が0件へ戻ったことを確認した。Site archive記録は製品契約どおり保持される。

実績の作成・削除とSite archiveは受入れ準備・cleanupとして既存の管理者境界で実行しており、今回のtenant共通編集認可の証拠には含めない。別actor、roleを持たないUser、別tenant、無効・仮User、lock中・競合時の拒否、従業員・外注先明細編集、applicationを介さないrequestはDevで再実行していない。role非依存、`result/workers`、拒否経路、batch atomicityはLocal自動検証を正とする。

請求・勤怠・SiteEmployeeHistory等の派生documentとtrigger logは受入れ後に直接照合していない。作成したOperationResultにはworkerと稼働外売上がなく、画面上の実績は削除済みだが、派生collectionの一時生成・cleanup全体を保証する証拠にはしない。Rules、Hosting、schema、migration、IAM、Prodは操作していない。

## Rollback

製品commitをrevertし、FunctionsをGitHub ActionsでDevへ再反映する。data shape、Rules、migrationは変更していないためdata migration rollbackは不要である。受入れ用OperationResultは削除済みで、合成Siteはアーカイブ済みである。
