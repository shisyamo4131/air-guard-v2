# FGA-02 Customer Manager簡素化 Dev反映・受入れ記録

- 状態: Immutable receipt
- 実施日: 2026-09-11 JST
- Checkpoint: `FGA-02-CUSTOMER-MANAGER-SIMPLIFICATION-DEV-22`
- Release commit: `7d82996652d2d65448cf7eff9cd7e1ecc5457ae2`
- Firebase project / database: `air-guard-v2-dev` / `(default)`
- GitHub Actions: [Dev deployment #11](https://github.com/shisyamo4131/air-guard-v2/actions/runs/34551807499)
- 対象service: Hosting
- Release class: governance、application logic、UI、build/release/deployのunion

## 目的と範囲

Customerの単数・複数形Managerをbase Air Managerの既定editor、validation、mode、error eventへ戻し、通常CREATE・UPDATEをFireModel／ClientAdapterへ直接接続した最終形をDevへ反映した。単数Managerのactivator pass-through、一覧Managerの`beforeEdit`、480px dialog、listener正本、専用Callable archiveを会社管理者の通常画面で確認した。

Rules、Functions、Firestore indexes、Schemas package、Prod、account権限は変更していない。data migration、全件scan、maintenance、追加backup、restore、physical delete、generic deleteは実行していない。Dev試験tenantでは合成Customerを1件作成・更新し、利用者のaction-time承認後に専用archiveで整理した。

## Releaseと自動検証

feature tip `7457937ec5a6d2788a603a7f90865088cc1d7149`を既知のremote `main`先端`2eeb502bf163a5952f24a02a2e2f5da58ac26df6`へno-ff mergeし、merge commit `7d82996652d2d65448cf7eff9cd7e1ecc5457ae2`を`main`へpushした。GitHub Actions run #11は同commitからHostingだけを選択し、selector job 8秒、deploy job 53秒、run全体1分8秒でSuccessとなった。

| Gate | Command | 結果 | Exit status |
|---|---|---|---:|
| domain-full | `node --test test/domain/*.test.mjs` | 1,565 / 1,565成功 | 0 |
| managed-governance | `pwsh -NoProfile -File scripts/check-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2` | managed hash、生成物、policy整合成功 | 0 |
| project-docs | `pwsh -NoProfile -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` | 最終文書状態で成功 | 0 |
| project-docs-negative | `pwsh -NoProfile -File scripts/test-project-docs-check.ps1` | 全fixtureが期待結果 | 0 |
| capacity-regression | `pwsh -NoProfile -File scripts/test-codex-session-size.ps1` | 7 checks成功 | 0 |
| diff-check | `git diff --check` | errorなし | 0 |
| generate-dev | `npm run generate:dev` | feature tipとrelease commitの双方でDev Hosting artifact生成成功 | 0 |

`generate:dev`では既知のBrowserslist、chunk size、source map、Nuxt cache driver、payload glob、SPA prerenderに関するwarningが出たが、生成はexit 0で完了した。この記録を含む後続文書変更はapplication sourceを変えないためdomain-fullとgenerate-devを失効させない。project-docsとdiff-checkは最終文書状態で再実行し、いずれもexit 0だった。

## ChromeによるDev受入れ

利用者が会社管理者でsign-in済みの外部Chromeを使用した。GitHub ActionsのSuccessを確認した後、利用者指示どおりDev Customer画面での最初の操作を再読込とした。

| 操作 | 観測結果 |
|---|---|
| 一覧CREATE | `CustomersManager`の既定新規作成dialogで合成Customer `FGA02REL11`（名称`FGA02 R11 Dev確認`）を作成した。dialogが閉じ、一覧件数が2件から3件となり新規行が表示された |
| dialog幅 | 最新releaseの一覧CREATE dialogと詳細UPDATE dialogをそれぞれ開き、`.v-overlay__content`の実測幅480px、computed `max-width: 480px`を確認した。幅確認では保存操作を行わずdialogを閉じた |
| Read・詳細遷移 | 一覧行のeditで一覧内dialogを開かず`/customers/QFcJhhDkGr80ov3vAO7C`へ遷移した。作成時の全入力値が詳細へ表示された |
| 詳細UPDATE | 単数`CustomerManager`で支店名を`更新確認支店`、備考を`Release 7d829966 update passed`へ更新した。dialogが閉じ、listener経路で詳細表示が更新された |
| archive前確認 | 詳細の稼働中Siteは0件だった。専用archive dialogに対象code・名称、参照時の拒否説明、理由入力が表示された |
| 専用archive | 理由`Dev CRUD検証で作成した合成データの整理`で実行し、`取引先をアーカイブしました。`の成功通知、一覧への遷移、件数3件から2件、対象行の消失を確認した |

この「D」は通常のFirestore deleteではなく、例外境界として定義済みの専用Callable archiveである。generic delete、restore、physical deleteの成功を示す証拠ではない。

## 未検証・残存risk・rollback

- 現行製品routeにAutocompleteの`creatable` callerがないため、Autocomplete内の単数`CustomerManager` CREATEはruntime未確認である。実装・source contract・自動testは確認済みだが、到達不能な未提供経路をDev UI成功へ読み替えない。現行のCustomer製品操作を妨げる未完了機能ではないため、FGA-02の阻害条件にはしない。
- 未認証、無効・仮User、他tenant、参照ありarchive拒否、通信失敗は今回のChrome正常系で再実行していない。既存のRules、Callable、client error・single-flight・参照拒否の自動検証と過去のCAS-05 Dev受入れを根拠とし、今回のUI実測と区別する。
- releaseはHostingだけで、Rules、Functions、Firestore indexes、data形状を変更していない。Prodへは反映していない。
- code rollbackの既知の直前`main`は`2eeb502bf163a5952f24a02a2e2f5da58ac26df6`である。障害時は自動rollbackせず、影響を確認して承認済みforward correctionまたはmerge revertを使う。今回の合成Customerはarchive済みであり、code rollbackでactiveへ戻さない。

## 結論

現行製品が提供するCustomerの通常CREATE・READ・UPDATE、listener表示正本、一覧・単数Managerの責務、既存の480px契約、専用archive例外を固定commitのDevで受入れた。Autocomplete CREATEは将来到達可能なcallerが追加された時点の対象として明示的に残す。FGA-02 Customer管理は完了とし、次はFGA-03 Site管理へ進む。
