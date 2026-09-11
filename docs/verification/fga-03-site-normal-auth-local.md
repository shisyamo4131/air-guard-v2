# FGA-03 Site通常認可 Local検証記録

## 対象

- Checkpoint: `FGA-03-SITE-NORMAL-AUTH-01`
- 実施日: 2026-09-11
- Repository: `C:\Users\seven\projects\AirGuard\air-guard-v2`
- Branch: `codex/fga-03-site-normal-auth`
- 基準HEAD: `c5a7eaf6f57aa238787a7e6360076289ae0e0c0f`
- 証拠状態: 基準HEAD上の未stage worktreeでLocal検証完了。commit、Dev・Prod反映、remote確認は未実施

## 確認した変更

- 通常のSite作成、基本情報・Customer・Agreement変更、手動終了・再有効化を、同一tenantの有効な認証済み本登録Userへrole非依存で許可した。
- Rulesは確認済みemail、Auth UIDとcanonical User `docId`、tenant claim・User所属tenant・path tenant、有効・本登録Userを必須とする。
- Agreementと手動終了・再有効化の専用Callable／transaction、schema・field・status・Customer・`scheduleRevision`保護を維持した。
- archiveは専用client判定と従来のstrict server actor、参照検査、監査、tombstoneを維持した。自動終了はsystem-only、Site client deleteと`Sites_archive` client CUDは拒否を維持した。
- Manager、document単位LWW、Rulesのschema・業務validation簡素化、Customer projection同期、cache、data migration、packageは変更していない。

## 最終Local検証

| Gate | Command | 結果 | Exit status |
|---|---|---|---:|
| domain-full | `node --test test/domain/*.test.mjs` | 1,563件成功 | 0 |
| local-emulator-suite | `npm run test:local` | 182件成功。Codex専用demo project、loopback-only、利用者saved data不変 | 0 |
| project-docs | `pwsh -NoProfile -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` | TOML validation 8件。governance validationはMarkdown 293件、ADR 69件、roadmap 12件、TOML 8件成功 | 0 |
| diff-check | `git diff --check` | 成功 | 0 |

文書だけの後続修正は`domain-full`と`local-emulator-suite`のinvalidatedByに該当しないため、上記のapplication／Rules最終worktree証拠を再利用する。`project-docs`と`diff-check`は最終文書修正後に再実行して、この記録の結果へ反映する。

## 独立review

- 初回security reviewは、Rulesのcanonical User `docId == request.auth.uid`検査不足と、Site Callables 3件の共通identity-gate契約test不足を指摘した。
- 修正後、missing／mismatched User `docId`のcreate・update拒否testと、`terminateSite.js`、`reactivateSite.js`、`updateSiteAgreements.js`の`resolveCallableAuthIdentity`契約testを追加した。
- security再reviewはfindingなし。tenant、archive、auto termination、client delete、`Sites_archive`、Customer、status、lifecycle metadata、`scheduleRevision`、tombstone境界が維持されていることを確認した。
- 文書reviewで旧strict actor記述と証拠参照不足を検出し、仕様、ADR header、Site実装記録、両roadmap、handoff、changelog、検証索引を整合した。

## 未確認・残余risk

- Firestoreの現在のedition、Dev・ProdのRules／Functions、remote data、実browserは確認していない。
- client、Functions、Rulesは将来のDev反映時に同じ固定revisionを協調して反映する。部分反映では一時的にUI／server認可が不一致になり得る。
- stored data migrationは行っていない。rollbackは本checkpointのclient、Functions、Rules、test、文書差分を同じ単位で戻す。
- `local-ui-build`はUI presentation、client configuration、依存関係を変更しておらず、verification policyのdata-contract／application-logic分類で省略可能なため実行していない。release-onlyの`generate:dev`／`generate:prod`も未実施である。
