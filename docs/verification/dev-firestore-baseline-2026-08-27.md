# Dev Firestore baseline履歴記録

- 状態: Historical evidence / current confirmation required
- 観測日: 2026-08-27
- 対象: Dev Firestore
- 移管元: `docs/runbooks/local-emulator-testing.md`

## 記録された構成

元のrunbookには、Firebase CLI 15.28.1とgcloudの独立したread-only requestで次を確認したと記録されていた。本整理では再実行せず、記録済みの値を移管した。

| 項目 | 確認値 |
|---|---|
| Firebase project | `air-guard-v2-dev`（`.firebaserc`の`default`・`dev` alias） |
| Database | `(default)` |
| Edition | `STANDARD` |
| Type | `FIRESTORE_NATIVE` |
| Location | `asia-northeast1` |
| Delete protection | `DELETE_PROTECTION_DISABLED` |
| Point-in-time recovery | `POINT_IN_TIME_RECOVERY_ENABLED`、保持`604800s`（7日） |

## 証拠の限界

元の記録にはexact command、raw output、独立exit statusが保存されていないため、本書で推測して補完しない。これは観測時点の履歴であり、現在のFirebase project、database、edition、location、保護設定、PITRを保証しない。

edition依存の実装、release、migration、backup判断では、対象runbookに従ってactual targetをread-onlyで再確認する。Prod環境の構成確認には使用しない。
