# FGA-03 Site Manager・document LWW Dev反映・受入れ記録

## Release

- Checkpoint: `FGA-03-SITE-MANAGER-LWW-05`
- 実施日: 2026-09-11
- Release commit: `7a13d151f3ad6bd2e68d021cd0f7ecd6e3a630e6`
- Firebase project: `air-guard-v2-dev`
- GitHub Actions: [Dev deployment #13](https://github.com/shisyamo4131/air-guard-v2/actions/runs/34571134726)
- 後続の文書commit `33bd21ddabd2a28070b9eea21c4d78d9aececb28`は[GitHub Actions #14](https://github.com/shisyamo4131/air-guard-v2/actions/runs/34574050747)で成功し、Firebase対象serviceなしとしてdeployを省略した。追加受入れも#13の同一製品artifactに対して実施した
- 自動選択service: Firestore、Functions、Hosting
- 結果: 成功。選択job 8秒、deploy job 3分39秒
- data migration、maintenance、snapshot、IAM変更、Prod反映: なし
- rollback baseline: `c5a7eaf6f57aa238787a7e6360076289ae0e0c0f`。必要時は別承認で既知の正常commitを再releaseする

## Release前検証

| Gate | 結果 | Exit status |
|---|---|---:|
| `node --test test/domain/*.test.mjs` | 1,549件成功 | 0 |
| `npm run test:local` | 182件成功 | 0 |
| `npm run generate:dev` | Dev用静的生成成功 | 0 |
| `pwsh -NoProfile -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` | 成功 | 0 |
| `pwsh -NoProfile -File scripts/check-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2` | 成功 | 0 |
| `pwsh -NoProfile -File scripts/test-project-docs-check.ps1` | 全異常系fixture成功 | 0 |
| `pwsh -NoProfile -File scripts/test-codex-session-size.ps1` | 7件成功 | 0 |
| `git diff --check` | errorなし | 0 |

domainとEmulatorの詳細は[Local検証記録](fga-03-site-manager-lww-local.md)を正とする。`local-ui-build`はverification policy上省略可能であり、同じ固定commitの`generate:dev`とDev実画面を選択した。

## Dev技術smoke

既存の認証済みChromeで会社設定画面のCodex識別を確認し、区分3のCodex専用合成tenantだけを操作した。利用者会社・協力会社・実在Customer・実在Siteは操作していない。

1. 稼働中Siteが0件の状態から3ステップ作成を開始した。
2. 取引先名へ`Codex FGA03 未登録取引先`を入力し、候補0件の案内からCustomerを選択せず次へ進めた。
3. 合成Site `FGA03DEV06`（document ID `CD0FCTrKXVTz2tsa3swg`）を通常UIから作成した。詳細で「仮登録」と取引先未設定案内を確認した。Customer documentは作成していない。
4. 単数`SiteManager`の基本情報編集で現場番号を`FGA03-DEV-06-更新`へ変更し、保存後の詳細表示へ反映された。
5. 専用終了操作を理由`Dev受入れ確認`で実行し、「終了済み」と再有効化導線を確認した。
6. 専用再有効化操作を工期2026-09-12〜2026-09-30、理由`Dev受入れ確認`で実行し、「稼働中」と更新後工期を確認した。
7. 利用者のaction-time承認後、理由`Dev受入れ合成データ整理`で専用archiveを実行した。詳細から稼働中一覧へ戻り、成功通知と0件表示を確認した。

この初回smokeでは、郵便番号検索・geocoding、Agreement、稼働予定、実績、請求、通知、Customer作成、User／Authentication、直接request、Admin SDKは使用していない。

## Dev追加技術smoke

同じCodex専用合成tenantと会社管理者sessionで、通常Siteと分離されたAgreement操作を追加確認した。

1. Customerを作成せず、取引先名だけを持つ合成Site `FGA03DEV07`（document ID `TM3Jm3k04shdALGBIh6N`）を3ステップUIから作成した。
2. 日勤Agreementを適用開始2026-09-11、09:00〜18:00、規定実働8時間、休憩1時間、月末締め、人工単位で追加した。平日単価は通常10,000／残業12,500、資格者12,000／残業15,000とし、他曜日の0円を明示確認して保存した。
3. 保存直後の詳細表示に時間・締日・請求単位・単価が反映された。編集画面を閉じてpageを再読込した後も同じ値を確認した。
4. 利用者のaction-time承認後、理由`Dev取極め受入れ合成データ整理`でSiteをarchiveした。処理完了後に稼働中一覧へ遷移し、成功通知と0件表示を確認した。Agreementの存在はarchiveを妨げなかった。

既存Chrome内に別権限accountの認証済みsessionはなかった。新規User作成、認証情報の推測、既存sessionのsign-outは行わず、別actorのDev実操作は未確認として残した。

## 結果と残余範囲

- Manager経由のCustomer未登録CREATE、通常UPDATE、listener反映、専用終了・再有効化・archiveのDev結合は成功した。
- Customer未登録Siteでも、専用Agreement操作による追加、保存直後の反映、page再読込後の再表示、Agreementを保持したままの専用archiveに成功した。
- 合成Siteはactive collectionから除外され、archive recordが残る。通常画面にrestore導線はない。
- GitHub Actions成功により固定commitのFirestore、Functions、Hosting反映を確認した。Prodは未反映である。
- Agreementの今回release後Dev実操作は確認済みである。別actorのrole非依存writeは安全に利用できる既存sessionがなく未確認である。tenant拒否とapplicationを介さないrequestは、利用者が今回想定しない範囲としてbrowser smokeでは実行していない。Local自動検証と今回の未確認範囲を区別し、別actorのDev確認が残るためFGA-03全体の完了とは扱わない。
- 利用者による見た目・操作感の主観受入れは未実施である。
