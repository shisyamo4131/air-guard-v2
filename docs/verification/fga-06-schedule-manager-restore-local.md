# FGA-06 現場稼働予定Manager復元 Local検証記録

## 対象

- checkpoint: `FGA-06-SCHEDULE-MANAGER-RESTORE-09`
- 固定製品commit: `c3439f2de115a82ca29fb23da63275342530ac37`
- branch: `main`
- 検証日: 2026-09-14
- change class: `ui-css-layout`、`application-logic`、`data-contract-schema-migration`
- Local Firebase project: `demo-air-guard-v2-codex`
- 確認したDev Firestore target: project `air-guard-v2-dev`、database `(default)`、location `asia-northeast1`。読取り確認だけで変更していない

## 実装した境界

- 現場稼働予定の単数・複数Manager、配置作業員、複製、配置画面の保存を`AirItemManager`／`AirArrayManager`と`SiteOperationSchedule` modelへ戻した。
- 通常の作成・更新・削除・並べ替え・通知は正規画面から`saveOperation`へ送らず、modelの既存保存を使う。
- Rulesは`SiteOperationSchedules`と`ArrangementNotifications`を、同じ会社の有効な本登録Userによる通常read/writeへ簡素化した。未認証、User不在、仮登録、無効User、claim不正、他tenant、nested pathは拒否する。
- 予定から実績への確定は既存server処理を維持した。schema package、data shape、migration、既存data、Dev・Prodは変更していない。

## 実行結果

| command | 結果 | exit status |
|---|---|---:|
| `node --test test/domain/*.test.mjs` | 1434/1434 pass | 0 |
| `npm run test:local` | 178/178 pass。Codex専用demo project、loopback、合成data。利用者保存data不変 | 0 |
| `pwsh -NoProfile -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` | 319 Markdown、73 ADR、12 roadmaps、8 TOML pass | 0 |
| `git diff --check` | errorなし | 0 |
| `npm run test:local:ui:build` | 固定製品commit `c3439f2d`のclient／server build成功 | 0 |

初回の全domain実行は、旧Callable、Site revision、専用handler拒否を正しいものとしていた20件が失敗した。標準model保存と新しいtenant境界を検証する内容へ置換し、最終実行1434件を終了コード0で確認した。

初回の全Emulator実行は、旧Schedule／ArrangementNotification Rulesを前提にした2件が失敗した。通常tenant CRUDへ期待値を直した後、最終実行178件を終了コード0で確認した。

最初の専用UI buildはsandbox内のWindows `readlink`拒否でserver buildが停止した。同じ固定製品commitを権限昇格して再実行し、client／server buildを終了コード0で確認した。Browserslist data経過、chunk size、sourcemap、Node export mappingの警告は既存build警告であり、build失敗ではない。

## Security Rules監査

```json
{
  "auth_policy_summary": "有効な本登録Userだけを認証UIDとUser documentで確認し、同じcompanyIdの予定・通知に限定する",
  "tenant_isolation": "未認証、User不在、仮登録、無効User、claim不正、他tenantを拒否する。fallbackから明示collectionを除外し、nested pathも拒否する",
  "role_model": "予定と通知の通常業務はrole非依存。会社管理者やsuper-userを追加条件にしない",
  "field_level_protection": "通常field、live Site、maintenance、実績化済み状態はRulesで検査せずmodelが所有する",
  "server_only_operations": "予定から実績への確定、Site archive、請求等の別operationは既存の個別境界を維持する",
  "query_compatibility": "既存の日付範囲queryと予定・通知document pathにRulesの追加query条件はない",
  "red_team_findings": [
    "同じtenantの有効Userは正規applicationを介さず予定・通知のfieldを変更できる",
    "同じtenantの有効Userは実績化済み予定の変更・削除をmodel外から実行できる",
    "これはtenant内通常業務を信頼しmodelへvalidationを集約する明示方針に伴う既知riskであり、強化済みとは扱わない"
  ],
  "result": "利用者が指定した単純なtenant境界と一致。広い共有前に再確認が必要"
}
```

## 未実施・残存risk

- Dev反映、Dev／Localの正規画面操作、見た目確認、remote Trigger log確認は未実施。
- 利用者報告の配置管理エラーと上下番確定エラーは未再現・未修正であり、今回の復元で直ったとは扱わない。
- 同じtenant内の直接書込みはmodelの入力確認を迂回できる。意図的に受容した簡素化riskであり、tenant分離まで緩和したものではない。
- 旧`saveOperation`の予定分岐と専用補助codeは到達不能な互換codeとして残る。削除は別checkpointとする。

## Rollback

このcheckpointの製品commitをrevertし、Manager、action、Rules、testを直前の専用Callable／Site revision境界へ一緒に戻す。data変換は不要である。Dev・Prodへの反映とrollbackは別承認を要する。
