# 0056 通常業務の管理権限とEmployee専用操作・archive境界

- 日付: 2026-09-06
- 状態: Accepted
- 一部置換済み: Employee archiveの今回導入は[ADR 0057](0057-employee-hard-delete-and-archive-deferral.md)で保留し、誤登録の物理削除へ変更した。以下のarchive採用・残判断はその変更前の判断理由であり、現在の削除契約はADR 0057と仕様を参照する。
- 関連仕様: [現行仕様](../specification.md)の「テナントと認証」「Employeeの操作権限と保持」「サブスクリプション」
- 一部置換: [ADR 0020](0020-employee-retirement-user-offboarding-and-reinstatement.md)の退職actorから統括を除く条件、[ADR 0033](0033-company-bank-transfer-update-boundary.md)の振込先更新を会社管理者だけに限る条件。各操作のidentity・対象guard・data保護は維持する。
- 適用計画: [Employeeロードマップ](../roadmaps/employee.md)。製品実装・Dev反映の完了を示すADRではない。

## 背景

利用者は現role一覧を確認した上で、会社管理者・統括を通常業務の更新担当、人事をEmployee担当、他roleをEmployeeの必要項目だけ閲覧する担当とする方針を採用した。「全機能」「全権」が専用操作や保護対象まで無条件に含む曖昧さを除き、退職は会社管理者・統括・人事、archiveは会社管理者・統括だけに許可すると明示した。

## 決定

- 通常業務の閲覧・作成・更新は自社の会社管理者・統括へ許可する。課金、管理者移譲・会社管理者accountの変更、退職・archive等は専用操作の条件を優先する。確定dataのlock、tenant、自己操作、field・型・状態の制約を解除する意味ではない。
- Employee通常編集には基本・国籍・警備員登録・資格・保険を含め、会社管理者・統括・人事へ許可する。労務・法務・管制・経理は閲覧だけとし、業務に必要な項目へ限定する。従前の「統括は表示情報だけ編集」「労務も保険編集」は採用しない。
- Employee退職は会社管理者・統括・人事。会社管理者の既存許可を維持し、統括を追加する。退職日、自己退職拒否、User連携の識別、予約、User/Auth削除、業務記録保持、誤訂正時のAuth非復元は変更しない。
- Employee archiveは会社管理者・統括だけに許可し、従属documentがあれば拒否する。従属物を自動削除して条件を満たす操作にはしない。archive用途を誤登録・重複だけに限るかは、この採用から確定しない。
- 将来のシステム契約・課金操作は会社管理者専用とする。統括が自己の管理者化や会社管理者accountの変更により取得できる抜け道を作らない。課金結果の任意書換えは提供しない。顧客向け請求に用いる会社振込先・請求業務は通常業務であり、システム利用料の課金操作とは別に扱う。

## 残る判断

- 閲覧role別のexact field、検索一致・並び・帳票への公開範囲、住所送信と既存座標、read方式。
- 誤退職訂正・履歴閲覧のactorを追加変更するか。変更判断までは既存会社管理者専用条件を維持する。
- 保険の手続中操作等の遷移条件、既存history復元の扱い、通常編集の競合・作成応答不明の回復範囲。
- archiveの対象状態・用途、依存catalog、User/予約/監査参照、同時参照作成への対策、保存形状・閲覧・restore・同ID再作成・保持。現modelの限定的hasManyを全依存の証明にしない。
- archive/統括退職の具体的な実装工程、検証、重み配分。従来のtransaction writer変更禁止と両立しない依存が見つかれば、対象・影響・代替を提示してから実装scopeを決める。

## 理由と代替案

通常業務の担当を分かりやすくしつつ、会社の契約管理と従業員の状態・記録を変える専用操作を区別する。人事だけに退職を限定する案、労務へ保険更新を付与する案、統括をEmployee表示情報編集だけに制限する案は今回採用しない。全閲覧actorへのEmployee全文公開、従属recordのあるarchive、無条件のadmin/manager wildcardも採用しない。

## 影響・互換性・移行

承認済み要件と旧実装との差がある。role catalog、client/server policy、route・UI、Rules、testを対象工程で揃え、通常業務の統括権限を全機能で変更済みとは表現しない。Employee外のCompany設定・稼働請求等は親roadmapの後続整合対象にし、EMP-01から製品codeやpackageを変更しない。既存のUser roleを自動変更せず、package公開・導入、Dev・remote・実dataのarchive/移行は別承認とする。

## rollback

今回の文書変更は所有差分を通常のGit corrective commitで戻せる。製品反映後の復旧は対象操作の停止と互換修正を優先し、PII全文公開や広い直接writeを再開放しない。archiveのdata復旧は保存形状・backup・参照整合を決めて別承認し、User/Authを自動復元しない。

## 検証と再検討条件

今回の権限仕様採用は`governance-permissions-agents`としてcomprehensive 5 gateと新規fileのcached diff checkを行う。後続実装ではrole単独/複数、他tenant、無効・仮User、自己/管理者target、直接permission、専用操作の迂回、従属あり・なし・検査失敗・同時参照作成、User/Auth非連鎖削除を確認する。閲覧fieldや依存writerの判断でscopeが変わる場合は、実装前に影響reviewと工程配分を再確認する。
