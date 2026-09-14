# FGA-06 稼働実績Manager・client保存 Dev反映・受入れ記録

- Checkpoint: `FGA-06-RESULT-MANAGER-CLIENT-04`
- 実施日: 2026-09-14（Asia/Tokyo）
- 製品commit: `40316475d9a687bf14ac900bb6c9267625988298`
- 削除button補正commit: `c1148db3b22b4a7ada3d0a6eefc39258c89fbdb0`
- release commit: `138b3a29535fb639f78869cb09e465645034a437`
- Firebase project: `air-guard-v2-dev`
- 状態: HostingのDev反映と、会社管理者・統括sessionによる通常編集・見た目受入れ完了

## 反映範囲

- lockされていない既存OperationResultの基本情報を`OperationResultManager`／`AirItemManager`、従業員・外注先明細を`OperationResultWorkersManager`／`AirArrayManager`から`OperationResult.update()`の標準client保存へ接続した。
- Firestore Rulesは同一tenantの有効な本登録Userによる既存・非lock実績の限定updateを許可する状態を維持した。
- `Operation/AirEditor.vue`でdelete modeにも通常編集用`disabled`を適用し、削除確認buttonが常に無効になる問題を補正した。
- 実績作成・複製・物理削除、稼働外売上、予定、通知、実績化、請求、Functions、schema、migration、IAM、Prodの製品契約はこのreleaseで変更していない。

## GitHub Actions結果

- [Dev deployment](https://github.com/shisyamo4131/air-guard-v2/actions/runs/34796578692)はrelease commit `138b3a29535fb639f78869cb09e465645034a437`を対象に完了し、成功した。
- service selector、Deploy job、Hosting依存導入、Dev生成、keyless認証、Firebase CLI確認、dry-run、本deployが成功した。Functions依存導入はskipされ、Hostingだけが反映対象だった。

## Release前検証

固定release前に次を個別実行し、いずれもexit status 0を確認した。

- `node --test test/domain/operation-editor.test.mjs`: 35件成功
- `node --test test/domain/*.test.mjs`: 1,454件成功
- `pwsh -NoProfile -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2`: 成功
- `git diff --check`: 成功。改行警告だけでerrorなし
- `npm run generate:dev`: 成功。既知のchunk、caniuse、sourcemap、glob警告あり

FGA-06-RESULT-MANAGER-CLIENT-04本体のLocal Emulator 180件と専用UI buildは[Local検証記録](fga-06-result-manager-client-local.md)を正とする。

## 認証済みChromeによるDev受入れ

利用者が用意した同一のCodex専用tenantの会社管理者sessionと統括sessionで、通常UIから次を確認した。

1. 会社管理者で合成Outsourcer、合成Site、合成OperationResultを作成し、基本情報の備考を変更して再読込後も保持された。
2. 会社管理者で既存Employeeを作業員へ追加し、再読込後も保持された。
3. 統括で同じ実績を開き、会社管理者の変更を確認した。基本情報の備考変更、合成Outsourcer行の追加、休憩時間とOJTの変更を保存し、再読込後も保持された。
4. 既存の基本情報card・toolbar・追加button・入力dialog、作業員table、稼働外売上一覧・追加button、物理削除button・確認dialogに意図しない見た目変更がないことを確認した。lock中のruntime表示は使用した合成実績が非lockのため未実施で、source contractとLocal自動検証を正とする。
5. 更新Hostingで作業員行の削除確認buttonが有効になり、Employee行を削除できた。Employeeを再追加して保持を確認した後、Outsourcer行とEmployee行を削除し、再読込後の作業員tableが空であることを確認した。

作業員表示はEmployee配列をOutsourcer配列より先に描画する現行構成で、画面に明示的な並べ替え操作がないため、drag等による並べ替えはDevで実施していない。Local自動検証の保存契約を代替証拠とする。

## Cleanupと発見事項

- 合成OperationResultは作業員行を空にした後、会社管理者sessionから物理削除し、2026年9月の稼働実績一覧が0件であることを確認した。
- 合成Siteは通常の`現場を終了`で終了済みにし、稼働中現場一覧が0件であることを確認した。
- 合成Outsourcerは通常編集で契約終了にした。既存Customerと既存Employeeは削除・変更していない。
- Employee・Outsourcer行が残る実績の物理削除は会社管理者sessionでも汎用errorとなり、行を空にした後は成功した。原因は未特定で、現行の単体testが勤務者を持つ実績の削除成功を想定することと一致しない。Trigger logと派生document全件は直接照合していない。

## Rollback

release commitの直前のmain `6a17ead2a7ad1b2b7d413a8e01650d04be934d73`へ戻す変更を作成し、同じGitHub Actions経路でHostingをDevへ再反映する。今回のreleaseはdata shape、Functions、Rules、migrationを変更していない。受入れ用OperationResultは削除済み、SiteとOutsourcerは履歴を残す通常終了状態である。
