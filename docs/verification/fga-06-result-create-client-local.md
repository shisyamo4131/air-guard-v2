# FGA-06 稼働実績一覧CREATE標準client保存 Local検証記録

- Checkpoint: `FGA-06-RESULT-CREATE-CLIENT-08`
- 実施日: 2026-09-14（Asia/Tokyo）
- 固定commit: `c171b593`
- 状態: Local実装・必須検証・専用UI build・commit完了、Dev反映・受入れ未完了

## 変更境界

- 一覧の複数形`OperationResultsManager`を`OperationArrayManager`から`AirArrayManager`へ戻し、`OperationResult.create()`を使う。
- 現行の760px dialog、入力、ボタン文言、一覧toolbar、作成後の詳細遷移を維持する。
- 実績createを`saveOperation` Callableの入力境界で拒否する。
- Rulesは同一tenantの有効な本登録User、actor UID、document ID、live Site／Customer、空の作業員・稼働外売上・調整値、非lock、非予定紐付けだけを通常createへ開く。
- 実績複製、稼働外売上、請求、lock、予定、通知、実績化、schema、migration、既存data、Dev・Prodは対象外。

## 検証

| command | 結果 | exit status |
|---|---|---:|
| 対象domain 5 files | 78/78 pass | 0 |
| Rules／Site archive source contract | 12/12 pass | 0 |
| 対象Emulator（通常CRUD・偽装拒否・Site／Customer archive競合） | 6/6 pass | 0 |
| `node --test test/domain/*.test.mjs` | 1,447/1,447 pass | 0 |
| `npm run test:local` | 178/178 pass | 0 |
| `npm run test:local:ui:build` | client／server build成功 | 0 |
| project docs validator | 316 Markdown、72 ADR、12 roadmaps、8 TOML pass | 0 |
| `git diff --check` | errorなし | 0 |

初回の全Emulator実行では旧Callable作成を前提とするSite archive競合test 1件を検出した。client作成へ置換し、さらにCustomer archiveの前後・同時実行を追加してから、最終状態で178/178件を再実行した。

## Security Rules監査

- 認証とtenant分離は既存のverified claim・active registered User境界を再利用する。
- 作成時だけlive Site／Customerを参照し、master archiveとの前後・同時実行で孤児参照を防ぐ。
- 予定由来ID、作業員、稼働外売上、請求調整、lock、billing versionの偽装作成を拒否する。
- Rulesは通常業務fieldの完全なschema検査を重複しない。正規UIはmodel validationと作成前Site補完を通るが、同一tenantの有効な本登録UserがSDKを直接使う場合の通常field shape・resource exhaustion riskは既知の受容境界として残る。

```json
{
  "rules_security_assessment": {
    "rating": 5,
    "verdict": "GO",
    "tenant_isolation": "同一tenantのverified claimとactive registered Userに限定",
    "privilege_escalation": "role差を設けず、actor UIDとdocument IDの偽装を拒否",
    "protected_fields": "予定紐付け、作業員、稼働外売上、調整値、lock、billing versionの作成時偽装を拒否",
    "archive_consistency": "live SiteとCustomerをexistsAfterで確認し、archiveとの前後・同時実行をEmulatorで検証",
    "residual_risk": "通常業務field全体のschemaとサイズはRulesで重複検査しない"
  }
}
```

Firebase CLI最新版によるDev projectへのRules dry-runは、外部projectへRulesを送信する可能性があるとして実行環境の安全審査に拒否された。ローカルEmulator compile・認可検証は完了したが、remote dry-runは未実施であり、Dev反映checkpointで改めて扱う。

## Rollback

固定commit作成後に当該commitをrevertし、承認済みrelease手順でFirestore Rules、Functions、Hostingを再反映する。schema変更とmigrationはない。rollback実行、Dev・Prod操作は別承認を要する。
