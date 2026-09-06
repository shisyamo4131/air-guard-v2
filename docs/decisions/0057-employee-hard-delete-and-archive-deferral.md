# 0057 Employeeの誤登録物理削除とarchiveの将来工程への延期

- 日付: 2026-09-06
- 状態: Accepted
- 一部置換先: [ADR 0060](0060-common-archive-purge-and-address-contract.md)（直接物理削除・archive延期・必要な従属writer変更禁止を置換。以下は採用当時の決定）
- 関連仕様: [Employeeの操作権限と保持](../specification.md#employeeの操作権限と保持)
- 一部置換: [ADR 0056](0056-employee-role-and-archive-boundary.md)のEmployee archiveを今回の改修で提供する方針。通常編集・退職・将来課金のactorと保護は維持する。
- 適用計画: [Employeeロードマップ](../roadmaps/employee.md)。本ADRは仕様採用であり、製品実装・Dev反映・実data削除の完了ではない。

## 背景

権限に応じたCRUD対応を優先するため、利用者はEmployeeのarchive案を保留し、誤登録の物理削除を採用した。他collectionは今までの実装を維持し、archiveの仕組みは将来工程として残す。PMが提示した会社管理者・統括だけの物理削除、従属あり拒否、連鎖削除なし、通常退職での保持も採用された。

## 決定

- 誤登録の物理削除は同社の有効な本登録会社管理者・統括だけに許可する。人事や他roleには、通常編集権限を根拠に削除を許可しない。UIだけでなく保存境界でactor・tenant・対象を検査する。
- 対象Employee本体をFirestoreから削除する。archive済みであることは前提にせず、新しいarchive複製も作らない。削除後の閲覧・復元を通常機能として提供しない。
- 従属documentが一つでもあれば拒否し、検査失敗・不整合も拒否する。業務参照、User/予約、lifecycle記録等の対象一覧と同時参照作成への対策を、実装開始前に確定する。既存hasManyだけを完全な検査の証拠にしない。
- User/Authや業務dataを連鎖削除して条件を満たさない。通常退職は既存の専用操作でEmployeeと業務記録を保持する。退職処理に伴う承認済みUser/Auth操作と、誤登録Employeeの削除は別契約である。
- Employee archiveは将来工程へ延期する。状態field・query除外・archive閲覧/restoreの新機能は今回追加しない。既存Employee archiveへの過剰なread/writeの是正は、今回のCRUD権限制御から除外しない。
- Customer、Site、Outsourcer等の既存実装は変更しない。既存archiveの削除・移動・復元、backup/purge、全masterの方式統一、共通adapter/packageの設定変更を自動実行しない。

## 理由と代替案

同documentのarchive状態は保存場所を維持できるが、通常query、選択候補、cache、新規参照の保存判定、旧writer、既存dataの扱いに追加変更が必要になる。今回はこの設計を先行させず、不要な誤登録を消す操作と通常退職の保持を分離する。別collection移動の継続、全masterの同時切替も今回採用しない。既存の認可・従属確認で利用できる部分は維持するが、検査範囲と競合の不足を残したまま汎用deleteを再開しない。

## 影響・互換性・移行

現Employee Rulesはclient deleteを拒否する一方、共通adapterにはarchiveを作る旧deleteがあり、原本削除triggerには関連Userを削除する経路が残る。専用削除の実装には、この迂回・副作用と従属writerの整合を確認する。新field導入のための一括移行はこの決定からは発生しない。既存dataの検査は実装差と確認された依存に限定し、実環境操作は別承認とする。既存archiveやbackupまで抹消したとは表現しない。

## 未決の実装契約と工程境界

削除のexact入力・誤登録確認、対象状態、従属catalog、検査後の参照作成防止、応答不明時の照合、削除後の同ID再作成と古い要求の再送、監査に残す最小情報、既存削除triggerの扱い、実装工程の割当はEMP-01の残作業とする。他collectionのwriter変更が不可欠なら、今回の「他collectionを変更しない」境界を優先し、必要箇所・理由・代替を提示する。承認がないまま変更せず、安全な削除を満たせない間は削除操作を開放しない。削除関連の判断をarchive将来工程や独立FUTへ付け替えない。

## rollback

文書採用は所有差分のcorrective commitで戻せる。製品実装後のcode rollbackは、すでに物理削除したdataを復元しない。復旧時は影響操作を停止し、旧広域writeやUser連鎖削除を再開しない。data復旧が必要なら別承認のbackup・対象・手順で行い、通常の復元機能やUser/Auth自動復元を保証しない。

## 検証と再検討条件

今回の権限・保持仕様の文書反映はcomprehensive 5 gateで検証する。実装時は許可/拒否actor、他tenant、未知role/直接permission、仮/無効User、従属あり/なし/検査失敗、User/予約不整合、同時参照作成、応答不明・二重送信・同ID再作成、旧delete/restore迂回、Employee以外のdata不変を確認する。archive延期を理由に既存archiveのアクセス保護を省略しない。runtime・Emulator・UI・実dataの成功証拠は対応工程で取得する。

archiveされたEmployeeを後で閲覧する具体的な必要性が出た時点で、保存形状、状態と退職の分離、従属制約、read/write、復元、保持条件、他masterとの共通化を別工程として再検討する。
