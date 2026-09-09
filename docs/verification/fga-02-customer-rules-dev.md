# FGA-02 Customer Rules Dev反映・受入れ記録

- 状態: 完了
- 実施日: 2026-09-09 JST
- Checkpoint: `FGA-02-DEV-01`
- Release commit: `3c67a95e150ddcb602d754712b24f27cb6ec4877`
- Firebase project / database: `air-guard-v2-dev` / `(default)`
- GitHub Actions: [Dev deployment #8](https://github.com/shisyamo4131/air-guard-v2/actions/runs/34337660520)
- 対象service: Firestore、Hosting
- Release class: data-contract-schema-migration、application-logic、build-release-deployのunion

## 目的と範囲

Customer通常CRUDのFirestore Rulesを、role・permissionではなく、受理された認証token、確認済みemail、有効な本登録User、同一tenant、保存documentのactor UIDで許可する境界へ簡素化した固定commitをDevへ反映した。active Customerのclient delete、`Customers_archive`のclient read/write、同ID tombstone後の再作成拒否は維持する。Company、User、Functions、Storage、Realtime Database、Prod、data migration、account権限は変更していない。

`main...release commit`の変更fileを正式classifierへ渡すと`firestore,hosting`が選択された。`utils/customer/customerDocumentContract.js`の説明更新がHosting対象になるため、利用者へRules単独ではないことを示し、`main`のfast-forward、push、FirestoreとHostingのDev自動反映について明示承認を得た。

## Preflightとrelease

| 確認 | 結果 |
|---|---|
| repository / worktree | primary repositoryだけを使用し、release前後ともclean |
| branch / commit | `codex/foundational-governance-alignment`の固定commitを`main`へfast-forward。local・remote `main`がrelease commitと一致 |
| Dev database | Firebase CLI 15.29.0で`air-guard-v2-dev/databases/(default)`、Standard Edition、`asia-northeast1`、PITR有効をread-only確認 |
| data impact | deploy自体のdata変換なし。全件scan、migration、snapshot、maintenanceなし |
| backup | data変換がないため追加snapshotなし。rollbackは承認済みの既知sourceからのforward releaseを使い、自動rollbackしない |
| maintenance-required | false |
| approved migration / repair | なし |
| stop conditions | repository・commit・clean・Dev識別子・service選択の不一致、固定設定・認証・dry-run・deploy・remote正常経路の失敗、対象外service／data変更があれば停止 |
| Hosting基準 | 反映前release `50dc56`、2026-09-09 14:57、GitHub Actions operator |
| local Dev build | `npm run generate:dev` 成功、exit 0。既知のchunk、source map、PWA glob警告はあるが生成完了 |

変更後の固定commitでは、sourceを変更していない先行証拠を再利用した。release後の記録追加で失効した文書系gateは最終状態で再実行した。

| Gate | Command | 結果 | Exit status |
|---|---|---|---:|
| domain-full | `node --test test/domain/*.test.mjs` | 1577 / 1577成功 | 0 |
| local-emulator-suite | `npm run test:local` | 182 / 182成功 | 0 |
| project-docs | `pwsh -NoProfile -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` | 286 Markdown、67 ADR、12 roadmap、8 TOML成功 | 0 |
| project-docs-negative | `pwsh -NoProfile -File scripts/test-project-docs-check.ps1` | 全fixtureが期待結果 | 0 |
| capacity-regression | `pwsh -NoProfile -File scripts/test-codex-session-size.ps1` | 7 checks成功 | 0 |
| managed-governance | `pwsh -NoProfile -File scripts/check-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2` | managed hash、生成物、policy整合成功 | 0 |
| diff-check | `git diff --check` | errorなし。Windows改行変換警告のみ | 0 |
| generate-dev | `npm run generate:dev` | Dev Hosting artifact生成成功 | 0 |

release前のsource editはなく、Dev生成後もworktreeはcleanだった。

`git push origin main`はexit 0。Actions run #8はcommit `3c67a95e`から`firestore,hosting`だけを選択し、固定Dev設定、Hosting依存install・`generate:dev`、鍵なし認証、Firebase CLI 15.29.0、dry-run、実deployを完了してSuccessとなった。Rules compilerは既存helperに警告を出したが、Rules本文はcompile成功し、Firestore indexes、Rules、Hostingの反映が完了した。Functions等の非対象serviceはdeployしていない。

## Remote検証

### Hosting

- Firebase Consoleで新しいcurrent release `60997c`、2026-09-09 18:59、GitHub Actions operatorを確認した。
- `Invoke-WebRequest -Uri 'https://air-guard-v2-dev.web.app/' -Method Head`はHTTP 200、`text/html; charset=utf-8`、`no-store, must-revalidate, no-cache`、exit 0だった。
- 利用者が会社管理者でsign-in済みのChromeを再読込し、dashboardとCustomer一覧へ到達した。

### Customer正常経路

検証tenant内で次の合成Customerを通常画面から作成した。

| 項目 | 値 |
|---|---|
| document ID | `Rbs3bOhF3Aqn5H7WUgkO` |
| code / 名称 | `FGA02001` / `FGA02 Dev検証取引先` |
| 略称 / カナ | `FGA02検証` / `エフジーエーゼロニデブケンショウ` |
| 住所 | 東京都新宿区西新宿2丁目8番1号 |
| 支払条件 | 月末締め・翌月月末 |

登録後、一覧へ1件がlistener反映され、詳細画面で保存値を確認した。基本情報editorから備考を`FGA-02-DEV-01 作成確認`から`FGA-02-DEV-01 更新確認`へ変更して保存し、画面再読込後にも更新値が表示された。作成・更新・再取得はいずれも成功し、権限変更、archive、delete、Site・Billing作成は行っていない。利用者指示と既存Dev試験tenantの保持方針に従い、この合成Customerは後続確認用に保持する。

### 拒否経路と保証範囲

未認証、無効・仮User、他tenant、UID偽装、active delete、archive直接access、tombstone再作成の拒否は同じcommitのLocal Emulator 182件に含まれる。実Devでは会社管理者の正常経路だけを確認し、他tenant tokenや権限変更を必要とする直接拒否probeは行っていない。画面上の管理者UXをserver認可の証拠にはしていない。

## Review、残存risk、rollback

独立security reviewは新しいblocking findingなしのGOとした。採用済み方針により、有効な同一tenant Userが正規application writerを迂回するとCustomerへschema・型・長さ・状態・派生fieldの不正値を保存できる余地がある。これはRulesで重複検証しない設計に伴う受容済みriskであり、Schemas packageと正規writerを主な防止境界とする。`uid`は所有者固定fieldではなく、最後に保存したactorを表す。

障害時はdataを推測修復せず、まず正常経路を停止して状態を再取得する。Hostingの直前releaseは`50dc56`、code上の直前mainは`9a5755e7679a3a4ac475fce57d538797b1071a95`である。旧Rulesへ戻すとCustomer権限が再び狭まり、旧Hostingだけへ戻すとwriter互換が変わり得るため、自動rollbackは行わず、対象serviceと影響を再承認したforward releaseを使う。

## 結論と次の位置

FGA-02の最初の小checkpointであるCustomer Rules簡素化は、仕様・実装・自動検証・独立review・固定commitのDev反映・会社管理者の作成更新受入れまで完了した。FGA-02 Customer管理全体は未完了であり、次はdocument単位last-write-wins、Manager利用、listener正本、roleをUXだけにするapplication/UI側の変更範囲を小checkpointとして利用者と合意する。
