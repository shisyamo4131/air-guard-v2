# FGA-03 Site通常Rules簡素化 Local検証記録

## 対象

- Checkpoint: `FGA-03-SITE-RULES-SIMPLIFY-04`
- 実施日: 2026-09-11
- Repository: `C:\Users\seven\projects\AirGuard\air-guard-v2`
- Branch: `codex/fga-03-site-normal-auth`
- 基準HEAD: `1a0a5376b0aff1784095122d4f5d0a2f9fb0237c`
- 証拠状態: 基準HEAD上のLocal候補を検証。commit、Dev・Prod反映、remote product受入れは未実施

## 確認した変更

- 通常Siteのexact field、必須、型・長さ、enum、通常timestamp、派生値、埋込みCustomer projectionの検査をRulesから外し、Schemas packageと正規application writerへ集約した。
- Rulesは、同一tenantの有効な認証済み本登録User、canonical User ID、actor UID、maintenance off、作成時ACTIVE・空Agreement、通常更新時のACTIVE維持を必須とする。
- Agreement、`scheduleRevision`、状態変更field、同一会社のlive Customer存在、Customer未設定への巻戻し禁止、`isTemporary`相関、client delete、`Sites_archive` client CUD、same-ID tombstoneを維持した。
- archive Callable、archive保存形式、Functions、Site schema、data、package、UIは変更していない。
- 利用者判断により、製品操作は正規application経路を前提とする。applicationを介さない同一tenant Userの直接requestによる通常fieldの不正値は本phaseの対応対象にせず、そのためのarchive形式拡張も行わない。

## Local検証

| Gate | Command | 結果 | Exit status |
|---|---|---|---:|
| targeted-domain | `node --test --test-name-pattern="Customer reference collections use explicit guarded matches" test/domain/firestore-rules-reservation-source-contract.test.mjs` | 対象1件成功 | 0 |
| targeted-emulator | `pwsh -NoProfile -File scripts/run-codex-local-test.ps1 -Mode Test -TestNamePattern "Site Rules allow ordinary (create\|update)"` | 対象2件成功。Codex専用demo project、loopback-only、利用者saved data不変 | 0 |
| domain-full | `node --test test/domain/*.test.mjs` | 1,563件成功 | 0 |
| local-emulator-suite | `npm run test:local` | 182件成功。Codex専用demo project、loopback-only、利用者saved data不変 | 0 |
| project-docs | `pwsh -NoProfile -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` | TOML 8件、Markdown 294件、ADR 69件、roadmap 12件、TOML 8件成功 | 0 |
| diff-check | `git diff --check` | 成功 | 0 |

文書だけの後続編集は`domain-full`と`local-emulator-suite`の失効条件に該当しないため、製品code・Rules最終候補の結果を再利用した。`project-docs`と`diff-check`は最終文書状態で再実行した。

## 独立security review

- 初回reviewは、Rulesで許可される直接requestにより通常fieldが不正なSiteとなり、strictなarchive Callableが拒否し得る点を指摘した。
- 利用者は、製品操作についてapplicationを介さない操作を想定せず、本phaseではarchive形式を変更しないと判断した。この前提で再reviewし、tenant越境、identity偽装、maintenance回避、Agreement・schedule・lifecycle変更、Customer参照回避、client delete、archive CUD、fallback迂回にblocking findingがないことを確認した。
- 全7 protected fieldの削除拒否と、形式が不正でもsame-ID archiveがある場合のSite再作成拒否をEmulator testへ追加した。

## 未確認・残余risk

- 同一tenantの有効な本登録Userが正規applicationを介さず直接requestを送る場合、通常fieldへ不正な型・巨大な値・未知field・client時刻を保存でき、下流処理やarchiveを妨げる可能性がある。利用者判断により本phaseでは許容するが、tenant内Userを信頼しない運用へ変わる場合はRulesとarchive互換を再検討する。
- Dev databaseは、`npx -y firebase-tools@latest firestore:databases:list --project air-guard-v2-dev`と`npx -y firebase-tools@latest firestore:databases:get "(default)" --project air-guard-v2-dev`のread-only確認で、`projects/air-guard-v2-dev/databases/(default)`、Firestore Standard、Native mode、`asia-northeast1`と確認した。両commandはexit 0で、document dataは読み取っていない。
- Dev・Prodのdeploy済みRules、remote data、実browser、正規applicationのremote受入れは未確認である。製品変更の最終受入れには、固定commitのDev反映と対象操作のDev確認が別途必要である。
- data migrationは行っていない。deploy前は本checkpointの差分を戻せる。新しく許可された通常形状が保存された後は、Rulesだけを以前の厳格な状態へ戻すと編集を拒否し得るため、writerとRulesを同時に戻すか前方修正する。
- `local-ui-build`はUI source・client設定・依存関係を変更しておらず、verification policyで省略可能なため実行していない。release-onlyの`generate:dev`／`generate:prod`も未実施である。
