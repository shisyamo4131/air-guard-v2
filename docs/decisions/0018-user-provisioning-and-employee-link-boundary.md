# 0018 User provisioningとEmployee紐付け境界

- 日付: 2026-08-16
- 更新日: 2026-08-26
- 状態: Accepted
- 関連仕様: テナントと認証
- 関連実装計画: [User Write Boundary](../implementation/user-write-boundary.md)

## 背景

UserにはEmployeeと紐付かない利用者と、Employeeへ紐付く利用者がいる。現行画面は会社管理者向けUser一覧と、`employees:read`で到達できるEmployee詳細のUser作成・削除を持つ一方、User作成前の全社email確認は会社管理者だけを許可するため、表示可能な操作とserver認可が一致していない。

会社管理者だけへ仮User作成を限定すると日常運用が1人へ集中するが、`employees:write`をそのままUser管理権限にするとEmployee編集とAuthentication lifecycleの境界が結合する。

## 決定

- Userを単独UserとEmployee連携Userに分類し、仮登録・本登録、管理者、有効・無効とは別の軸として扱う。
- 仮登録Userの作成・削除には専用permission `users:provision`を使用する。
- `manager`へ`users:provision`と`users:write`、`human-resource`へ`users:provision`だけを明示付与する。permission展開の特殊な包含規則は追加しない。
- `employees:write`だけではUserアカウント管理を許可しない。
- 単独仮User作成とEmployee連携仮User作成は別の公開操作とする。
- Employee連携では、serverが同一会社のEmployee存在、未紐付け、1 Employee対最大1 Userを検証し、任意のclient指定`employeeId`を信頼しない。
- Employee連携は在職中Employeeだけを対象とする。会社管理者またはstrict preset由来`users:write`保有者だけが単独・Employee連携の作成時に既知role presetを任意設定できる。`users:provision`だけのactorは非空rolesを指定できず、serverは空へ丸めず拒否する。既定は空配列で、`isAdmin`は常にfalseとする。
- 全Userのcanonical emailとEmployee紐付けの一意性は、server-onlyのemail予約とEmployee予約を正本にする。予約は作成だけでなく本登録変換、仮登録削除、初期管理者作成まで同じlifecycleで更新し、missing・malformed・mismatchをfail closedとする。
- 予約導入前のUserはmigrationで監査・backfillし、製品runtimeにlegacy query fallbackを置かない。AuthenticationとFirestoreを跨ぐ完全なatomicityは保証せず、claims失敗等は整合した再実行を可能にする。
- Employee連携Userは自身のEmployee情報へアクセスできる。ただし公開fieldと提供pathはEmployee Self Accessの別ゲートで確定し、UWBではUser書込み境界を先行する。
- UWBは最初から全User lifecycleを一括変更せず、仮登録Userと保護fieldのCritical境界から段階的に広げる。

## 理由

会社管理者やmanager不在時にもhuman-resourceがEmployeeとroleなしUserを紐付けられるようにしつつ、role・通知等のUser管理権限を`users:write`へ分離するためである。また、単独UserとEmployee連携Userの作成目的をAPI上で分けることで、`employeeId`の偽装、重複紐付け、UIごとの検査差をserver境界へ集約できる。

## 代替案

- 会社管理者だけに限定する案: 日常のUser登録が唯一の管理者へ集中するため採用しない。
- `employees:write`保有者へ自動的に許可する案: Employee管理とUser/Auth管理の責務が結合するため採用しない。
- 現行の画面到達性を認可として維持する案: `employees:read`保有者まで削除経路へ到達し、Rulesの直接writeを防げないため採用しない。
- Employee本人へEmployee文書全体を直ちに公開する案: 同一文書内の非公開fieldをRulesで秘匿できないため採用しない。

## 影響

- 権限: `users:provision`をpermission catalogへ追加し、managerとhuman-resourceへ明示付与する。`users:write`はmanagerだけに付与する。
- API: 単独仮UserとEmployee連携仮Userの作成入口を分離する。
- UI: User一覧とEmployee詳細は、閲覧permissionとUser管理permissionを区別する。
- data: email予約`UserEmailReservations/{sha256(canonicalEmail)}`とEmployee予約`Companies/{companyId}/EmployeeUserReservations/{employeeId}`を追加し、既存Userの重複・不正状態・予約pointerをmigrationで確認する。
- security: Usersの汎用Rules迂回、任意field write、任意UID削除連鎖をUWB完了までdeploy不可のCritical riskとして維持する。

## 移行

`users:provision`と`users:write`の認可基盤、仮登録操作、UI、Rulesを小さいsegmentごとに実装・確認する。本登録User削除、Employee退職時の状態遷移、Employee Self Accessは専用ゲートで別に扱う。

既存Userの予約backfillは、Codex専用Emulator、利用者用Emulator、Devの順に対象を分離する。Devは専用service account identity、Emulator routing不在、maintenance、必要なbackup、read-only dry-run、plan digest、project再確認を必須とし、missing予約のcreateだけを許可する。既存予約のupdate・delete、User・Employee・Authenticationのwriteを同じmigrationへ含めない。途中失敗時は一部作成済み予約を削除せず、再dry-runして未作成分だけを再開する。Prod targetは別の仕様・承認なしに提供しない。

## ロールバック

各segmentを独立したlocal commitとし、未接続のCallableまたはpermission追加から直前segmentへ戻せるようにする。Users Rulesを狭める変更は、必要なCallableとUI接続がlocalで検証されるまでdeployしない。Dev backfill前は予約が0件であることを含むread-only証拠を残し、migration後に問題がある場合も予約を自動削除しない。本migrationが新規作成したexact reservationだけを事前・事後証拠から特定できる場合に限り、別のrepair承認で削除を検討する。

## 再検討条件

正式な全role・permission matrix、permission展開APIの統一、またはEmployee Self Accessのfield/path契約を確定するときに再検討する。
