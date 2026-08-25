# 0020 Employee退職・単独User削除・誤退職訂正境界

- 日付: 2026-08-24
- 最終更新日: 2026-08-25
- 状態: Accepted
- 関連仕様: テナントと認証
- 関連実装計画: [User Write Boundary](../implementation/user-write-boundary.md)

## 背景

EmployeeとUserは必ずしも相互に存在せず、Employeeだけ、Employee連携User、Employeeに紐付かない単独Userが存在する。AirGuardV2の利用停止、Employee退職、User/Auth物理削除は異なる業務状態であり、同じ操作として扱うとEmployeeと勤怠・配置・請求の履歴を失うか、退職後もAuthenticationだけが残る危険がある。

AuthenticationとFirestoreは一つのtransactionで更新できない。さらに現行のEmployee退職とUser削除はqueryの先頭結果、Firestore trigger、複数の非同期処理へ分かれており、途中失敗時の正本と再開地点を一意に決められない。物理削除後の誤退職訂正も必要だが、削除済みAuth UIDやUserを復元することはできず、同じemailが別tenantで正当に再利用されている可能性がある。

## 決定

- UWB-07を次の3操作へ分ける。
  - UWB-07A: Employee退職。
  - UWB-07B: Employeeに紐付かない単独本登録Userのaccount offboarding。
  - UWB-07C: 誤って完了したEmployee退職の訂正。
