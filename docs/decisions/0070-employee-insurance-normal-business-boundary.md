# ADR 0070: Employee保険情報の通常業務分類と状態遷移境界

- 日付: 2026-09-12
- 状態: Accepted
- 対象: Employeeに保持する健康保険、厚生年金、雇用保険の番号、状態、日付、理由、履歴
- 関連仕様: [Employeeの操作権限と保持](../specification.md#employeeの操作権限と保持)
- 適用計画: [根本ガバナンス整合phase](../roadmaps/foundational-governance-alignment.md)
- 既存判断との関係: [ADR 0059](0059-employee-retired-edit-and-insurance-operation-boundary.md)のrole別操作権限と未決の機微・機密分類を置き換える。退職後編集禁止と保険の状態遷移条件は維持する

## 背景

Employeeの保険情報は現在Employee本体documentにあり、保険番号、加入・喪失等の状態と日付、理由、履歴を含む。FGA-04開始時点の仕様では、これを機微・機密情報として通常Employeeから分けるかが未決であり、確定までは会社管理者・統括・人事だけが変更できる安全側の実装を維持していた。

2026-09-12、利用者は保険情報を特別扱いする必要はないと回答した。通常Employee情報のtenant共通権限と、加入・喪失等を順序どおりに扱う状態遷移の保護を分けて確定する必要がある。

## 決定

- 健康保険、厚生年金、雇用保険の番号、状態、日付、理由、履歴は、この製品では機微・機密情報の例外に分類しない。Employee本体documentの通常業務情報として保持し、保険専用documentへ分割しない。
- 在職中のEmployeeでは、同じtenantの有効な認証済み本登録Userへ、他の通常Employee情報と同じread・編集権限を許可する。会社管理者、role、permission、super-user等を保険情報のserver認可条件にしない。roleによる画面表示差はUXに限定する。
- 退職後のEmployeeを通常編集できない既存条件は維持し、保険情報と履歴復元にも適用する。
- 加入、加入完了、喪失、適用除外、取消、履歴復元は、情報の機密性ではなく順序が重要な状態遷移として扱う。現在の状態、手続中可否、履歴有無、退職状態等のdata保護条件は維持する。
- 状態遷移の専用保存処理と世代値を残すか、通常Employee保存へ統合するかはFGA-04の実装checkpointで実経路とtestを照合して決める。分類だけを理由に専用Callableや競合制御を維持しない一方、順序違反や二重適用を許す変更もしない。
- マイナンバー等、将来追加される別の機微・機密情報は本決定の対象外であり、ADR 0064に従って別document境界を確定してから保存する。

## 理由

利用者が保険情報を通常業務情報として扱うことを明示したため、保険だけをrole別に閲覧・編集制限したり、別documentへ移したりする根拠はない。一方、加入・喪失等は前の状態に応じて結果が変わるため、通常情報であることと状態遷移を無条件に上書きできることは同義ではない。この二つを分けることで、不要な権限制限を外しながら既存の業務順序を保てる。

## 影響と互換性

- 現行dataはEmployee本体documentに保持されているため、分類確定だけでは移行、複製、削除を要しない。
- 現行のclient、Firestore Rules、Callableにはrole別制限と競合拒否が残っており、FGA-04で段階的に整合する。本文書の採用だけで実装済みとは扱わない。
- Employee原本を読めるactorが保険情報も読める現在の単一document形状を維持する。Employee Self Accessや外部公開の範囲は広げない。
- archiveは保険情報を含むEmployee raw全体を従来どおり扱う。archiveのactor、参照検査、監査、restore非提供は変更しない。

## 移行

最初に通常Employeeのreader、Manager、writer、Rulesからrole別のserver制限を外す。通常の可逆編集はdocument単位last-write-winsへ揃える。保険操作は状態遷移の入力・保存・再送経路を確認し、必要な状態保護だけを残す。退職、誤退職訂正、archive、User/Authは専用操作のまま変更しない。既存保険documentの分割や一括変換は行わない。

## rollback

この分類の文書変更は対象commitのGit revertで戻せる。後続実装はFGA-04 checkpoint単位で戻し、既存dataを別documentへ移動していない状態を維持する。すでに許可した通常actorの操作結果を、code rollbackだけで取り消せるとは扱わない。

## 検証

- 同じtenantの有効な本登録Userがroleに依存せず、在職Employeeの保険情報を含む通常情報をread・編集できることを確認する。
- 無効User、仮登録User、他tenantは拒否されることを確認する。
- 退職後の保険編集が拒否されることを確認する。
- 加入、加入完了、喪失、適用除外、取消、履歴復元の既存状態条件と二重適用防止を確認する。
- 保険情報の別document移行がなく、既存Employee dataとarchive snapshotが読めることを確認する。

## 再検討条件

法令、契約、運用要件により保険情報の閲覧者をtenant内で分ける必要が生じた場合、Employee Self Accessへ保険情報を公開する場合、または保険情報を外部serviceへ連携する場合。
