# Employee archive

- 状態: 運用中
- 役割: Employee archiveをCodex専用demo環境で検証する個別手順

先に[local UI検証runbook](../local-ui-testing.md)の共通手順を適用する。

Employee archiveのlocal検証では、demo project・Functions Emulator・loopback Firestore・外部作用denyを満たす前景processから、同一tenantの有効な認証済み本登録Userとして正規Callable/UIを検証する。tenant allowlistやone-time grantは設定しない。通常API indexの`archiveEmployee`と同じ認証・tenant境界を使用し、想定外のdirect SDK経路は別の未保証経路として扱う。

archive操作前に対象fixtureのUser連携、予約、lock、lifecycle履歴、raw/hasMany条件を確認する。正規UIで作成した対象に対する操作と、原本/archive/User/Authのread-only assertionを別に記録する。失敗時は保存へ進まないことを記録し、direct SDKによるpreflight/hasMany迂回を成功証拠にしない。
