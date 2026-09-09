# CUSTOMER-01B Dev compatibility verification receipt

- 状態: Incompatible / immutable execution evidence
- Evidence ID: CUSTOMER-01B-DEV-READONLY-001
- 実施日: 2026-09-03 JST
- 実行直後の時刻観測: 2026-09-02 23:00:47 UTC（2026-09-03 08:00:47 JST）
- 対象commit: `547405672440e30bdd22114db890cb115e392473`
- 対象環境: Dev project `air-guard-v2-dev` / database `(default)`
- 対象設定根拠: [`.firebaserc`](../../.firebaserc)、[`firebase.json`](../../firebase.json)、[Customer互換性検査](../runbooks/dev-deployment/customer-compatibility.md)
- 実装根拠: [検査tool](../../scripts/check-customer-dev-compatibility.mjs)、[保存形式contract](../../utils/customer/customerDocumentContract.js)、[Customer実装](../implementation/customer-master.md)

## 承認・実行境界

- 利用者は、上記commitで全階層Customersを1000件上限・超過検知で最大1001件取得・30秒以内で一度読み取る提案に対し「進めてください」と承認した。
- 実行前にprimary repository、branch `codex/dev-user-reservation-migration`、対象HEAD、clean、upstreamなし、primary worktree 1件を確認した。
- `NODE_USE_SYSTEM_CA=1`をprocessに設定し、利用者levelの`AIRGUARD_DEV_CREDENTIAL_PATH`を同名process環境変数へ渡した。資格情報の値・path・内容は出力していない。
- OAuthとFirestore queryを既存toolで一度実行した。tool内部でdocumentの値・IDを読み取り検査したが、出力は下記の固定集計だけである。raw data・ID・資格情報・data由来hashは保存・出力していない。
- data更新・削除・修復・migration・backup・export、build、deploy、push、再試行、追加のremote読取りは行っていない。data rollbackは不要。

## Commandと観測結果

```powershell
node scripts/check-customer-dev-compatibility.mjs --read-only --project air-guard-v2-dev --database '(default)'
```

- PowerShellで直後の`$LASTEXITCODE`を保存し、その値をprocessの終了値として返した。
- 実行toolが独立観測したexit status: **2**。互換性検査は不合格。
- 実行toolのprocess wall time: **0.8795449秒**。準備・review・文書作業の所要時間は含まない。
- 一次証拠: coordinatorの実行tool output `f8ad32`。次のJSONはその集計出力を整形したもの。

```json
{
  "status": "incompatible",
  "complete": true,
  "documents": 90,
  "compatibleDocuments": 34,
  "incompatibleDocuments": 56,
  "reasons": {
    "field-set": 56,
    "wire-shape": 56,
    "required-string": 0,
    "nullable-string": 56,
    "doc-id": 0,
    "timestamp": 0,
    "postal-code": 0,
    "pref-code": 0,
    "status": 0,
    "payment-integer": 0,
    "location": 0,
    "geopoint": 0,
    "address": 0,
    "token-map": 0,
    "unicode-unverified": 0,
    "wire-unverified": 0,
    "arguments": 0,
    "environment": 0,
    "credential-file": 0,
    "credential-format": 0,
    "credential-key": 0,
    "authentication": 0,
    "read-failed": 0,
    "timeout": 0,
    "response-size": 0,
    "response-format": 0,
    "response-incomplete": 0,
    "unexpected-path": 0,
    "duplicate-document": 0,
    "document-limit": 0,
    "internal-error": 0
  }
}
```

## 解釈と限界

- queryの取得は完了し、34件は今回の保存形式検査に適合、56件は不適合だった。認証・通信・応答・上限による取得未完了ではない。
- 理由はdocumentごとに重複除去される。同じ56件すべてに`field-set`、`wire-shape`、`nullable-string`が付いており、理由件数を足して不適合document数にしない。
- 不適合documentには`code`、`branchName`、`building`、`tel`、`fax`、`remarks`の少なくとも一つで任意文字列条件の不適合がある。具体的な項目名、欠損・型・長さの別、余分な項目の併存は今回の集計から特定できない。
- 任意文字列項目の欠損は3理由を同時に生じ得るため原因候補だが、欠損と断定しない。null許容は項目省略の許容を意味しない。
- この実行結果はその時点のqueryと保存形式だけの証拠である。actor権限、tenant拒否、新規作成時条件、派生値の意味上の正しさ、現在のedition・IAM設定全体、Customer変更のDev反映可否を証明しない。
- reviewerは実際のlocal baselineと集計コードを独立確認した。remote結果は親の実行証拠に基づき解釈しており、独立再取得はしていない。

## 検証選択と文書範囲

- remote検証を含むため`build-release-deploy`のcomprehensive completion gateを選択し、文書差分には`documentation-only`も適用する。`project-docs`と`diff-check`の最終結果は当該文書commitのcoordinator完了報告へ記録する。
- `powershell -ExecutionPolicy Bypass -File scripts/test-project-docs-check.ps1`: 全fixtureが期待した結果、exit status 0。
- `powershell -ExecutionPolicy Bypass -File scripts/test-codex-session-size.ps1`: 7 checks成功、exit status 0。
- `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2`: managed artifacts一致、exit status 0。内包rendererもexit status 0。
- application・Rules・schema・test・toolに変更はない。同一tool baselineでの`node --test test/domain/*.test.mjs`は812/812、exit status 0の証拠を維持し、今回重複実行しない。
- deploy・build・migration・UI受入れを行うcheckpointではないため、release-onlyのEmulator・UI build・Dev/Prod generateは選択しない。今回の結果でrelease readinessを成立させない。
- 変更対象は本receipt、検証索引、Customer実装の未確認範囲、roadmapの次作業、current handoffのみ。仕様・data contract・ADR・操作手順・manual・changelog・governance・進捗値は変更しない。製品挙動・要件・運用手順を変更せず、加点するmilestoneもないためである。

## 次の判断

提案は、既知26項目ごとの欠損・型不一致・文字数超過と、余分な項目を持つdocumentの件数だけを固定キーで集計するlocal診断拡張である。欠損と型不一致の重複計上を避け、未知の項目名・値・ID・hashを出さない。合成testと独立reviewの後、改修commitを固定してDev再読取りの別承認を得る。原因が確定するまでは補完値や修復方針を決めず、migration・repairへ進まない。