- UWB-07Aでは`employees:terminate`をstrict `human-resource`へ付与し、有効な本登録会社管理者にもoverrideを許可する。manager単独、`employees:write`、`users:provision`、`users:write`だけでは退職を許可しない。managerが別Userへ`human-resource` roleを設定して担当者を任命できる既存role管理境界は維持する。
- 退職日はserverのAsia/Tokyo暦日で入社日以降かつ実行日以前に限定する。将来日退職、予約取消、実際の退職期間を伴う再雇用は別機能とする。
- Employee退職ではEmployeeを`RESIGNED`として保持し、勤怠・配置・請求等の業務記録を削除しない。本登録のEmployee連携Userがある場合だけUWB-07AでUser/Authとemail・Employee予約を削除する。関係の正本はEmployee予約pointerとし、queryの先頭結果へfallbackしない。
- 退職担当者自身に紐付くEmployeeの退職は拒否する。仮User連携はUWB-07Aで自動削除せず、既存の仮登録削除を完了してEmployee-only状態を確認してから退職を再実行する。clientから直接作成されるAuthentication accountとFirestore予約はatomicにbindできないため、email、claim不存在、未setup状態からAuthの作成元を推定して削除しない。signup途中のAuth-only部分状態は別のaccount repairで扱い、UWB-07AはそのUID、同emailの新しいtenant・予約・Authへ作用しない。
- UWB-07Bは有効な本登録会社管理者だけに許可する。自己、会社管理者、super-user、他社User、仮登録User、Employee連携Userを拒否する。仮登録Userは既存削除、Employee連携UserはUWB-07Aを使用する。
- User/Authは物理削除し、`Users_archive`を作らない。email、role、通知設定、User/Auth全文を復旧snapshotとして保持しない。旧UID参照は新UIDへ書き換えず、accountが再び必要な場合は通常provisioningで新しいAuth UIDとUserを作成する。
- `Companies/{companyId}/LifecycleOperations/{operationId}`をUWB-07の実行状態と監査の唯一の正本にする。actor/target UIDと最大6文字の表示名、Employee ID、退職日・最大20文字の退職理由または単独User削除理由、reverse先、request fingerprint、current state、Auth・cleanup disposition、attempt、error code、server timestampを操作種別ごとのexact allowlistで保持する。email、role、設定、User/Auth全文は保持しない。
- append-only eventは`LifecycleOperations/{operationId}/Events/{phase}-{attempt}`、deterministic lockは`UserLifecycleLocks/{targetUserUid}`と`EmployeeLifecycleLocks/{employeeId}`に置く。eventは作成後変更・削除せず、対応するterminal finalizeだけがlockを解除できる。operation、event、lock、`EmployeeLifecycleHeads`をclientへ直接公開しない。
- `EmployeeLifecycleHeads/{employeeId}`へ単調増加revisionとlatest operationを保存し、UWB-07A/CがEmployeeと同じtransactionで更新する。UWB-07Cはreverse元がlatest completed retirementであることをheadから確認し、同じoperation ID・同じfingerprint以外の重複訂正を拒否する。
- 本登録User削除は、最初のtransactionでoperation・lockとaccess revokeを確定し、Auth削除前にdurable intentを保存する。intent保存後の削除直前にもtarget AuthのUID、canonical email、company claim、super-user状態を再取得・照合する。Auth削除後にUser・予約をFirestore transactionでfinalizeし、FCM cleanupまで追跡する。同じoperation ID・同じ入力は再開または同じ結果を返し、異なる入力と別operationの競合を拒否する。
- 3 Callableは現在のAuthentication accountとactor Userを再取得し、UID、確認済みemail、company claim、super-user、disabled、本登録状態を照合する。company IDは検証済みidentityから導出し、client入力から受け取らない。access revoke後は通知dispatcherとFcmTokens Rulesも有効な同社本登録Userだけを許可する。FcmTokensはtoken/document ID一致createだけをclientへ許可してupdateを拒否し、owner移管は旧owner delete後のcreateとする。退職commit前にeligibility確認を通過したin-flight messageは回収不能riskとして区別する。raw・partial tokenとtoken由来識別子、通知本文、custom dataをlogへ残さない。
- UWB-07Cは有効な本登録会社管理者だけに許可する。完了済みUWB-07Aを参照し、同じEmployee documentを`ACTIVE`へ戻して現在値の退職日・退職理由を消去する。元の退職operationは不変のままreverse linkを記録し、User/Auth、role、通知設定、旧UID、業務記録を復元・変更しない。
- 元の退職日と現在上限20文字の退職理由は、訂正後の監査に必要なserver-only履歴として保持する。email、email hash、role、通知設定、User/Auth全文、claims、FCM tokenはledger、event、error、logへ保存しない。
- UWB-07導入前のRESIGNED EmployeeはUWB-07Cで自動訂正せず、別のbackfillまたは管理者repairで扱う。実際の退職期間を伴う再雇用も別設計とする。
- `LifecycleOperations`は現段階で固定の保存期間を設けず、自動purgeしない。operation、event、head、reverse参照を現行schemaのまま保持し、削除を前提とするlegal holdとterminal後識別子縮小も実装しない。data量、法令・社内規程、privacy、費用、運用上の必要性から見直しが必要と判断した時点で、削除対象、参照chain、訂正可能期間、legal hold、識別子縮小、移行・復旧を改めて決定する。
- 履歴一覧はFirestore client readを開放せず、有効な本登録会社管理者だけが専用Callableの最小projectionで閲覧できるものとする。super-user、human-resource、manager、直接permissionだけのUserには許可しない。UWB-07と、Users・Employees・予約・operation・event・lock・`EmployeeLifecycleHeads`へのclient迂回を閉じるUWB-08を同じrelease gateとする。

## 理由

Employee退職とUser削除を別々の監査documentへ重複記録すると、片方の更新後に処理が停止した場合に完了状態が食い違う。操作単位の正本を一つにすると、Auth削除のような非原子的外部作用の次の再開地点を一意に決め、誤退職訂正を完了済み退職だけへ限定できる。

誤退職訂正とaccount再作成を分けることで、別tenantが正当に取得したemailやAuthへ作用せず、Employee IDと既存業務参照を維持できる。会社管理者だけに訂正を許可すると、退職担当者が自分の操作記録を単独で取り消す境界を避けられる。

現時点では`LifecycleOperations`のdata量・費用が削除機構を必要とする証拠はなく、単純な期間削除はhead、reverse参照、冪等再送、誤退職訂正を壊し得る。不可逆なpurgeとそのためのlegal hold・識別子縮小を先行実装せず、必要性と正式な保持根拠を確認できた時点でまとめて再設計する方が、現在の整合性と運用を保てる。

