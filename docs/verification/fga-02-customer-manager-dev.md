# FGA-02 Customer Manager Dev反映・受入れ記録

- 状態: Immutable receipt
- 実施日: 2026-09-10 JST
- Checkpoint: `FGA-02-CUSTOMER-MANAGER-DEV-16`
- Release commit: `2eeb502bf163a5952f24a02a2e2f5da58ac26df6`
- Firebase project / database: `air-guard-v2-dev` / `(default)`
- GitHub Actions: [Dev deployment #10](https://github.com/shisyamo4131/air-guard-v2/actions/runs/34449559514)
- 対象service: Hosting
- Release class: governance、application logic、UI、build/release/deployのunion

## 目的と範囲

Customerの単数・複数形Manager訂正と、Firestore上の通常master dataへ一般化したManager governanceを固定commitでDevへ反映した。Customer一覧のCREATE、一覧選択から詳細への遷移、詳細UPDATE、通常編集dialogの最大幅480px、listener表示正本を会社管理者の通常画面で確認した。

Company、User、Auth、Rules、Functions、Firestore indexes、Schemas package、Prod、account権限は変更していない。data migration、全件scan、maintenance、追加backupは行っていない。Dev試験tenantでは利用者の承認に基づき合成Customerを1件作成し、同じCustomerを1回更新した。archive、restore、physical delete、generic deleteは実行していない。

## Releaseと自動検証

`codex/fga02-customer-document-lww`の7 commitを、既知のremote `main`先端`db30c51386a18c26ce199125653a6ad9b622a8da`へno-ff mergeし、merge commitを`main`へpushした。push前後のprimary repositoryはcleanで、GitHub Actions run #10はcommit `2eeb502`からHostingだけを選択し、selector job 6秒、deploy job 1分15秒、run全体1分28秒でSuccessとなった。

| Gate | Command | 結果 | Exit status |
|---|---|---|---:|
| domain-full | `node --test test/domain/*.test.mjs` | 1,577 / 1,577成功 | 0 |
| managed-governance | `pwsh -NoProfile -File scripts/check-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2` | managed hash、生成物、policy整合成功 | 0 |
| project-docs | `pwsh -NoProfile -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` | 成功 | 0 |
| project-docs-negative | `pwsh -NoProfile -File scripts/test-project-docs-check.ps1` | 全fixtureが期待結果 | 0 |
| capacity-regression | `pwsh -NoProfile -File scripts/test-codex-session-size.ps1` | 7 checks成功 | 0 |
| diff-check | `git diff --check` | errorなし | 0 |
| generate-dev | `npm run generate:dev` | Dev Hosting artifact生成成功 | 0 |

`generate:dev`では既知のBrowserslist、chunk size、source map、PWA glob警告が出たが、生成はexit 0で完了した。release commitを固定した後の証拠文書だけの変更はapplication build・domain検証を失効させない。文書gateとdiff-checkは証拠追加後の最終状態で再実行し、いずれもexit 0だった。

## ChromeによるDev受入れ

利用者が会社管理者でsign-in済みの外部Chromeを使用した。利用者指示どおり、Dev Customer画面での最初の操作は再読込とした。

| 操作 | 観測結果 |
|---|---|
| Customer一覧 | 既存の合成Customer `FGA02001`を表示した |
| 一覧のplus button | `CustomersManager`の新規登録dialogを開いた。overlay contentは実測幅480px、CSS `max-width: 480px`だった |
| 新規登録 | code `FGA02MGR02`、名称`FGA02 Manager Dev検証`の合成Customerを登録し、一覧件数が1件から2件になって新規行が表示された |
| 一覧行のedit | 一覧内dialogを開かず`/customers/{id}`へ遷移した。`CustomersManager`／AirArrayManagerの`beforeEdit`による詳細navigationを確認した |
| 詳細の基本情報edit | 単数`CustomerManager`のUPDATE dialogを開いた。overlay contentは実測幅480px、CSS `max-width: 480px`だった |
| 更新 | 支店名を`Dev確認支店`へ更新するとdialogが閉じ、詳細表示へ値が反映された。再読込後も同じ値が表示された |

作成後と更新後の表示は画面のlistener経路で確認した。再読込後の表示でも永続化を確認した。作成した合成Customerは後続確認用にactiveのまま保持する。

ブラウザconsoleには同一文面のmessage-channel closed errorが9件あった。Firestore、Vue、Nuxtまたは製品sourceを指すstack・messageではなく、ブラウザ拡張の非同期message処理に典型的な文面であったため、拡張由来の可能性が高いと判断した。原因を拡張へ確定する独立検査は行っておらず、アプリ由来のerrorは観測しなかったという範囲に限定する。

## 未検証・残存risk・rollback

- 現行製品routeにAutocompleteの`creatable` callerがないため、Autocomplete内の単数`CustomerManager` CREATEはruntime未確認である。source contractと自動testの成功をDev UI証拠へ読み替えない。
- Devでは未認証、無効・仮User、他tenant、失敗経路、archive、restore、physical deleteを操作していない。認可境界の既存自動検証を今回の正常系UI受入れと区別する。
- releaseはHostingだけで、Rules、Functions、Firestore indexes、data形状を変更していない。Prodへは反映していない。
- code rollbackの既知の直前`main`は`db30c51386a18c26ce199125653a6ad9b622a8da`である。障害時は自動rollbackせず、影響を確認して承認済みforward correctionまたはmerge revertを使う。code rollbackは今回作成した合成Customerを自動削除・復元しない。

## 結論

`CustomersManager`の一覧CREATEと`beforeEdit`詳細navigation、`CustomerManager`の詳細UPDATE、480px dialog、listener反映は固定commitのDevで受入れ完了とする。`FGA-02-CUSTOMERS-MANAGER-03`は完了できる。Autocomplete runtimeが未確認のため`FGA-02-CUSTOMER-MANAGER-02`、失敗経路・archive実行を含む`FGA-02-CUSTOMER-LOCAL-05`、archive checkpoint、FGA-02 Customer全体は継続中である。
