# ADR 0064: 機微・機密情報を分離するFirestoreドキュメント境界

- 適用明確化: 2026-09-12の[ADR 0070](0070-employee-insurance-normal-business-boundary.md)により、Employeeの保険番号・状態・日付・理由・履歴は本ADRの機微・機密情報に分類せず、Employee本体documentの通常業務情報として維持する。

- 日付: 2026-09-09
- 状態: Accepted
- 対象: Firestore document構成、機微な個人情報・機密情報、Security Rules
- 関連仕様: [共通データ仕様](../specification.md#firestoreドキュメントの構成)
- 一部置換: [ADR 0031](0031-proportional-data-boundary-and-change-safeguards.md)の分割条件、[ADR 0033](0033-company-bank-transfer-update-boundary.md)のCompany振込先保存先・read境界

## 背景

従来は一つの業務対象を一つのdocumentとし、read actor、保持、増加量、size、query、実測競合のいずれかを具体的に確認できる場合だけ分割していた。この原則により過剰なdocument分割を抑えた一方、機微な個人情報・機密情報も通常情報と同じdocumentへ置ける余地が残った。Firestoreのread許可はdocument全体へ適用されるため、同じdocument内の一部fieldだけをSecurity Rulesで非表示にはできない。

現行実装ではCompanyの振込先5 fieldをCompany rootに保持し、同じtenantの有効な本登録Userへroot全体のreadを許可している。従業員のマイナンバーと将来のCompany Stripe契約情報について、現時点で有効な保存実装は確認できない。Stripeの旧scaffoldは撤去済みである。取引先口座情報の具体的な保存path・fieldも現行sourceからは確認できない。

## 決定

- 通常の業務情報は、一つの管理対象について意味のある一まとまりを一つのdocumentにする。
- 従業員のマイナンバー、取引先・自社の口座情報、CompanyのStripe契約情報等の機微な個人情報・機密情報は、通常の本体documentから別documentへ分割する。この列挙は例示であり、漏えい時の影響、必要なread/write actor、保持・削除条件、外部provider ownershipから同等と判断した情報にも適用する。
- 新しい機微・機密情報は、分割先のpath、schema、actor、Rules、server処理、保持・削除、log、export、snapshot、testを確定するまで本体documentへ保存しない。分割documentを汎用fallback Rulesへ委ねない。
- 機微・機密性による必須分割以外でも、Firestore Rulesの式数・重複・例外を減らして認可を明確にできる等、総開発・保守コストを抑えられる場合は分割を個別に検討する。Rules、reader/writer、整合性、query/index、migration、運用負担を比較し、単に画面、writer、責務名が違うことだけでは分割しない。
- Company振込先はCompany rootから分割する。exact path、schema、read actor、請求snapshot・export、既存data migration、Rules・Functions・client cutoverは後続checkpointで確定する。ADR 0033のCompany root保持とroot同一read境界は置換するが、field validation、更新actor、super-user拒否、client直接write拒否等は個別見直しまで維持する。
- この文書変更だけでapplication、Functions、Rules、schema package、既存data、Dev・Prodを変更しない。既存同居情報は実装差として台帳化し、対象、全reader/writer、互換性、migration、rollback、検証、環境を別checkpointで承認してから移す。

## 理由

機微・機密情報を本体から分けることで、本体を必要とするactorへ不要な情報を渡さず、誤ったread許可や将来の権限拡張時の漏えい範囲を抑えられる。Rulesがdocument単位でreadを判定する制約とも整合する。Rules簡素化による分割は、分割自体のreader/writer、migration、整合性コストも含めて比較することで、過剰分割を避けながら保守性を改善できる。

## 代替案

- 機微fieldを本体へ残し、UIだけで非表示にする案: clientへdocumentが読める時点で保護境界にならないため採用しない。
- 本体へ残してCallable writeだけを強化する案: write権限は狭められるがread露出を分離できないため採用しない。
- すべての情報を細分化する案: query、整合性、migration、運用負担を増やすため採用しない。通常情報は一まとまりを既定とする。

## 影響と互換性

- project governanceと確認済み仕様が変更され、ADR 0031・0033の一部を置換する。
- Company振込先の現行root保存・read境界は新仕様と不整合になる。直ちに削除・移動せず、後続の設計、migration、Rules cutover、Dev受入れまで未解消として扱う。
- 将来マイナンバー、取引先口座、Stripe契約情報を追加する場合は、最初の保存前に専用documentとdeny-by-defaultのRules境界を用意する。
- Firestore edition固有機能には依存しない。記録済みDevはStandard editionだが、remoteの現在値は今回確認しておらず、将来の実装・release時にactual targetを再確認する。

## 移行とrollback

今回の文書変更は通常のGit revertで戻せる。既存Company振込先の分割は、現行fieldと複製先、全reader/writer、請求snapshot、旧client、対象件数を確認し、backup、dry-run、apply、post-check、停止条件、forward correctionまたはrollbackを固定した別checkpointで行う。新旧pathの併存、dual read/write、maintenanceの要否は実測条件から決め、ここでは承認しない。

## 検証

- project governance、仕様、ADR索引、実装差台帳、再開案内、CHANGELOGの参照と置換範囲が一致すること。
- governance-permissions-agents classのcomprehensive gateを最終文書状態で実行すること。
- 後続実装では、通常本体から機密fieldが取得できないこと、専用documentのactor・tenant許可／拒否、汎用fallbackからの除外、Functions/Admin経路、log・export・snapshot、migration前後不変条件を検証すること。

## 再検討条件

法令・契約上の分類、閲覧・保持・削除要件が確定または変更された場合、Rules簡素化のための分割が実測上の保守コストを増やした場合、または複製・snapshotから同等の露出が確認された場合。
