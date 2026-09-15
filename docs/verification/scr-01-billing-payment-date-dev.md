# SCR-01 入金予定日の標準CRUD Dev release記録

- Checkpoint: `SCR-01-07`
- 実施日: 2026-09-15（Asia/Tokyo）
- Dev project: `air-guard-v2-dev`
- release commit: `19e44c96141202f0a4ae0bde48f27ea4e74bf797`
- GitHub Actions: [Dev deployment 34916877308](https://github.com/shisyamo4131/air-guard-v2/actions/runs/34916877308)
- cleanup commit: `ed2887af3760af70017115fa79868157a08d2fe4`
- cleanup Actions: [Dev deployment 34917197567](https://github.com/shisyamo4131/air-guard-v2/actions/runs/34917197567)
- 状態: Completed（Dev反映・旧Function撤去・画面受入れ完了）

## Release境界と結果

- selectorは`firestore,functions,hosting`を選択した。workflowはHosting artifactを`generate:dev`で生成し、Firestore／Hostingのdry-runと実deployを行った後、`asia-northeast1`の旧Callable `updateBillingPaymentDate`を削除した。Actions run `34916877308`はrelease commitと一致し、全job・対象stepがsuccessだった。
- release classはUI・application logic・Rulesを含むclient／server同時変更と旧Function撤去。schema変更、data migration、既存documentの作成・更新・削除、backup、maintenanceはない。
- `functions:list`のpost-checkはexit status 0で、Devに47 Functionsが残り、`updateBillingPaymentDate`は存在しなかった。Dev Hosting rootはHTTP 200を返した。
- 一時的な削除stepはcleanup commitで通常workflowへ戻した。cleanup Actions runはcommitと一致してsuccessとなり、変更がworkflowだけのためFirebase対象は選ばれず、deploy jobはskipされた。
- 利用者LocalのChrome、Emulator、serverには触れていない。Prodとremote dataは対象外である。

## 確認した証拠

| command / evidence | 結果 | exit status |
|---|---|---:|
| `gh run view 34916877308 --json headSha,status,conclusion,url,jobs` | release SHA一致、completed / success。artifact生成、dry-run、Firestore／Hosting deploy、旧Function削除stepがsuccess | 0 |
| `gh run view 34917197567 --json headSha,status,conclusion,url,jobs` | cleanup SHA一致、completed / success。selector success、deploy job skipped | 0 |
| `npx -y firebase-tools@15.29.0 functions:list --project air-guard-v2-dev --json`（機密値を出さず件数・対象名だけを集計） | 47 Functions、撤去対象なし、project／region一致 | 0 |
| `curl.exe -sS -o NUL -w "%{http_code} %{url_effective}" https://air-guard-v2-dev.web.app/` | HTTP 200 | 0 |

release前のLocal検証は[SCR-01-06の実装記録](../implementation/operation-crud-simplification-inventory.md#scr-01-06-自動検証とlocal画面確認2026-09-15完了)を参照する。Actionsは固定Dev設定、鍵なし認証、Firebase CLI `15.29.0`、Hosting artifact生成、dry-runを成功させた。

## Dev画面受入れ

2026-09-15にDevの会社管理者画面で、入金予定日の変更、listenerによる自動反映、再読込後の維持、未設定への解除と再読込後の維持を確認した。確認後は元の入金予定日へ戻し、再読込後の復元も確認した。請求額等の他の表示値は変わらず、画面崩れと画面上のエラーはなかった。

請求日より前の日付を入力した操作では、入力部品の最小日付により請求日へ補正され、保存後も請求日より前にならなかった。保存処理側でも請求日前を拒否する自動testが成功しており、業務条件は維持されている。エラー表示を必須とする要件はないため、この補正動作を不具合とは扱わない。

実際のbackend停止を伴う画面確認は実施していない。保存失敗時にdialogを閉じず、編集値とloading／error状態を扱う経路は[SCR-01-06の自動test](../implementation/operation-crud-simplification-inventory.md#scr-01-06-自動検証とlocal画面確認2026-09-15完了)で成功している。利用者はこの自動testを失敗経路の受入証拠として採用し、backend停止時の失敗表示を完了条件から外した。以上によりSCR-01-07と親SCR-01を完了する。

## Rollback

既知の変更前source baseline `048e44e9cfd4ca887ec328e7e835c291579e68af`を基準に、旧Function・source・Rules・Hostingを一組で復元する別承認のcorrective releaseを行う。migrationと既存data変更はないためdata rollbackは不要である。rollback自体は本releaseの承認範囲に含まれない。
