# FGA-05 Outsourcer Manager・document LWW Dev反映記録

- Checkpoint: `FGA-05-OUTSOURCER-MANAGER-LWW-01`
- 実施日: 2026-09-12（Asia/Tokyo）
- 製品commit: `fed8449e`
- release commit: `dc6c6b764721c8b43d81f237a67d5ea23a0d63be`
- Firebase project: `air-guard-v2-dev`
- 状態: Firestore Rules・HostingのDev反映と、認証済みChromeによる通常操作の受入れ完了

## 反映範囲

- Outsourcerの単数・複数形Manager、通常CREATE・UPDATE、1〜40文字検索をHostingへ反映した。
- 同一tenantの有効な本登録Userへrole非依存で通常保存を許可し、actor UID、tenant、active／registered、live delete、archive writeの境界をFirestore Rulesへ反映した。
- Functions、schema package、既存documentの一括変換、migration、IAM、Storage、Realtime Database、Prodは変更していない。

## GitHub Actions結果

- [Dev deployment #27](https://github.com/shisyamo4131/air-guard-v2/actions/runs/34667869180)はpushで起動し、commit `dc6c6b7`を対象に1分36秒で成功した。
- service選択jobのsummaryは`firestore,hosting`だった。固定Dev構成確認、Hosting依存導入、Dev生成、keyless認証、Firebase CLI確認、dry-run、選択serviceのdeployが完了した。
- Functionsのinstall stepは対象外として実行されず、Functionの追加・更新・削除は行われていない。

## Release前検証

Local実装の自動検証は[Local検証記録](fga-05-outsourcer-manager-lww-local.md)を正とする。release前の固定sourceで`npm run generate:dev`が成功し、exit status 0を確認した。

## 認証済みChromeによるDev受入れ

Codex専用合成tenantの管理者sessionで`/outsourcers/`を開き、次を通常UIから確認した。

1. 合成Outsourcer `FGA05D0912 / 検証協力会社 / 検証外注`を作成した。作成画面に契約状態の入力はなく、保存後は一覧へ即時反映された。
2. 編集画面に契約状態が表示されることを確認し、備考を`FGA-05 Dev 更新・再読込確認`へ更新して契約状態を`契約終了`へ変更した。
3. 画面再読込後、code、名称、カナ、略称、契約終了、更新済み備考が再表示された。
4. 1文字`検`の検索で合成Outsourcerだけに絞り込まれ、検索解除で通常一覧へ戻った。
5. 一覧、作成・編集dialog、保存後表示に明確な崩れやerror表示は確認されなかった。

合成Outsourcerは契約終了状態で残した。archive、restore、delete、別tenant、別actor、applicationを介さないrequest、配置・通知・実績・請求・帳票は操作していない。これらは変更対象外またはLocal自動検証で境界を確認した経路であり、今回の通常作成・更新の受入れを妨げない。

## Rollback

FGA-05前の既知commit `5ecfb5778f8207761765e962ef13c932e233112f`を基準に製品変更をrevertし、Firestore Rules・HostingをGitHub ActionsでDevへ再反映する。data shapeとmigrationは変更していないためdata rollbackは不要である。