## 代替案

- `EmployeeRetirementAudits`と`UserDeletionAudits`を別々の正本にする案: 一つの退職operationが複数collectionへ分裂し、phase・resultのdriftとreconcile判断の不一致が生じるため採用しない。
- User/Authをarchiveして復元する案: 不要なPII複製と復元可能性の誤認を生み、password、email所有、claims、旧UIDを安全に復元できないため採用しない。email一意性はUser email予約とAuthを削除して解放する。
- 仮Userのemailから未所属Authを検索して退職時に削除する案: client Auth作成とFirestore予約をatomicにbindできず、pending signupと無関係なAuthをserverから証明できないため採用しない。仮登録削除とAuth-only repairを分離する。
- 誤退職訂正でUser/Authも自動再作成する案: emailが別tenantで使用済みの場合に正当なaccountを侵害し、旧role・設定の復元根拠もないため採用しない。
- `employees:terminate`を誤退職訂正にも使用する案: 退職担当者が自分の処理を単独訂正できるため、初期契約では採用しない。
- 将来日退職を即時`RESIGNED`として保存する案: 予定日前にloginとworker候補から外れるため採用しない。

## 影響

- Functions: 3つの専用Callable、共通identity gate、operation store、target lock、registered User deletion engine、reconciler、error mapperが必要になる。
- Firestore Rules: UsersとEmployeesのlifecycle field、予約、operation、event、lock、`EmployeeLifecycleHeads`をCompanies汎用matchから除外し、client直接delete・退職・訂正・head改変を拒否する必要がある。FcmTokens createはactive registered User、uid・company一致、token/document ID一致、exact field/typeへ限定し、client updateを全面拒否する。deleteはresource owner本人またはserver cleanupだけに許可する。
- Client: 無効化、退職、単独User削除、誤退職訂正を別policy・composable・確認UIとして表示する。訂正成功時はUser accessが戻らないことを明示する。
- Data: Employeeと業務記録は保持される。User/Auth削除後のaccount再作成は新UIDとなり、旧UID履歴を書き換えない。Auth削除直後から予約解放までに同emailの新Authが作成される競合は、新UIDを推定削除せずaccount repair対象とする。
- Privacy/operations: server-only履歴は固定期限なし・自動削除なしで保持する。会社管理者専用readerの最小projectionをProd前に実装・検証し、削除・legal hold・完了後識別子縮小は将来の保持方針見直しまで提供しない。
- 互換性: 現行のclient `Employee.toTerminated()`、generic RESIGNED→ACTIVE更新、User/Employee削除triggerは新境界へ移行し、Rulesで直接経路を閉じる必要がある。

## 移行

permissionとpure policy、operation・lock基盤、UWB-07A、UWB-07B、UWB-07C、Callable exportsの順に実装する。続けてUWB-08のRulesと既存triggerを閉じ、単体・Emulatorのphase failure・並行・Rules testが成功してからclient UIを接続する。既存予約のinvariant auditがcleanであることをrelease前提とし、不一致を通常退職で自動修復しない。

legacy RESIGNED Employeeを訂正対象にする場合は、実データへ作用する前に退職情報とUser・予約不整合をread-onlyで分類し、信頼できる退職operationをbackfillできる対象と管理者repair対象を分ける。Dev・Prodのmigrationとdeployは別承認を必要とする。

## ロールバック

問題発生時は新UIを先に閉じるが、Rulesを旧direct writeへ戻さない。pending operationがある間はengineとreconcilerを撤去せず、完了済みAuth/User削除や誤退職訂正をdata rollbackしない。必要な訂正は新しいlifecycle operationで行い、terminal operation履歴を削除しない。

## 再検討条件

将来日退職・取消を提供するとき、実際の退職期間を伴う再雇用のEmployee ID・雇用期間modelを決めるとき、退職・削除履歴のdata量・費用・privacy・法令・社内規程から固定保存期間または削除が必要と判断したとき、または会社管理者以外へ誤退職訂正を委譲する必要が生じたときに再検討する。
