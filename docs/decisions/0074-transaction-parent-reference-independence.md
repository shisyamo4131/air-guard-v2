# ADR 0074: トランザクション文書を親マスターの存在から独立させる

- 日付: 2026-09-14
- 状態: Accepted
- 2026-09-15改訂: マスターarchive・restoreは[ADR 0060の改訂](0060-common-archive-purge-and-address-contract.md)と[共通仕様](../specification.md#ドキュメントのアーカイブと物理削除)を正とする。以下の専用archive維持・transaction従属による拒否なしという旧条件は、その範囲で現行要件に使用しない。通常保存・背景同期とtransaction削除の判断は維持する。
- 対象: 稼働予定、稼働実績、配置通知、請求、勤怠、従業員別稼働、現場勤務履歴
- 関連仕様: [共通データ仕様](../specification.md#共通データ仕様)、[Employeeの操作権限と保持](../specification.md#employeeの操作権限と保持)、[取引先・現場・取極め](../specification.md#取引先現場取極め)
- 置換範囲: [ADR 0046](0046-customer-archive-reference-barrier.md)、[ADR 0051](0051-site-mistaken-registration-archive-boundary.md)、[ADR 0060](0060-common-archive-purge-and-address-contract.md)のうち、トランザクション文書に親マスターの存在を必須とする判断を置換する

## 背景

Customer、Site、Employeeのarchive時に参照先を残さない目的で、トランザクション文書の保存時にも親マスターの存在確認を追加した。さらにBilling、DailyAttendance、DailyOperationsByEmployeeへEmployee検索用の`employeeIds`を追加し、埋込み実績との一致を厳密に検査した。

この追加検査は請求金額や勤怠時間を計算するための条件ではない。既存Billingの検索用索引や過去の作業員明細が新しい検査形式と一致しない場合、先頭のBilling同期が失敗し、同じTrigger内の後続勤怠同期まで実行されない事象をDevで確認した。

## 決定

- トランザクション文書は、保存または再計算する時点でCustomer、Site、Employeeの親マスターが存在することを必須にしない。親がarchive済みでも、保存済みIDとsnapshotを過去の業務記録として保持できる。
- Customer、Site、Employeeをarchiveする際、予定、実績、通知、請求、勤怠、従業員別稼働、現場勤務履歴を参照理由にしてarchiveを拒否しない。
- Billing、DailyAttendance、DailyOperationsByEmployeeへarchive検索だけのために追加した集約`employeeIds`を計算・検査しない。既存文書に残る同fieldは読取り条件にせず、次回再計算時に除去できる。
- Firestore RulesはOperationResult作成時の`siteId`と`customerId`の安全な文字列検査を維持するが、対応するlive Site／Customerの存在を必須にしない。
- 同じ従業員または外注先が同じ文書内に複数回含まれることを、この整合性検査だけを理由に拒否しない。標準modelが作る明細と索引を保存する。
- 会社・利用者・テナントの確認、入力値の形式、lock、金額・時間の計算、archiveのactor・理由・監査・同ID衝突防止は維持する。
- 業務値の計算に必要なマスター読取りは維持する。予定または実績へ取極め・警備種別を適用するSite読取りと、新規Billingの入金予定日を決めるCustomer支払条件読取りは、単なる親存在検査ではない。
- Customer archive時のlive Site確認は、マスター同士の従属関係として維持する。Employeeに紐づくUser、予約、lock、head、lifecycle operationの確認も認証・処理状態の保護として維持する。

## 理由

請求は実績に保存された金額・税率、勤怠は実績に保存された勤務時刻と休憩、履歴は実績に保存された現場ID・従業員IDを使って再計算できる。これらの過去記録を再計算するために、現在の親マスターが残っている必要はない。

archiveの都合だけで通常保存と背景同期へ追加条件を重ねると、親とは無関係な請求・勤怠作成まで止まる。親マスターの管理とトランザクション記録の再計算を分離する方が、既存データとの互換性と障害復旧を単純にできる。

## 影響・互換性

- 既存のcollection path、OperationResultの業務field、請求金額、勤怠時間、表示用snapshotは変更しない。
- 集約文書の`employeeIds`はarchive検索用の派生fieldだったため、以後は保証しない。これを業務表示・計算・権限判定へ使う新規実装を追加しない。
- 親マスターをarchiveした後も、そのIDを持つ過去のトランザクション文書は残る。名称等は保存済みsnapshotを優先し、liveマスターを取得できない画面は既存の欠損表示契約に従う。
- 今回のcode変更だけで既存データを一括変更しない。欠落した派生文書の復旧は[OperationResult派生文書の復旧計画](../implementation/operation-result-projection-recovery.md)に分離する。

## 移行

先にFunctionsとRulesの修正を検証・反映し、その後にDevのread-only調査で欠落範囲を確定する。既存OperationResultを不用意に更新してTriggerを再発火させず、承認済みの専用repairで請求、勤怠、従業員別稼働、現場勤務履歴を冪等に再計算する。

正確な対象会社、日付範囲、件数はまだ確定していない。利用者観測の「概ね9月4日まで、一部9月10日」は調査の手掛かりとし、復旧対象の確定値には使わない。

## Rollback

環境反映前は本変更単位をrevertできる。環境反映後に問題があった場合はarchive入口とrepairを停止し、通常の親存在barrierを無条件に戻さない。復旧処理で変更した派生文書は、実行前snapshotと作成文書一覧を用いて対象を限定して戻す。remote dataの変更とrollbackは別承認を必要とする。

## 検証

- 親Employee／Siteが存在しなくてもBilling、DailyAttendance、DailyOperationsByEmployee、SiteEmployeeHistoryを作成・再計算できること。
- 既存集約の`employeeIds`欠損・不一致が同期を止めず、次回書込みで除去されること。
- Customer archiveはlive Siteだけを、Employee archiveは認証・lifecycle文書だけを確認し、Site archiveはトランザクションcollectionを走査しないこと。
- OperationResultのclient作成は同一tenant、actor、ID、lock、初期値を検査しつつ、live Site／Customer存在を要求しないこと。
- 親存在以外の入力不正、他tenant、認証不正、lock、計算失敗を従来どおり拒否すること。
- 全domain test、Local Emulator test、文書検査、差分検査を最終状態で実行する。Dev反映とdata repairは別の承認・実行証拠を必要とする。

## 再検討条件

親マスター不存在によって具体的な誤請求、勤怠誤計算、権限逸脱が確認された場合に再検討する。その際も、発生した処理に必要な最小条件を示し、全トランザクション文書へ一律の親存在barrierを戻さない。
