# 0058 Employee全項目閲覧と自宅座標・変更範囲

- 日付: 2026-09-06
- 状態: Accepted
- 一部置換: 2026-09-09の[ADR 0065](0065-tenant-trust-normal-business-authorization.md)により、Employee通常情報のread/writeを既知roleへ限定する条件をtenant共通権限へ置換した。機微・機密fieldの分類・分離、Self Access、住所・座標、状態・data保護条件は維持する。
- 一部置換: 2026-09-09の[ADR 0066](0066-pre-production-document-level-last-write-wins.md)により、在職Employeeの通常可逆更新はdocument単位last-write-winsへ移行する。部分保存、同一field競合拒否、再読込要求はFGA-04で置換し、住所・座標の相関、退職・User/Auth・機微情報等の例外は維持する。
- 一部置換先: [ADR 0060](0060-common-archive-purge-and-address-contract.md)（直接物理削除・archive延期・必要な従属writer変更禁止を置換。以下は採用当時の決定）
- 関連仕様: [Employeeの操作権限と保持](../specification.md#employeeの操作権限と保持)
- 一部置換: [ADR 0056](0056-employee-role-and-archive-boundary.md)の他4roleへの必要項目限定readとexact閲覧field未決。作成・通常編集・退職のactorは維持する。
- 範囲の明確化: [ADR 0057](0057-employee-hard-delete-and-archive-deferral.md)の他collection維持は保存処理・Rulesも含む。
- 適用計画: [Employeeロードマップ](../roadmaps/employee.md)。製品実装・Dev反映の証拠ではない。

## 背景

EMP-01再開時、利用者は労務・法務・管制・経理のEmployee閲覧について「現時点では全項目OK」と回答した。住所からの座標取得は必要とし、将来、配置先現場と従業員自宅の経路図を描画する用途を示した。他collectionについては保存処理・Rulesも変更しないと明示した。

## 決定

- Employee原本は同じ会社の有効な本登録会社管理者と既知6業務role（統括・人事・労務・法務・管制・経理）へ全項目のreadを許可する。必要項目だけのDTOへ切り替えることを今回の要件にしない。
- 全項目readはwrite権限を追加しない。作成・通常編集・退職は会社管理者・統括・人事、誤登録物理削除は会社管理者・統括という既存の採用条件を維持する。誤退職訂正、User/Auth、本人Self Accessは既存の専用境界に従う。
- 全項目readのactorを同社User全員へ拡張せず、roleなし・未知role・直接permission・developer/super-userだけを許可根拠にしない。既存archiveのread/writeやrestoreをこの回答だけで開放しない。
- 単一Employee原本と既存のリアルタイム購読を活かす。項目別read API、表示用projection、新しい通知collection/trigger、定期pollingへの切替は今回追加しない。既存query・名前/国籍/性別の表示に必要なfieldを隠すための互換adapterも不要となる。削除済みID、更新通知、権限喪失、cacheの扱いは引き続き確認する。
- 自宅住所からの座標取得・保存を継続し、経路図の描画は将来工程へ残す。Employeeの住所保存に必要な外部処理は専用保存境界で扱い、transactionの再試行中に外部呼出しを繰り返さない。providerへの実接続、既存座標の一括更新・削除はこの文書採用で実行しない。
- 他collectionの保存処理・RulesへのEmployee存在guard追加案は今回の対象外とする。従属なし物理削除の要件は維持し、Employee単独の変更で安全条件を満たす方法が確定しない間は削除を開放しない。

## 座標取得失敗時の追加決定（2026-09-06）

利用者は「住所を保存し、古い座標を消して座標未取得を知らせる」案にYESと回答した。Employeeの新規作成・住所変更で座標取得だけが失敗した場合、入力・認可・競合検証を満たす住所は保存する。古い座標は現住所の座標として残さず、未取得を保存結果へ明示する。住所不変の通常更新では既存座標を維持する。外部障害で住所編集を止める代替は採用しない。今回の通常保存に含まれる座標の消去と、既存全件の一括削除・実provider接続の実行承認を区別する。

## 理由と代替案

閲覧roleごとに項目を隠す前提がなくなったため、全文read禁止・DTO化・専用検索・通知同期をCRUDの前提にしない。既存の購読と表示を維持し、操作別writeとrole/tenantの境界へ対応を集中する。項目限定案と自動再取得案は未採用とし、将来閲覧範囲を狭める必要が生じた際に再検討する。

## 影響・互換性・移行

新fieldや表示用collectionへのdata移行はこのread判断から不要となる。現page、Employee原本、既存archive、汎用Rulesの許可を照合し、他roleなしactorや直接writeの迂回を閉じる。Employeeの全文取得を維持しても、通常更新を全文setに戻さない。勤怠CSV等にある原簿氏名の利用は維持し、そのpageの既存DEVELOPER条件を新たな業務role許可へ広げない。

住所取得の必要性・用途・失敗時保存は回答済みだが、最新住所との照合と座標未取得の保存表現、Employee経路での住所/座標log、旧clientや共通geocoding入口との整合は実装前の残設計である。他masterの保存・Rulesを変えずに扱える範囲を確認する。

## rollback

未反映の文書差分はcorrective commitで戻せる。後続実装でreadを変更した場合、取得済みの情報を回収できたと主張しない。復旧時も同社User全員への広域writeを再開しない。座標やEmployeeの実dataを変える復旧は、対象・手順・承認を別に扱う。

## 検証と再検討条件

今回のpermission仕様反映はcomprehensive 5 gateで検証する。後続実装では会社管理者/既知roleのget/list、roleなし/未知role/直接permission/仮・無効User/他tenantの拒否、全項目readと更新拒否の両立、従来検索・在籍期間・初期選択ID・氏名/性別/国籍表示、権限変更時の購読/cache、住所保存・失敗・再試行を確認する。現時点の検証は文書に限定し、実装・runtime・Devは未検証とする。

閲覧項目の制限、経路図の利用、他collection保存境界の改修、削除安全性を満たす追加scopeが必要になった時点で、対象と影響を説明して別判断する。
