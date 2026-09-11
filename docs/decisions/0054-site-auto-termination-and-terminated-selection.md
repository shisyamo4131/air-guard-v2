# 0054 Site自動終了と終了済み現場の選択境界

- 日付: 2026-09-05
- 状態: Accepted
- 認可の部分置換: 2026-09-11のFGA-03と[ADR 0065](0065-tenant-trust-normal-business-authorization.md)により、手動終了・再有効化のactorは同一tenantの有効な認証済み本登録Userへ置換した。以下の`sites:write`記述は採用時点の履歴であり、専用Callable／transaction、status・予定・工期・metadata保護、自動終了のsystem-only境界は引き続き有効である。
- 関連仕様: [取引先・現場・取極め](../specification.md#取引先現場取極め)
- 関連判断: [0031 必要十分なデータ境界](0031-proportional-data-boundary-and-change-safeguards.md)、[0048 SiteのCustomer変更と既存実績snapshot](0048-site-customer-change-and-historical-snapshots.md)、[0051 Siteの誤登録archive](0051-site-mistaken-registration-archive-boundary.md)、[0052 Site下流情報のsnapshot時点](0052-site-downstream-snapshot-timing.md)

## 背景

警備現場では、実際の稼働終了が判明してもSite masterを更新する定常運用が乏しく、ACTIVEのまま放置されやすい。類似名称のACTIVE Siteが蓄積すると、利用者が新しい予定等で選ぶべき現場を識別しにくくなる。この問題を軽減するため、現行scheduled taskは工期終了から3か月を超えたACTIVE Siteを自動的にTERMINATEDへ変更している。

一方、現行処理は将来予定・未処理予定を確認せず、工期変更・再有効化との競合preconditionを持たない。cleanup失敗によって自動終了も停止する一方でhandlerが成功扱いになり得る。自動終了の理由・sourceもSiteへ残らない。また、終了直後に残工事が見つかり、Siteを継続的に再有効化せず一時的な予定へ使用する業務があるため、TERMINATEDを新規選択不能にする境界は実運用と一致しない。

## 決定

### 状態と表示

- 永続statusは`ACTIVE`と`TERMINATED`の2値を維持し、自動終了専用statusを追加しない。
- ACTIVE Siteのうち工期終了日を過ぎたものは、保存statusを変えず表示上の派生状態として扱う。通常の「稼働中」に加え、「工期終了済み」「自動終了予定」「工期終了済み・予定あり」をChipで区別し、自動終了予定日を表示する。
- 工期終了日が未設定のSiteは推測で自動終了しない。一覧では「工期未設定」として識別可能にし、必要な場合は長期未稼働の確認対象へ出す。
- ACTIVE一覧では通常のACTIVE Siteを先、終了候補を後に並べる。TERMINATEDは終了済み一覧に保持し、status Chipを表示する。

### 自動終了条件

- 自動終了を維持する。JSTの暦日で、工期終了日の90日後を自動終了予定日とし、その日の00:00以降に候補とする。既存の曖昧なcalendar month減算ではなく、90日の固定期間として境界を検証する。
- 実行時にSiteがACTIVE、有効な工期終了日を持つ、自動終了予定日に到達している、JST当日以降のSiteOperationScheduleがない、実績へ変換されていない未処理SiteOperationScheduleがないことをすべて満たす場合だけTERMINATEDへ変更する。
- 将来予定または未処理予定があれば予定を取消・削除せず、自動終了をwrite 0で見送る。画面では「工期終了済み・予定あり」と表示し、工期終了日の確認・訂正を促す。
- 自動終了はSite statusと現在の遷移metadataだけを変更し、Customer、Agreement、SiteOperationSchedule、ArrangementNotification、OperationResult、Billing、帳票を自動変更しない。

### 終了済み現場の利用と再有効化

- TERMINATEDはSite masterの通常編集を制限する状態とするが、履歴参照だけに限定せず、稼働予定その他の新規業務参照先として選択できる。
- 選択候補ではACTIVEを先、TERMINATEDを後にグループ化する。TERMINATEDには「終了済み」Chipを必ず表示し、取引先名、現場code、住所の一部等、類似名称を区別できる情報を併記する。
- TERMINATEDを選択するときは、終了済み現場を残工事等へ使用することを明示確認する。選択だけでSiteをACTIVEへ変更しない。単発の残工事はTERMINATEDのまま予定・実績へ使用できる。
- 継続的に再開する場合は、同じCustomerを維持したまま、会社管理者またはstrict role preset由来の`sites:write`を持つ許可actorが、必須reasonと新しい工期を一つの再有効化operationで保存してACTIVEへ戻す。取極め、既存予定、実績、請求は自動変更しない。Customer変更が別途必要な場合はADR 0048の許可境界に従う。

### 競合・再試行・説明可能性

- 自動終了時はtransactionまたは同等のpreconditionでSiteのstatus、工期終了日、対象予定を再確認する。工期訂正、再有効化、予定作成との順序を直列化し、古いquery結果による後勝ち終了を許さない。
- 予定作成が先に確定した場合は自動終了を見送り、自動終了が先に確定した場合も、終了済み現場を選ぶ明示確認を経た後続予定作成は許可する。
- cleanupと自動終了の失敗境界を分離する。対象はpage/cursorと制御されたbatchで処理し、部分失敗を成功扱いにせず、失敗対象を再試行・照合できるようにする。maintenance中は実行しない。
- Siteには現在の状態遷移を説明する`statusChangedAt`、`statusChangedBy`、`statusChangeSource`、`statusChangeReason`を保存する。自動終了actorはsystem、sourceはAUTO、reasonは工期終了後90日経過を表す既知値とする。Site lifecycle専用のappend-only履歴collectionは現段階では設けない。
- 初期実装では現場ごとのemail・FCM通知を送らず、ダッシュボードの終了候補件数、一覧のChip、自動終了予定日、予定矛盾表示を利用者通知とする。外部通知が必要と確認された場合は、現場ごとの通知ではなく日次集約を別途検討する。

## 理由

自動終了を廃止すると、Site更新が定常化しにくい業務ではACTIVE候補が再び蓄積する。反対に工期日だけで即時終了すると、延長・残工事・未処理予定を誤って通常候補から整理する。工期終了後90日の猶予、予定guard、派生Chipを組み合わせれば、利用者へ訂正機会を示しながら放置Siteを整理できる。

TERMINATEDを新規選択不能にすると、残工事のために一時的なSite再利用が必要な場合、不要な再有効化または重複Site作成を促す。状態を明示したうえで選択可能にし、単発利用と継続的再開を分ける方が、一覧整理と実運用の両方に合う。

## 代替案

- 自動終了を廃止して候補通知だけにする案: Site更新が放置されるという確認済み運用課題を解消せず、ACTIVEの蓄積を止められないため採用しない。
- calendar monthで3か月を計算する案: 月末ごとの境界が分かりにくいため、説明・testが明確な90日固定を採用する。
- 将来予定を自動取消して終了する案: 配置・通知・実績への影響が大きく、利用者の明示操作なしに業務dataを変えるため採用しない。
- TERMINATEDを全新規候補から除外する案: 残工事等の一時利用を妨げ、重複Site作成を招くため採用しない。
- 終了候補を新しい永続statusにする案: 現時点では工期日と予定から導出でき、schema・migration・遷移を増やす必要がないため採用しない。
- 状態変更ごとにappend-only監査を作る案: 現段階で具体的な保持・監査要件がなく、現在遷移metadataと運用logで説明可能なため採用しない。

## 影響と互換性

- `Sites` collection、Site ID、`ACTIVE/TERMINATED`値、Site内Agreement、下流ID参照を維持する。自動終了候補Chipは派生表示であり、候補status migrationを行わない。
- TERMINATEDを選択可能にする点は現行Autocompleteのstatus非限定挙動を維持するが、従来の「新規選択不可」という確認済み方針を置換する。TERMINATEDの通常master編集制限と理由付き再有効化は維持する。
- 現行scheduled taskは90日固定、予定guard、transaction/precondition、状態遷移metadata、pagination、失敗再試行、maintenance連携を満たさないため、SITE-04でFunctions、application、Rules、必要なschema、testを整合させる必要がある。
- `statusChangedAt/by/source/reason`の正確な保存shapeとschema package要否は実装前に全reader/writerを確認する。既存Siteを推測backfillせず、新規遷移から保存する。

## 移行とrollback

この判断の文書化では既存Site、予定、実績、請求を変更しない。候補Chipは既存工期日から導出する。遷移metadataは新規の手動終了・自動終了・再有効化から保存し、過去の終了理由・actor・時刻を現在値から推測backfillしない。

実装は現行scheduled taskを一度に置換するreview可能なcommitとし、remote適用前はcode revertで戻せる。Devへ適用する場合は旧・新scheduled処理の二重実行を避け、対象Function、実行時刻、停止条件、rollback先を別承認で固定する。既に状態が変わったSiteはcode revertだけでACTIVEへ戻さず、対象を確認した理由付き再有効化を使う。

## 検証

- 工期終了前、終了日、終了後89日、90日、工期未設定、不正日付、ACTIVE/TERMINATEDをJST境界で確認する。
- 将来予定、当日予定、未処理の過去予定、実績化済み予定、予定なしについて終了・skip・Chipを確認し、予定documentが変更されないことを確認する。
- 自動終了と工期訂正、再有効化、予定作成を同時実行し、古い判定による上書き、二重終了、失敗成功扱いがないことを確認する。
- 0件、500件境界、501件以上、途中失敗、再試行、cleanup失敗、maintenance、timezone、log・metricを確認する。
- ACTIVE/TERMINATEDの候補group、Chip、取引先・code・住所表示、TERMINATED選択確認、単発残工事、選択時の非再有効化、継続再開時のactor・reason・新工期を確認する。
- 自動終了・再有効化前後でCustomer、Agreement、既存予定、通知、実績、請求が不変であり、現在の遷移metadataだけが正しく保存されることを確認する。
- 実装時のchange classは最終差分に応じて`ui-css-layout`、`application-logic`、`data-contract-schema-migration`のunionとする。Dev／Prod・remote/data・migration・packageは別承認とする。

## 再検討条件

90日では業務上短すぎる・長すぎる具体例が確認された場合、Companyごとの猶予設定が必要になった場合、TERMINATED Siteの新規利用が請求・配置で成立しないことが確認された場合、外部通知またはappend-only監査の法令・契約・内部統制要件が確認された場合に再検討する。
