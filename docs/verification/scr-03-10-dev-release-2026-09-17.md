# SCR-03〜10 Dev反映記録

- Checkpoint: `SCR-03-10-DEV-RELEASE-29`
- 実施日: 2026-09-17（Asia/Tokyo）
- Dev project: `air-guard-v2-dev`
- Firestore: `(default)` / Standard edition / Native mode
- product release commit: `55566deb4dda486689587889f8237f3ec24a210f`
- product branch tip: `d13f932c60ea1111345e84114fab2f5cd5be8fe4`
- final product content commit: `1250f8ff8ef5fb1043d00b990bb8680fd53cadb0`
- GitHub Actions: [Dev deployment 35207615314](https://github.com/shisyamo4131/air-guard-v2/actions/runs/35207615314)
- 対象service: Firestore Rules、Functions、Hosting
- 状態: Dev反映済み・Dev受入れ待ち

## Release境界と結果

`codex/scr03-10-standard-crud-prelocal`の実装を`main`へmergeし、release commit `55566deb4dda486689587889f8237f3ec24a210f`を`origin/main`へpushした。GitHub Actionsのselectorは`firestore,functions,hosting`を選択し、固定Dev設定によるHosting生成、Functions依存取得、Workload Identity Federation認証、Firebase CLI dry-run、実deployを順に成功させた。runのhead SHAはrelease commitと一致し、workflowとdeploy jobはいずれもsuccess、`gh run watch ... --exit-status`はexit status 0だった。

release classはUI・application logic・Functions・Firestore Rules・client／server contractを含む。schema migration、既存documentの変換・補完・作成・更新・削除、実data操作、IAM変更、Prod反映は行っていない。data変更を伴わないためbackupとdata rollbackは不要で、maintenance windowも設けていない。利用者所有のimport-only Emulator、Local server、Chrome sessionには触れていない。

## Release前検証

最終product treeに対して次の証拠を確認した。merge commitのtreeはproduct branch tipのtreeと一致し、merge後の`generate:dev`と文書検証も成功した。merge後にproduct sourceの変更はないため、product treeに結び付くdomain、Local Emulator、Local UI buildの成功結果を再利用した。

| gate・command / evidence | 結果 | exit status |
|---|---|---:|
| `node --test test/domain/*.test.mjs` | 1303 / 1303成功 | 0 |
| `npm run test:local` | 135 / 135成功、`loopback_only=true`、利用者保存data不変、専用保存data read-only | 0 |
| `npm run test:local:ui:build` | product commit `1250f8ff...`のsourceHead一致・成功 | 0 |
| `npm run generate:dev` | 34 routes生成・成功 | 0 |
| `pwsh -NoProfile -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` | TOML 8、Markdown 327、ADR 74、Roadmap 13 | 0 |
| `pwsh -NoProfile -File scripts/test-project-docs-check.ps1` | 全negative fixture成功 | 0 |
| `pwsh -NoProfile -File scripts/test-codex-session-size.ps1` | 7 checks成功 | 0 |
| `pwsh -NoProfile -File scripts/check-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2` | hash、renderer、policy、runtime整合 | 0 |
| `git diff --check` | 問題なし | 0 |
| merge後 `npm run generate:dev` | 34 routes生成・成功 | 0 |
| merge後 project document validator | 上記件数で成功 | 0 |
| merge後 `git diff --check` | 問題なし | 0 |

最初の`npm run test:local`はsandbox内で`EPERM`となったが、runbookに従うsandbox外の再実行は上表のとおり成功した。これは製品test失敗として扱わない。生成時のfirebase-functions更新案内、Browserslist、chunk size、sourcemap、Nitro cache-driver、PWA glob、SSR disableのwarningは残るが、いずれも今回のgateを失敗させていない。

## 旧Function撤去

実deploy前に、今回の標準CRUD委譲で不要となった次の4 FunctionsをDevから明示的に削除した。

- `archiveCustomer`
- `archiveSite`
- `reactivateSite`
- `terminateSite`

`firebase functions:delete archiveCustomer archiveSite reactivateSite terminateSite --region asia-northeast1 --project air-guard-v2-dev --force`はexit status 0で、4件すべての削除成功を返した。削除前の`functions:list`は4件すべてが存在し、総数47だった。削除後に一度だけ行った`functions:list`では4件すべてが不在で総数43だった。release後のread-only確認でも総数43と4件の不在を維持し、維持対象の`archiveEmployee`、`saveOperation`、`runDailySiteTermination`は存在した。確認commandはいずれもexit status 0だった。

復旧が必要な場合は、既知のsource revision `f3b1e01891f6a14605d17b2e7fb5c67daabec15a`から4 Functionsのexportとsourceを復元し、影響を再検証したうえで別承認のtargeted Functions deployを行う。今回、remote Functionの復旧や代替Function追加は行っていない。

## Actionsとremote read-only確認

| 確認 | 結果 | exit status |
|---|---|---:|
| `git push origin main:main` | `4b753109...55566deb main -> main` | 0 |
| `gh run watch 35207615314 --exit-status` | workflow success、deploy job success | 0 |
| Actions dry-run | Firestore Rules compile、Functions／Hosting dry-run成功 | 0 |
| Actions実deploy | Firestore Rules、Functions、Hosting deploy成功。Hosting 183 files、release complete | 0 |
| Dev Hosting root GET / HEAD | HTTP 200、`no-store, must-revalidate, no-cache` | 0 |
| Dev Hosting `/_nuxt/Do2vYbGM.js` | HTTP 200、`public, max-age=31536000, immutable` | 0 |
| Dev Hosting `/sw.js` | HTTP 200、`no-store, must-revalidate, no-cache` | 0 |
| Dev `functions:list`の限定集計 | 総数43、撤去4件不在、維持対象3件存在 | 0 |

remote確認は配信成立、cache header、Functions構成のread-only確認に限定した。Firestore Rulesのactor／tenant別の正常・拒否経路は、remote data操作を避けるため実施していない。Actions上のcompile、dry-run、deploy成功をRules反映の証拠とし、画面操作の受入れとは分ける。

## Dev受入れ待ちと残る確認

Devへの配信成功は、SCR-03〜10の製品完了やDev画面受入れ完了を意味しない。SCR-03／SCR-06／SCR-07／SCR-10はDev反映済み・Dev受入れ待ち、SCR-05は登録button非表示だけがLocal確認済みで、取極め・調整・lock・稼働外売上は未確認である。SCR-04／SCR-08／SCR-09に今回追加のDev UI evidenceはない。SCR-09の退職・誤退職訂正Callableは維持した。

Dev受入れでは、対象actor・同一tenant境界で正規画面の操作、拒否・失敗時に保存へ進まないこと、再読込後の状態、関連一覧・従属制約への影響を対象SCRごとに確認する。特にSCR-10はread-only preflight成功後のみブラウザ側Manager／Schema標準archiveへ進むことを確認する。direct SDKによるpreflight迂回可能性は合意済みの受容事項であり、one-time grant、新管理document、復元画面、旧形式復元、server-adapter、将来の段階的削除は今回の受入れへ追加しない。

SCR-03〜10の得点、製品完了状態、ロードマップ進捗20%は変更しない。現時点で新しい仕様判断はない。次の利用者操作は、[標準CRUD整合ロードマップ](../roadmaps/standard-crud-alignment.md)の完了条件に沿ったDev受入れである。

## Rollback

製品差分の復旧はrelease commit `55566deb...`とその親、product branch tip `d13f932c...`、final product content commit `1250f8ff...`を基準に、対象差分をrevertまたは既知の正常sourceへ戻して別承認のcorrective Dev releaseを行う。撤去Functionだけの復旧は前記`f3b1e018...`を基準とする。migrationと実data変更はないためdata rollbackは不要である。rollbackの実行、Prod反映、実data操作は本checkpointの範囲外である。
