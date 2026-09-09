# Employee archive

- 状態: 運用中
- 役割: Employee archiveをCodex専用demo環境で検証する個別手順

先に[local UI検証runbook](../local-ui-testing.md)の共通手順を適用する。

Employee archiveの専用demo検証では、Emulatorを起動する前景processだけに`AIR_GUARD_CODEX_EMPLOYEE_ARCHIVE_TENANTS`を設定する。値は、そのrunで検証対象にした合成company IDだけのJSON文字列配列とし、実target/fixtureから確認して指定する。既定は空集合、不正形式・重複ID・対象外は拒否する。通常用`AIR_GUARD_EMPLOYEE_ARCHIVE_TENANTS`とは分離し、専用APIはdemo project・Functions Emulator・loopback Firestore・外部作用denyを満たさなければ実行しない。通常API indexへarchiveを公開する手順ではない。

archive操作前に対象tenantの6collectionのraw/索引整合と必要writerの閉鎖を確認する。整合checkerの`archiveReady:false`を自動的な開放許可へ変換せず、検証用の明示設定と区別する。他試験の不正fixtureが混在するtenantを未確認のまま許可しない。設定はその前景processの終了とともに破棄し、saved-dataや通常環境設定へ保存しない。正規UIで作成した対象に対する操作と、原本/archive/User/Authのread-only assertionを別に記録する。
