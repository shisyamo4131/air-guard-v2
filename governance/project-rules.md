# AirGuardV2 Project Rules

- Status: Active
- Owner: AirGuardV2 project
- Common governance: `governance/common-governance.md`
- Rule: このファイルと下表のproject-owned segmentはAirGuardV2固有の要件を追加する。managed common governanceを弱めたり置き換えたりしない。

## 常時適用する境界

- AirGuardV2は警備会社向けのマルチテナント業務管理Webアプリケーションで、試験運用中である。変更対象は原則としてこのrepositoryと、利用者が明示した依頼範囲だけとする。
- 利用者向け応答は日本語とし、確認済み事実、承認済み仕様、提案、推測、未確認事項、履歴を区別する。
- primary repositoryは`C:\Users\seven\projects\AirGuard\air-guard-v2`である。別repository・別worktreeを変更対象にせず、不一致時はread-onlyで停止する。
- Authentication、custom claims、Firebase Rules、tenant分離、個人・顧客・勤怠・請求data、Stripe、通知をhigh-risk境界として扱う。利用者の明示承認を、隣接機能、別環境、外部作用へ拡張しない。
- `governance/common-governance.md`、生成された`AGENTS.md`、`governance/governance.lock.toml`に記録されたmanaged referenceは、project固有作業で直接編集しない。

## 必須の読取り順

1. 作業開始時に、root `AGENTS.md`を他のfileと同じcommand・tool call・入力へまとめず、単独で全文読む。
2. 次に、本index `governance/project-rules.md`を他のfileと同じcommand・tool call・入力へまとめず、単独で全文読む。両fileを読み終える前に、他のproject文書を読み始めない。
3. その後、下表から依頼・予定操作に該当する行をすべて選び、segmentと指定runbookを変更・委譲・Git操作・test・外部操作・完了判断より前に読む。
4. `docs/README.md`から製品・機能固有の正本を選び、関連code、Rules、設定、test、実行証拠と照合する。
5. routeを一意に選べない、必読文書が存在しない、両入口fileの全文読取りを確認できない、または正本が矛盾する場合はread-onlyで停止して報告する。

この独立読取り順は、大きなfileを一括取得した際の出力切捨てによる未読を防ぎ、同じ入口fileの再読込みを減らすための開始条件とする。

delegation promptには選択したsegmentとtask-routed正本を列挙し、委譲先にもactual repository・branch・HEADとの独立照合を求める。複数行に該当する作業は必読集合の和集合を使い、入口やpromptへ本文を複写しない。

## Project rule routing

| 作業・作用 | 必読segment | 追加route |
|---|---|---|
| 設計、調査、code探索 | [Coordination and Git](../docs/project-rules/coordination-and-git.md) | 機能固有の仕様・ADR・実装記録 |
| subagent委譲、実装、test、review、Git、状態報告、task lifecycle | [Coordination and Git](../docs/project-rules/coordination-and-git.md) | [project coordination](../docs/runbooks/project-coordination.md) |
| application、Functions、Firestore CRUD・Rules・schema、data contract、段階的改修 | [Development and data](../docs/project-rules/development-and-data.md) | [development workflow](../docs/runbooks/development-workflow.md)、関連仕様・ADR |
| local Emulator、local UI、browser、build、Dev/Prod、remote/data、migration、package、外部service、破壊操作 | [Environment and approval](../docs/project-rules/environment-and-approval.md) | [runbook index](../docs/runbooks/README.md)から該当手順 |
| 文書、仕様、ADR、roadmap、governance、検証選択、checkpoint完了 | [Documentation and verification](../docs/project-rules/documentation-and-verification.md) | [document map](../docs/README.md)、[verification policy](verification-policy.json) |
| repository、path、branch、commitのcritical identifier | [Coordination and Git](../docs/project-rules/coordination-and-git.md) | [project coordination](../docs/runbooks/project-coordination.md) |
| package、version、integrity、tagのcritical identifier・関連repository変更 | [Environment and approval](../docs/project-rules/environment-and-approval.md) | [package release](../docs/runbooks/package-release.md) |
| Firebase環境、project、database、deploy先、data対象のcritical identifier | [Environment and approval](../docs/project-rules/environment-and-approval.md) | [runbook index](../docs/runbooks/README.md)から対象環境の手順 |

## 正本の役割

- 確認済み仕様は`docs/specification.md`、進捗は`docs/roadmaps/**`、重要判断は`docs/decisions/**`、再利用可能な実行・復旧手順は`docs/operations.md`と`docs/runbooks/**`を正本とする。
- `docs/implementation/**`は実装事実、FUT、CONF、coverage、deep-review証拠であり、確認済み仕様の正本ではない。`DEFINITION.md`、`DESIGN.md`、`HISTORY.md`、`definitions/**`は参考・履歴である。
- AirGuardV2固有の横断的なproject ruleは上表の4 segmentだけを正本とする。segmentに日付固有の実行結果、現在進捗、commit一覧を置かず、機能要件、実行手順、証拠はそれぞれ仕様、既存runbook、verification receiptへ分離する。
