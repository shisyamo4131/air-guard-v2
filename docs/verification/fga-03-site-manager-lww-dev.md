# FGA-03 Site Manager・document LWW Dev反映・受入れ記録

## Release

- Checkpoint: `FGA-03-SITE-MANAGER-LWW-05`
- 実施日: 2026-09-11
- Release commit: `7a13d151f3ad6bd2e68d021cd0f7ecd6e3a630e6`
- Firebase project: `air-guard-v2-dev`
- GitHub Actions: [Dev deployment #13](https://github.com/shisyamo4131/air-guard-v2/actions/runs/34571134726)
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

郵便番号検索・geocoding、Agreement、稼働予定、実績、請求、通知、Customer作成、User／Authentication、直接request、Admin SDKは使用していない。

## 結果と残余範囲

- Manager経由のCustomer未登録CREATE、通常UPDATE、listener反映、専用終了・再有効化・archiveのDev結合は成功した。
- 合成Siteはactive collectionから除外され、archive recordが残る。通常画面にrestore導線はない。
- GitHub Actions成功により固定commitのFirestore、Functions、Hosting反映を確認した。Prodは未反映である。
- Agreementの今回release後Dev実操作、別actorのrole非依存write、tenant拒否、applicationを介さないrequestは今回のbrowser smokeでは実行していない。Local自動検証と今回の未確認範囲を区別し、FGA-03全体の完了とは扱わない。
- 利用者による見た目・操作感の主観受入れは未実施である。
